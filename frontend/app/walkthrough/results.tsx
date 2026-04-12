import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useWalkthrough } from '../../context/WalkthroughContext';
import { ChecklistItem } from '../../components/ChecklistItem';

export default function ResultsScreen() {
  const router = useRouter();
  const {
    currentSession,
    currentResults,
    saveCurrentWalkthrough,
    clearSession,
    isLoading,
  } = useWalkthrough();

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (itemName: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemName)) {
        next.delete(itemName);
      } else {
        next.add(itemName);
      }
      return next;
    });
  };

  const handleDone = async () => {
    try {
      await saveCurrentWalkthrough();
      clearSession();
      router.replace('/');
    } catch (error) {
      Alert.alert('Error', 'Failed to save walkthrough. Please try again.');
    }
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard Walkthrough',
      'Are you sure you want to discard this walkthrough? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            clearSession();
            router.replace('/');
          },
        },
      ]
    );
  };

  if (!currentResults || !currentSession) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No results available</Text>
      </View>
    );
  }

  const entries = Object.entries(currentResults);
  const covered = entries.filter(([_, data]) => !data.is_missing && !data.is_new);
  const missing = entries.filter(([_, data]) => data.is_missing);
  const newItems = entries.filter(([_, data]) => data.is_new);

  const totalItems = entries.length;
  const coveredCount = covered.length;
  const missingCount = missing.length;
  const newCount = newItems.length;

  return (
    <View style={styles.container}>
      <View style={styles.propertyHeader}>
        <Text style={styles.propertyAddress} numberOfLines={2}>
          {currentSession.propertyName}
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Summary</Text>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#10b981' }]}>
              {coveredCount}
            </Text>
            <Text style={styles.statLabel}>Covered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
              {missingCount}
            </Text>
            <Text style={styles.statLabel}>Missing</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#8b5cf6' }]}>
              {newCount}
            </Text>
            <Text style={styles.statLabel}>Additional</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {covered.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Covered Items ({covered.length})
            </Text>
            {covered.map(([name, data]) => (
              <ChecklistItem
                key={name}
                name={name}
                completed={true}
                todos={data.todos}
                expanded={expandedItems.has(name)}
                onToggleExpand={() => toggleExpand(name)}
              />
            ))}
          </View>
        )}

        {missing.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.missingTitle]}>
              Missing Items ({missing.length})
            </Text>
            <Text style={styles.sectionHint}>
              These items were not covered during your walkthrough
            </Text>
            {missing.map(([name, data]) => (
              <ChecklistItem
                key={name}
                name={name}
                completed={false}
                isMissing={true}
                todos={data.todos}
                expanded={expandedItems.has(name)}
                onToggleExpand={() => toggleExpand(name)}
              />
            ))}
          </View>
        )}

        {newItems.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.newTitle]}>
              Additional Items ({newItems.length})
            </Text>
            <Text style={styles.sectionHint}>
              Items you covered that weren't in the base checklist
            </Text>
            {newItems.map(([name, data]) => (
              <ChecklistItem
                key={name}
                name={name}
                completed={true}
                isNew={true}
                todos={data.todos}
                expanded={expandedItems.has(name)}
                onToggleExpand={() => toggleExpand(name)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.discardButton}
          onPress={handleDiscard}
          activeOpacity={0.8}
        >
          <Text style={styles.discardButtonText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.doneButton, isLoading && styles.doneButtonDisabled]}
          onPress={handleDone}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Text style={styles.doneButtonText}>
            {isLoading ? 'Saving...' : 'Save & Done'}
          </Text>
        </TouchableOpacity>
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
  summaryCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#374151',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
    marginLeft: 4,
  },
  missingTitle: {
    color: '#f59e0b',
  },
  newTitle: {
    color: '#8b5cf6',
  },
  sectionHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    marginLeft: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  discardButton: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  discardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    flex: 2,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonDisabled: {
    backgroundColor: '#4b5563',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
});
