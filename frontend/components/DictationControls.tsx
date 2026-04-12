import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';

interface DictationControlsProps {
  isRecording: boolean;
  isMuted: boolean;
  isProcessing: boolean;
  onStart: () => void;
  onMute: () => void;
  onFinish: () => void;
}

export function DictationControls({
  isRecording,
  isMuted,
  isProcessing,
  onStart,
  onMute,
  onFinish,
}: DictationControlsProps) {
  return (
    <View style={styles.container}>
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      )}

      <View style={styles.controls}>
        {!isRecording ? (
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={onStart}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonIcon}>{'\u25CF'}</Text>
            <Text style={styles.buttonText}>Start</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.button,
                styles.muteButton,
                isMuted && styles.mutedButton,
              ]}
              onPress={onMute}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonIcon}>
                {isMuted ? '\u{1F507}' : '\u{1F50A}'}
              </Text>
              <Text style={styles.buttonText}>
                {isMuted ? 'Unmute' : 'Mute'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.finishButton]}
              onPress={onFinish}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonIcon}>{'\u25A0'}</Text>
              <Text style={styles.buttonText}>Finish</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  processingOverlay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  processingText: {
    color: '#9ca3af',
    fontSize: 13,
    marginLeft: 8,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  startButton: {
    backgroundColor: '#10b981',
  },
  muteButton: {
    backgroundColor: '#6b7280',
  },
  mutedButton: {
    backgroundColor: '#ef4444',
  },
  finishButton: {
    backgroundColor: '#3b82f6',
  },
  buttonIcon: {
    fontSize: 16,
    color: '#fff',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
