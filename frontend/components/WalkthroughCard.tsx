import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Walkthrough } from '../types/walkthrough';

interface WalkthroughCardProps {
  walkthrough: Walkthrough;
  onPress?: () => void;
}

export function WalkthroughCard({ walkthrough, onPress }: WalkthroughCardProps) {
  const itemCount = Object.keys(walkthrough.checklist).length;
  const completedCount = Object.values(walkthrough.checklist).filter(
    item => !item.is_missing
  ).length;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.address} numberOfLines={2}>
          {walkthrough.propertyName}
        </Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {walkthrough.status === 'completed' ? 'Complete' : 'In Progress'}
          </Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.date}>{formatDate(walkthrough.createdAt)}</Text>
        <Text style={styles.itemCount}>
          {completedCount}/{itemCount} items
        </Text>
      </View>

      <Text style={styles.transcript} numberOfLines={2}>
        {walkthrough.transcript || 'No transcript available'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  address: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  statusBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  date: {
    fontSize: 13,
    color: '#9ca3af',
  },
  itemCount: {
    fontSize: 13,
    color: '#60a5fa',
    fontWeight: '500',
  },
  transcript: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
});
