import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Walkthrough, WalkthroughItem } from '../types';
import { api } from '../api';
import ImageGallery from '../components/ImageGallery';

type EndStep = 0 | 1 | 2;

export default function WalkthroughPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { walkthroughId } = useParams<{ walkthroughId: string }>();

  const initWalkthrough = (
    location.state as { walkthrough?: Walkthrough } | null
  )?.walkthrough;

  const [walkthrough, setWalkthrough] = useState<Walkthrough | null>(
    initWalkthrough ?? null
  );
  const [currentText, setCurrentText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [endStep, setEndStep] = useState<EndStep>(0);
  const [editableItems, setEditableItems] = useState<WalkthroughItem[]>([]);
  const [deletedBaseItems, setDeletedBaseItems] = useState<WalkthroughItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFile, setCameraFile] = useState<File | null>(null);
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const walkthroughRef = useRef<Walkthrough | null>(walkthrough);
  const isSendingRef = useRef(false);
  const currentSendRef = useRef<Promise<Walkthrough | null>>(Promise.resolve(null));
  const pendingTextRef = useRef('');
  const currentTextRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const transcriptionRef = useRef<HTMLDivElement>(null);
  const isPinnedRef = useRef(true);

  useEffect(() => {
    walkthroughRef.current = walkthrough;
  }, [walkthrough]);

  useEffect(() => {
    const el = transcriptionRef.current;
    if (!el) return;
    if (currentText === '') {
      isPinnedRef.current = true;
    }
    if (isPinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [currentText]);

  const handleTranscriptionScroll = () => {
    const el = transcriptionRef.current;
    if (!el) return;
    isPinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  };

  useEffect(() => {
    if (!initWalkthrough && walkthroughId) {
      api.getWalkthrough(walkthroughId).then(setWalkthrough).catch(() => {
        navigate('/properties', { replace: true });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSendChunk = (text: string): Promise<Walkthrough | null> => {
    if (isSendingRef.current || !text.trim() || !walkthroughRef.current) {
      return Promise.resolve(null);
    }
    isSendingRef.current = true;
    setIsSending(true);
    const promise = api
      .addTranscriptChunk(walkthroughRef.current.id, text.trim())
      .then((updated) => {
        pendingTextRef.current = '';
        currentTextRef.current = '';
        setCurrentText('');
        setWalkthrough(updated);
        return updated;
      })
      .catch((e: unknown) => {
        setError(`Failed to process chunk: ${(e as Error).message}`);
        return null;
      })
      .finally(() => {
        isSendingRef.current = false;
        setIsSending(false);
      });
    currentSendRef.current = promise;
    return promise;
  };

  const startListening = () => {
    if (isListeningRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSpeechSupported(false);
      return;
    }

    // Android Chrome re-delivers previous results when .start() is called on the
    // same instance after onend fires, causing 2-3x duplication. Always create a
    // fresh instance on each session restart to avoid this.
    const createAndStart = () => {
      const recognition = new SR() as SpeechRecognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            pendingTextRef.current += result[0].transcript + ' ';
          } else {
            interim += result[0].transcript;
          }
        }
        const fullText = pendingTextRef.current + interim;
        currentTextRef.current = fullText;
        setCurrentText(fullText);

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const text = pendingTextRef.current.trim();
          if (text) void doSendChunk(text);
        }, 5000);
      };

      recognition.onend = () => {
        if (isListeningRef.current && recognitionRef.current === recognition) {
          recognitionRef.current = null;
          createAndStart();
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError(`Microphone error: ${event.error}`);
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // ignore start errors
      }
    };

    isListeningRef.current = true;
    setIsListening(true);
    createAndStart();
  };

  const stopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  useEffect(() => {
    if (walkthrough) startListening();
    return stopListening;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!walkthrough]);

  const handlePause = () => {
    stopListening();
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
    startListening();
  };

  const handleEndClick = async () => {
    stopListening();

    // Wait for any in-flight chunk send (e.g. silence timer fired concurrently)
    const inFlight = await currentSendRef.current;
    let latest: Walkthrough | null = inFlight ?? walkthroughRef.current;

    // Send any text that hasn't been sent yet
    const remaining = currentTextRef.current.trim() || pendingTextRef.current.trim();
    if (remaining) {
      const updated = await doSendChunk(remaining);
      if (updated) latest = updated;
    }

    if (!latest) return;

    const uncheckedBase = latest.item_list.filter(
      (item) => item.is_from_base && item.status === 'unchecked'
    );

    setWalkthrough(latest);

    if (uncheckedBase.length > 0) {
      setEndStep(1);
    } else {
      setEditableItems([...latest.item_list]);
      setEndStep(2);
    }
  };

  const handleGoBack = () => {
    setDeletedBaseItems([]);
    setEndStep(0);
    setIsPaused(false);
    startListening();
  };

  const handleContinue = () => {
    const items = walkthroughRef.current?.item_list ?? [];
    setEditableItems([...items]);
    setDeletedBaseItems([]);
    setEndStep(2);
  };

  const handleFinish = async () => {
    if (!walkthrough || isEnding) return;
    setIsEnding(true);
    try {
      await api.endWalkthrough(walkthrough.id, {
        ...walkthrough,
        item_list: [...editableItems, ...deletedBaseItems.map((i) => ({ ...i, status: 'unchecked' as const }))],
      });
      navigate(`/properties/${walkthrough.property_id}`, { replace: true });
    } catch (e) {
      setError(`Failed to end walkthrough: ${(e as Error).message}`);
      setIsEnding(false);
    }
  };

  const updateEditableItem = (id: string, updates: Partial<WalkthroughItem>) => {
    setEditableItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const deleteEditableItem = (id: string) => {
    setEditableItems((items) => {
      const item = items.find((i) => i.id === id);
      if (item?.is_from_base) {
        setDeletedBaseItems((prev) => [...prev, item]);
      }
      return items.filter((i) => i.id !== id);
    });
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleCameraClick = async () => {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions and try again.');
      setCameraOpen(false);
    }
  };

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      setCameraFile(file);
      setCameraPreviewUrl(URL.createObjectURL(file));
      stopStream();
      setCameraOpen(false);
    }, 'image/jpeg', 0.92);
  };

  const handleCameraClose = () => {
    stopStream();
    setCameraOpen(false);
  };

  const handleImageConfirm = async () => {
    if (!cameraFile || !walkthrough) return;
    setIsUploadingImage(true);
    try {
      const updated = await api.uploadImage(walkthrough.id, cameraFile);
      setWalkthrough(updated);
    } catch (e) {
      setError(`Failed to upload image: ${(e as Error).message}`);
    } finally {
      setIsUploadingImage(false);
      if (cameraPreviewUrl) URL.revokeObjectURL(cameraPreviewUrl);
      setCameraFile(null);
      setCameraPreviewUrl(null);
    }
  };

  const handleRetake = () => {
    if (cameraPreviewUrl) URL.revokeObjectURL(cameraPreviewUrl);
    setCameraFile(null);
    setCameraPreviewUrl(null);
    void handleCameraClick();
  };

  if (!walkthrough) return null;

  const uncheckedBase = walkthrough.item_list.filter(
    (item) => item.is_from_base && item.status === 'unchecked'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isListening ? '#ef4444' : '#9ca3af',
            flexShrink: 0,
          }}
        />
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Active Walkthrough</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {isSending
              ? 'Processing transcript...'
              : isPaused
              ? 'Dictation paused'
              : isListening
              ? 'Recording — speak now'
              : 'Waiting for microphone…'}
          </div>
        </div>
      </div>

      {/* Transcription Area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          background: 'var(--bg)',
          overflow: 'hidden',
        }}
      >
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--red-bg)',
              borderRadius: 'var(--radius)',
              color: 'var(--red)',
              marginBottom: 12,
              fontSize: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--red)',
                flexShrink: 0,
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {!speechSupported && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--yellow-bg)',
              borderRadius: 'var(--radius)',
              marginBottom: 12,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            Speech recognition is not supported in this browser. Please use Chrome.
          </div>
        )}

        {/* Text box — scrolls internally so the border never moves */}
        <div
          ref={transcriptionRef}
          onScroll={handleTranscriptionScroll}
          style={{
            flex: 1,
            minHeight: 0,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          {/* Gradient fades only the text at the top, inside the border */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              height: 48,
              background: 'linear-gradient(to bottom, var(--card) 0%, transparent 100%)',
              pointerEvents: 'none',
              zIndex: 1,
              marginBottom: -48,
            }}
          />
          <div style={{ padding: 16, fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {currentText || (
              <span style={{ color: 'var(--text-secondary)' }}>
                {isPaused
                  ? 'Dictation is paused. Press play to resume.'
                  : isListening
                  ? 'Listening… start speaking.'
                  : 'Waiting for microphone…'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Checklist Panel */}
      <div
        style={{
          height: 260,
          borderTop: '1px solid var(--border)',
          background: 'var(--card)',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            fontWeight: 600,
            fontSize: 14,
            position: 'sticky',
            top: 0,
            background: 'var(--card)',
            zIndex: 1,
          }}
        >
          Checklist ({walkthrough.item_list.length} items)
        </div>

        {walkthrough.item_list.length === 0 ? (
          <div style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 14 }}>
            No items yet — they'll appear as you speak.
          </div>
        ) : (() => {
          const renderItem = (item: WalkthroughItem, indented: boolean) => (
            <div
              key={item.id}
              style={{
                padding: '10px 16px',
                paddingLeft: indented ? 32 : 16,
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: 14,
              }}
            >
              <span
                style={{
                  marginTop: 2,
                  color: item.status === 'checked' ? 'var(--green)' : '#9ca3af',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {item.status === 'checked' ? '✓' : '○'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: item.is_from_base ? 500 : 400 }}>
                  {item.name}
                  {item.is_from_base && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        background: 'var(--bg)',
                        padding: '1px 5px',
                        borderRadius: 4,
                      }}
                    >
                      base
                    </span>
                  )}
                </div>
                {item.notes && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {item.notes}
                  </div>
                )}
              </div>
            </div>
          );

          const noLocation = walkthrough.item_list.filter((i) => !i.location);
          const byLocation = walkthrough.item_list.reduce<Record<string, typeof walkthrough.item_list>>((acc, item) => {
            if (!item.location) return acc;
            (acc[item.location] ??= []).push(item);
            return acc;
          }, {});

          return (
            <>
              {noLocation.map((item) => renderItem(item, false))}
              {Object.entries(byLocation).map(([location, items]) => (
                <div key={location}>
                  <div
                    style={{
                      padding: '6px 16px',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {location}
                  </div>
                  {items.map((item) => renderItem(item, true))}
                </div>
              ))}
            </>
          );
        })()}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--card)',
          flexShrink: 0,
          display: 'flex',
          gap: 10,
        }}
      >
        <button
          onClick={handleCameraClick}
          disabled={isSending || endStep !== 0}
          title="Take photo"
          style={{
            padding: '13px 16px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: isSending || endStep !== 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: isSending || endStep !== 0 ? 0.5 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        {endStep === 0 && (
          isPaused ? (
            <button
              onClick={handleResume}
              title="Resume dictation"
              style={{
                padding: '13px 16px',
                background: '#16a34a',
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handlePause}
              disabled={isSending}
              title="Pause dictation"
              style={{
                padding: '13px 16px',
                background: 'var(--red)',
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: isSending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: isSending ? 0.5 : 1,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <rect x="5" y="4" width="4" height="16" rx="1" />
                <rect x="15" y="4" width="4" height="16" rx="1" />
              </svg>
            </button>
          )
        )}
        <button
          onClick={handleEndClick}
          disabled={isSending}
          style={{
            flex: 1,
            padding: 13,
            background: isSending ? '#fca5a5' : '#1e293b',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: 15,
            fontWeight: 600,
            cursor: isSending ? 'not-allowed' : 'pointer',
          }}
        >
          {isSending ? 'Processing…' : 'End Walkthrough'}
        </button>
      </div>

      {/* Hidden canvas for capturing frames */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Camera viewfinder */}
      {cameraOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ flex: 1, width: '100%', objectFit: 'cover', minHeight: 0 }}
          />
          <div
            style={{
              padding: '24px 32px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 40,
              background: '#000',
            }}
          >
            <button
              onClick={handleCameraClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '50%',
                width: 48,
                height: 48,
                color: 'white',
                fontSize: 20,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
            <button
              onClick={handleCapture}
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: 'white',
                border: '4px solid rgba(255,255,255,0.5)',
                cursor: 'pointer',
                outline: '3px solid white',
              }}
            />
          </div>
        </div>
      )}

      {/* Camera preview */}
      {cameraPreviewUrl && (
        <BottomSheet>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Use this photo?</h2>
          <img
            src={cameraPreviewUrl}
            alt="Preview"
            style={{
              width: '100%',
              borderRadius: 'var(--radius)',
              marginBottom: 20,
              maxHeight: 320,
              objectFit: 'cover',
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleRetake} style={{ ...outlineBtn, flex: 1 }}>
              Retake
            </button>
            <button
              onClick={handleImageConfirm}
              disabled={isUploadingImage}
              style={{ ...primaryBtn, flex: 1, opacity: isUploadingImage ? 0.7 : 1, cursor: isUploadingImage ? 'not-allowed' : 'pointer' }}
            >
              {isUploadingImage ? 'Uploading…' : '✓'}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Step 1: Review unchecked base items */}
      {endStep === 1 && (
        <BottomSheet>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Unchecked Base Items
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            The following base items weren't checked during this walkthrough.
          </p>

          <div
            style={{
              maxHeight: 220,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              marginBottom: 20,
            }}
          >
            {uncheckedBase.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ color: '#9ca3af' }}>○</span>
                {item.name}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleGoBack} style={{ ...outlineBtn, flex: 1 }}>
              Go Back
            </button>
            <button onClick={handleContinue} style={{ ...primaryBtn, flex: 1 }}>
              Continue
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Step 2: Edit to-do items */}
      {endStep === 2 && (
        <BottomSheet>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Review Items</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Edit any items before finishing.
          </p>

          <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 16 }}>
            {editableItems.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No items.</p>
            )}
            {editableItems.map((item) => (
              <ReviewItemRow
                key={item.id}
                item={item}
                onUpdate={(updates) => updateEditableItem(item.id, updates)}
                onDelete={() => deleteEditableItem(item.id)}
              />
            ))}
          </div>

          {(() => {
            const photos = Object.values(walkthrough.images ?? {});
            if (photos.length === 0) return null;
            return (
              <div style={{ marginBottom: 16, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 0 10px' }}>
                  Photos taken ({photos.length})
                </div>
                <ImageGallery images={photos} compact />
              </div>
            );
          })()}

          <button
            onClick={handleFinish}
            disabled={isEnding}
            style={{
              ...primaryBtn,
              width: '100%',
              opacity: isEnding ? 0.7 : 1,
              cursor: isEnding ? 'not-allowed' : 'pointer',
            }}
          >
            {isEnding ? 'Finishing…' : 'Finish'}
          </button>
        </BottomSheet>
      )}
    </div>
  );
}

function ReviewItemRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: WalkthroughItem;
  onUpdate: (updates: Partial<WalkthroughItem>) => void;
  onDelete: () => void;
}) {
  const isTouchDevice = useMemo(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
    []
  );
  const [hovered, setHovered] = useState(false);
  const [deleteHovered, setDeleteHovered] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isSwiped, setIsSwiped] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff > 0) {
      setDragOffset(Math.min(diff, 80));
    } else if (isSwiped) {
      setDragOffset(Math.max(80 + diff, 0));
    }
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff > 40) {
      setIsSwiped(true);
      setDragOffset(80);
    } else if (diff < -40 && isSwiped) {
      setIsSwiped(false);
      setDragOffset(0);
    } else {
      setDragOffset(isSwiped ? 80 : 0);
    }
  };

  const offset = isSwiped ? 80 : dragOffset;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        marginBottom: 12,
        borderBottom: '1px solid var(--border)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setDeleteHovered(false); }}
    >
      {/* Touch: swipe-reveal delete button */}
      {isTouchDevice && offset > 0 && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'stretch',
          }}
        >
          <button
            onClick={onDelete}
            style={{
              width: 80,
              border: 'none',
              background: 'var(--red)',
              color: 'white',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      )}

      <div
        style={{
          transform: isTouchDevice ? `translateX(-${offset}px)` : 'none',
          transition: dragOffset === 0 || dragOffset === 80 ? 'transform 0.2s' : 'none',
          paddingBottom: 12,
          background: 'var(--card)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={item.status === 'checked'}
            onChange={(e) => onUpdate({ status: e.target.checked ? 'checked' : 'unchecked' })}
            style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
          />
          <input
            type="text"
            value={item.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            style={editInputStyle}
          />
          {item.is_from_base && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
              base
            </span>
          )}
          {/* Desktop: delete button on hover */}
          {!isTouchDevice && (
            <button
              onClick={onDelete}
              onMouseEnter={() => setDeleteHovered(true)}
              onMouseLeave={() => setDeleteHovered(false)}
              style={{
                flexShrink: 0,
                border: 'none',
                background: 'transparent',
                color: deleteHovered ? 'var(--red)' : 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
                padding: '2px 4px',
                opacity: hovered ? 1 : 0,
                transition: 'opacity 0.1s, color 0.1s',
              }}
            >
              Delete
            </button>
          )}
        </div>
        <input
          type="text"
          value={item.notes ?? ''}
          placeholder="Notes / todo (optional)"
          onChange={(e) => onUpdate({ notes: e.target.value || null })}
          style={{ ...editInputStyle, marginLeft: 24, color: 'var(--text-secondary)' }}
        />
      </div>
    </div>
  );
}

function BottomSheet({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: '14px 14px 0 0',
          padding: '24px 20px 32px',
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '12px 20px',
  background: 'var(--primary)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};

const outlineBtn: React.CSSProperties = {
  padding: '12px 20px',
  background: 'white',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};

const editInputStyle: React.CSSProperties = {
  flex: 1,
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '5px 8px',
  fontSize: 14,
  width: '100%',
};
