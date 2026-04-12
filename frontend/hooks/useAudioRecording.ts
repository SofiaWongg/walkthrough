import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { CONFIG } from '../constants/config';
import { transcribeAudio } from '../services/whisperApi';

interface UseAudioRecordingOptions {
  onTranscriptChunk: (chunk: string) => Promise<void>;
}

export function useAudioRecording({ onTranscriptChunk }: UseAudioRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Use refs to track state inside async callbacks (avoids stale closure issues)
  const isRecordingRef = useRef(false);
  const isMutedRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isProcessingRef = useRef(false);
  const onTranscriptChunkRef = useRef(onTranscriptChunk);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync with props
  useEffect(() => {
    onTranscriptChunkRef.current = onTranscriptChunk;
  }, [onTranscriptChunk]);

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const startNewRecording = useCallback(async () => {
    try {
      console.log('Starting new recording...');
      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: CONFIG.AUDIO.SAMPLE_RATE,
            numberOfChannels: CONFIG.AUDIO.CHANNELS,
            bitRate: CONFIG.AUDIO.BIT_RATE,
          },
          ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: CONFIG.AUDIO.SAMPLE_RATE,
            numberOfChannels: CONFIG.AUDIO.CHANNELS,
            bitRate: CONFIG.AUDIO.BIT_RATE,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: CONFIG.AUDIO.BIT_RATE,
          },
        },
        undefined,
        100
      );

      recordingRef.current = recording;
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }, []);

  // Process recording and restart - defined with all logic inline to avoid circular deps
  const processAndRestart = useCallback(async () => {
    if (!recordingRef.current || isProcessingRef.current) {
      console.log('Skipping process - no recording or already processing');
      return;
    }

    isProcessingRef.current = true;
    console.log('Processing recording chunk...');

    try {
      // Stop current recording
      const currentRecording = recordingRef.current;
      recordingRef.current = null;

      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      console.log('Recording stopped, URI:', uri);

      // Start a new recording immediately if still in recording mode
      // Do this BEFORE transcription to minimize gap
      if (isRecordingRef.current && !isMutedRef.current) {
        console.log('Starting new recording before transcription...');
        await startNewRecording();
        // Reset pause timer for new recording
        clearPauseTimer();
        pauseTimerRef.current = setTimeout(() => {
          processAndRestart();
        }, CONFIG.PAUSE_THRESHOLD_MS);
      }

      // Now transcribe the audio (this can take time)
      if (uri) {
        const transcript = await transcribeAudio(uri);
        if (transcript.trim()) {
          await onTranscriptChunkRef.current(transcript);
        }
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      // Try to restart recording if we're still supposed to be recording
      if (isRecordingRef.current && !isMutedRef.current && !recordingRef.current) {
        try {
          await startNewRecording();
          clearPauseTimer();
          pauseTimerRef.current = setTimeout(() => {
            processAndRestart();
          }, CONFIG.PAUSE_THRESHOLD_MS);
        } catch (restartError) {
          console.error('Failed to restart recording:', restartError);
        }
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [startNewRecording, clearPauseTimer]);

  const resetPauseTimer = useCallback(() => {
    clearPauseTimer();
    pauseTimerRef.current = setTimeout(() => {
      processAndRestart();
    }, CONFIG.PAUSE_THRESHOLD_MS);
  }, [clearPauseTimer, processAndRestart]);

  const startRecording = useCallback(async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setIsRecording(true);
      isRecordingRef.current = true;
      setIsMuted(false);
      isMutedRef.current = false;

      await startNewRecording();
      resetPauseTimer();
    } catch (error) {
      setIsRecording(false);
      isRecordingRef.current = false;
      throw error;
    }
  }, [startNewRecording, resetPauseTimer]);

  const stopRecording = useCallback(async () => {
    console.log('Stopping recording...');
    clearPauseTimer();
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsMuted(false);
    isMutedRef.current = false;

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;

        // Transcribe any remaining audio
        if (uri) {
          const transcript = await transcribeAudio(uri);
          if (transcript.trim()) {
            await onTranscriptChunkRef.current(transcript);
          }
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }

    // Reset audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
  }, [clearPauseTimer]);

  const toggleMute = useCallback(async () => {
    if (isMutedRef.current) {
      // Unmuting - resume recording
      setIsMuted(false);
      isMutedRef.current = false;
      if (isRecordingRef.current) {
        await startNewRecording();
        resetPauseTimer();
      }
    } else {
      // Muting - pause recording
      setIsMuted(true);
      isMutedRef.current = true;
      clearPauseTimer();
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
          recordingRef.current = null;
        } catch (error) {
          console.error('Error pausing recording:', error);
        }
      }
    }
  }, [startNewRecording, resetPauseTimer, clearPauseTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPauseTimer();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [clearPauseTimer]);

  return {
    isRecording,
    isMuted,
    startRecording,
    stopRecording,
    toggleMute,
  };
}
