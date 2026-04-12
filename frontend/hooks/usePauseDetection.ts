import { useRef, useCallback } from 'react';
import { CONFIG } from '../constants/config';

interface UsePauseDetectionOptions {
  onPauseDetected: () => void;
  pauseThreshold?: number;
}

export function usePauseDetection({
  onPauseDetected,
  pauseThreshold = CONFIG.PAUSE_THRESHOLD_MS,
}: UsePauseDetectionOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedRef = useRef(false);

  const resetPauseTimer = useCallback(() => {
    // Clear existing timer
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    isPausedRef.current = false;

    // Start new timer
    timeoutRef.current = setTimeout(() => {
      isPausedRef.current = true;
      onPauseDetected();
    }, pauseThreshold);
  }, [onPauseDetected, pauseThreshold]);

  const clearPauseTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isPausedRef.current = false;
  }, []);

  const isPaused = useCallback(() => {
    return isPausedRef.current;
  }, []);

  return {
    resetPauseTimer,
    clearPauseTimer,
    isPaused,
  };
}
