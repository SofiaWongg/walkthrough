import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ChecklistItemProps {
  name: string;
  completed: boolean;
  isNew?: boolean;
  isMissing?: boolean;
  todos?: string[];
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function ChecklistItem({
  name,
  completed,
  isNew = false,
  isMissing = false,
  todos = [],
  expanded = false,
  onToggleExpand,
}: ChecklistItemProps) {
  const hasExpandableContent = todos.length > 0;

  const getStatusIcon = () => {
    if (isMissing) return '!';
    if (isNew) return '+';
    if (completed) return '\u2713';
    return '\u25CB';
  };

  const getStatusColor = () => {
    if (isMissing) return '#f59e0b';
    if (isNew) return '#8b5cf6';
    if (completed) return '#10b981';
    return '#6b7280';
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onToggleExpand}
      disabled={!hasExpandableContent}
      activeOpacity={hasExpandableContent ? 0.7 : 1}
    >
      <View style={styles.mainRow}>
        <View style={[styles.statusIcon, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusIconText}>{getStatusIcon()}</Text>
        </View>
        <Text style={[styles.name, isMissing && styles.missingName]}>
          {name}
        </Text>
        {isNew && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>NEW</Text>
          </View>
        )}
        {isMissing && (
          <View style={[styles.badge, styles.missingBadge]}>
            <Text style={styles.badgeText}>MISSING</Text>
          </View>
        )}
        {hasExpandableContent && (
          <Text style={styles.expandIcon}>
            {expanded ? '\u25B2' : '\u25BC'}
          </Text>
        )}
      </View>

      {expanded && todos.length > 0 && (
        <View style={styles.todosContainer}>
          {todos.map((todo, index) => (
            <View key={index} style={styles.todoItem}>
              <Text style={styles.todoBullet}>{'\u2022'}</Text>
              <Text style={styles.todoText}>{todo}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#374151',
    borderRadius: 8,
    marginVertical: 4,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  statusIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusIconText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  name: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  missingName: {
    color: '#f59e0b',
  },
  badge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  missingBadge: {
    backgroundColor: '#f59e0b',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  expandIcon: {
    color: '#6b7280',
    fontSize: 10,
    marginLeft: 8,
  },
  todosContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
    backgroundColor: '#2d3748',
  },
  todoItem: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  todoBullet: {
    color: '#60a5fa',
    marginRight: 8,
    fontSize: 14,
  },
  todoText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
});
