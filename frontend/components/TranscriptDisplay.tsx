import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface TranscriptDisplayProps {
  transcript: string;
  isRecording: boolean;
}

export function TranscriptDisplay({ transcript, isRecording }: TranscriptDisplayProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Auto-scroll to bottom when transcript updates
    if (transcript) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [transcript]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transcript</Text>
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording</Text>
          </View>
        )}
      </View>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        {transcript ? (
          <Text style={styles.transcriptText}>{transcript}</Text>
        ) : (
          <Text style={styles.placeholder}>
            {isRecording
              ? 'Listening... Start speaking to begin your walkthrough.'
              : 'Tap "Start" to begin recording your walkthrough.'}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  recordingText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 12,
    paddingTop: 8,
  },
  transcriptText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
  },
  placeholder: {
    fontSize: 15,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
