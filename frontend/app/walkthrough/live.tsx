import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useWalkthrough } from '../../context/WalkthroughContext';
import { TranscriptDisplay } from '../../components/TranscriptDisplay';
import { ChecklistView } from '../../components/ChecklistView';
import { DictationControls } from '../../components/DictationControls';
import { useAudioRecording } from '../../hooks/useAudioRecording';

export default function LiveWalkthroughScreen() {
  const router = useRouter();
  const {
    currentSession,
    updateTranscript,
    finishWalkthrough,
    isProcessing,
  } = useWalkthrough();

  const handleTranscriptChunk = useCallback(async (chunk: string) => {
    if (chunk.trim()) {
      await updateTranscript(chunk);
    }
  }, [updateTranscript]);

  const {
    isRecording,
    isMuted,
    startRecording,
    stopRecording,
    toggleMute,
  } = useAudioRecording({
    onTranscriptChunk: handleTranscriptChunk,
  });

  const handleStart = async () => {
    try {
      await startRecording();
    } catch (error) {
      Alert.alert(
        'Microphone Error',
        'Could not access the microphone. Please check your permissions.',
      );
    }
  };

  const handleMute = async () => {
    await toggleMute();
  };

  const handleFinish = async () => {
    try {
      if (isRecording) {
        await stopRecording();
      }
      await finishWalkthrough();
      router.replace('/walkthrough/results');
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to finish walkthrough. Please try again.',
      );
    }
  };

  if (!currentSession) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No active walkthrough session</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.propertyHeader}>
        <Text style={styles.propertyAddress} numberOfLines={2}>
          {currentSession.propertyName}
        </Text>
      </View>

      <View style={styles.transcriptContainer}>
        <TranscriptDisplay
          transcript={currentSession.transcript}
          isRecording={isRecording && !isMuted}
        />
      </View>

      <View style={styles.checklistContainer}>
        <ChecklistView
          inProgressChecklist={currentSession.inProgressChecklist}
          title="In-Progress Checklist"
        />
      </View>

      <View style={styles.controlsContainer}>
        <DictationControls
          isRecording={isRecording}
          isMuted={isMuted}
          isProcessing={isProcessing}
          onStart={handleStart}
          onMute={handleMute}
          onFinish={handleFinish}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
    padding: 16,
  },
  propertyHeader: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  propertyAddress: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  transcriptContainer: {
    flex: 1,
    marginBottom: 12,
  },
  checklistContainer: {
    flex: 1,
    marginBottom: 12,
  },
  controlsContainer: {
    marginBottom: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
});
