import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Walkthrough, WalkthroughItem } from '../types';
import { api } from '../api';

type EndStep = 0 | 1 | 2;

export default function WalkthroughPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const initWalkthrough = (
    location.state as { walkthrough?: Walkthrough } | null
  )?.walkthrough;

  const [walkthrough, setWalkthrough] = useState<Walkthrough | null>(
    initWalkthrough ?? null
  );
  const [currentText, setCurrentText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [endStep, setEndStep] = useState<EndStep>(0);
  const [editableItems, setEditableItems] = useState<WalkthroughItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const walkthroughRef = useRef<Walkthrough | null>(walkthrough);
  const isSendingRef = useRef(false);
  const currentSendRef = useRef<Promise<Walkthrough | null>>(Promise.resolve(null));
  const pendingTextRef = useRef('');
  const currentTextRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    walkthroughRef.current = walkthrough;
  }, [walkthrough]);

  useEffect(() => {
    if (!initWalkthrough) {
      navigate('/properties', { replace: true });
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
        try {
          recognition.start();
        } catch {
          // ignore restart errors
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Microphone error: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;
    isListeningRef.current = true;
    setIsListening(true);
    recognition.start();
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
    if (initWalkthrough) startListening();
    return stopListening;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setEndStep(0);
    startListening();
  };

  const handleContinue = () => {
    const items = walkthroughRef.current?.item_list ?? [];
    setEditableItems([...items]);
    setEndStep(2);
  };

  const handleFinish = async () => {
    if (!walkthrough || isEnding) return;
    setIsEnding(true);
    try {
      await api.endWalkthrough(walkthrough.id, {
        ...walkthrough,
        item_list: editableItems,
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
              : isListening
              ? 'Recording — speak now'
              : 'Microphone paused'}
          </div>
        </div>
      </div>

      {/* Transcription Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          background: 'var(--bg)',
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
            }}
          >
            Speech recognition is not supported in this browser. Please use Chrome.
          </div>
        )}

        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 16,
            minHeight: 100,
            fontSize: 15,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}
        >
          {currentText || (
            <span style={{ color: 'var(--text-secondary)' }}>
              {isListening ? 'Listening… start speaking.' : 'Waiting for microphone…'}
            </span>
          )}
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
        ) : (
          walkthrough.item_list.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '10px 16px',
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
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--card)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleEndClick}
          disabled={isSending}
          style={{
            width: '100%',
            padding: 13,
            background: isSending ? '#fca5a5' : 'var(--red)',
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
              <div
                key={item.id}
                style={{
                  paddingBottom: 12,
                  marginBottom: 12,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.status === 'checked'}
                    onChange={(e) =>
                      updateEditableItem(item.id, {
                        status: e.target.checked ? 'checked' : 'unchecked',
                      })
                    }
                    style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateEditableItem(item.id, { name: e.target.value })}
                    style={editInputStyle}
                  />
                  {item.is_from_base && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      base
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={item.notes ?? ''}
                  placeholder="Notes / todo (optional)"
                  onChange={(e) =>
                    updateEditableItem(item.id, { notes: e.target.value || null })
                  }
                  style={{ ...editInputStyle, marginLeft: 24, color: 'var(--text-secondary)' }}
                />
              </div>
            ))}
          </div>

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
