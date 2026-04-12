import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { InProgressChecklist, ChecklistResult } from '../types/walkthrough';
import { ChecklistItem } from './ChecklistItem';

interface ChecklistViewProps {
  // For in-progress view (live walkthrough)
  inProgressChecklist?: InProgressChecklist;
  // For results view (after validation)
  checklistResult?: ChecklistResult;
  title?: string;
}

export function ChecklistView({
  inProgressChecklist,
  checklistResult,
  title = 'Checklist',
}: ChecklistViewProps) {
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

  const renderInProgressItems = () => {
    if (!inProgressChecklist || inProgressChecklist.items.length === 0) {
      return (
        <Text style={styles.emptyText}>
          Items will appear here as you mention them during your walkthrough.
        </Text>
      );
    }

    return inProgressChecklist.items.map(item => (
      <ChecklistItem
        key={item.name}
        name={item.name}
        completed={item.completed}
      />
    ));
  };

  const renderResultItems = () => {
    if (!checklistResult) {
      return <Text style={styles.emptyText}>No checklist data available.</Text>;
    }

    const entries = Object.entries(checklistResult);
    const covered = entries.filter(([_, data]) => !data.is_missing && !data.is_new);
    const missing = entries.filter(([_, data]) => data.is_missing);
    const newItems = entries.filter(([_, data]) => data.is_new);

    return (
      <>
        {covered.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Covered Items ({covered.length})</Text>
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
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        {inProgressChecklist ? renderInProgressItems() : renderResultItems()}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 8,
    marginLeft: 4,
  },
  missingTitle: {
    color: '#f59e0b',
  },
  newTitle: {
    color: '#8b5cf6',
  },
});
