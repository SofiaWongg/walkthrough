import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useWalkthrough } from '../context/WalkthroughContext';
import { WalkthroughCard } from '../components/WalkthroughCard';
import { PropertyModal } from '../components/PropertyModal';

export default function HomeScreen() {
  const router = useRouter();
  const {
    walkthroughs,
    loadWalkthroughs,
    startWalkthrough,
    isLoading,
  } = useWalkthrough();
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWalkthroughs();
  }, [loadWalkthroughs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWalkthroughs();
    setRefreshing(false);
  };

  const handleStartWalkthrough = async (propertyId: string, propertyName: string) => {
    setModalVisible(false);
    await startWalkthrough(propertyId, propertyName);
    router.push('/walkthrough/live');
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No Walkthroughs Yet</Text>
      <Text style={styles.emptySubtitle}>
        Start your first property walkthrough by tapping the button below
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading && walkthroughs.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={walkthroughs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <WalkthroughCard
              walkthrough={item}
              onPress={() => {
                // Could navigate to a detail view in the future
              }}
            />
          )}
          contentContainerStyle={
            walkthroughs.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#3b82f6"
            />
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+ Start Walkthrough</Text>
      </TouchableOpacity>

      <PropertyModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleStartWalkthrough}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingTop: 8,
    paddingBottom: 100,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
