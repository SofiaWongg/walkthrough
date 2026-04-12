import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Property,
  Walkthrough,
  WalkthroughSession,
  InProgressChecklist,
  ChecklistResult
} from '../types/walkthrough';
import * as mockApi from '../services/mockApi';

interface WalkthroughContextType {
  // Properties
  properties: Property[];
  loadProperties: () => Promise<void>;

  // Past walkthroughs
  walkthroughs: Walkthrough[];
  loadWalkthroughs: () => Promise<void>;

  // Current session
  currentSession: WalkthroughSession | null;
  startWalkthrough: (propertyId: string, propertyName: string) => Promise<void>;
  updateTranscript: (chunk: string) => Promise<void>;
  finishWalkthrough: () => Promise<ChecklistResult>;
  clearSession: () => void;

  // Results
  currentResults: ChecklistResult | null;
  setCurrentResults: (results: ChecklistResult | null) => void;
  saveCurrentWalkthrough: () => Promise<void>;

  // Loading states
  isLoading: boolean;
  isProcessing: boolean;
}

const WalkthroughContext = createContext<WalkthroughContextType | null>(null);

export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [walkthroughs, setWalkthroughs] = useState<Walkthrough[]>([]);
  const [currentSession, setCurrentSession] = useState<WalkthroughSession | null>(null);
  const [currentResults, setCurrentResults] = useState<ChecklistResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await mockApi.getProperties();
      setProperties(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadWalkthroughs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await mockApi.getWalkthroughs();
      setWalkthroughs(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startWalkthrough = useCallback(async (propertyId: string, propertyName: string) => {
    setIsLoading(true);
    try {
      const { sessionId } = await mockApi.startSession(propertyId, propertyName);
      setCurrentSession({
        sessionId,
        propertyId,
        propertyName,
        transcript: '',
        inProgressChecklist: {
          items: [],
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateTranscript = useCallback(async (chunk: string) => {
    if (!currentSession) return;

    setIsProcessing(true);
    try {
      const updatedChecklist = await mockApi.processChunk(currentSession.sessionId, chunk);
      setCurrentSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          transcript: prev.transcript + (prev.transcript ? ' ' : '') + chunk,
          inProgressChecklist: updatedChecklist,
        };
      });
    } finally {
      setIsProcessing(false);
    }
  }, [currentSession]);

  const finishWalkthrough = useCallback(async (): Promise<ChecklistResult> => {
    if (!currentSession) {
      throw new Error('No active session');
    }

    setIsProcessing(true);
    try {
      const results = await mockApi.validateWalkthrough(currentSession.sessionId);
      setCurrentResults(results);
      return results;
    } finally {
      setIsProcessing(false);
    }
  }, [currentSession]);

  const saveCurrentWalkthrough = useCallback(async () => {
    if (!currentSession || !currentResults) {
      throw new Error('No session or results to save');
    }

    setIsLoading(true);
    try {
      await mockApi.saveWalkthrough(currentSession.sessionId, currentResults);
      // Reload walkthroughs to include the new one
      await loadWalkthroughs();
    } finally {
      setIsLoading(false);
    }
  }, [currentSession, currentResults, loadWalkthroughs]);

  const clearSession = useCallback(() => {
    setCurrentSession(null);
    setCurrentResults(null);
  }, []);

  return (
    <WalkthroughContext.Provider
      value={{
        properties,
        loadProperties,
        walkthroughs,
        loadWalkthroughs,
        currentSession,
        startWalkthrough,
        updateTranscript,
        finishWalkthrough,
        clearSession,
        currentResults,
        setCurrentResults,
        saveCurrentWalkthrough,
        isLoading,
        isProcessing,
      }}
    >
      {children}
    </WalkthroughContext.Provider>
  );
}

export function useWalkthrough() {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider');
  }
  return context;
}
