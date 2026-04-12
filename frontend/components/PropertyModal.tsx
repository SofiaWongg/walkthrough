import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Property } from '../types/walkthrough';
import { useWalkthrough } from '../context/WalkthroughContext';

interface PropertyModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (propertyId: string, propertyName: string) => void;
}

export function PropertyModal({ visible, onClose, onSubmit }: PropertyModalProps) {
  const { properties, loadProperties } = useWalkthrough();
  const [address, setAddress] = useState('');
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (visible) {
      loadProperties();
      setAddress('');
      setFilteredProperties([]);
    }
  }, [visible, loadProperties]);

  useEffect(() => {
    if (address.length > 0) {
      const filtered = properties.filter(p =>
        p.name.toLowerCase().includes(address.toLowerCase())
      );
      setFilteredProperties(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredProperties([]);
      setShowSuggestions(false);
    }
  }, [address, properties]);

  const handleSelectProperty = (property: Property) => {
    setAddress(property.name);
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    if (!address.trim()) return;

    // Check if it matches an existing property
    const existingProperty = properties.find(
      p => p.name.toLowerCase() === address.toLowerCase()
    );

    if (existingProperty) {
      onSubmit(existingProperty.id, existingProperty.name);
    } else {
      // Create new property with generated ID
      const newId = `new_${Date.now()}`;
      onSubmit(newId, address.trim());
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Start Walkthrough</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Property Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter property address..."
            placeholderTextColor="#6b7280"
            autoFocus
            autoCapitalize="words"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          {showSuggestions && (
            <View style={styles.suggestionsContainer}>
              <FlatList
                data={filteredProperties}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => handleSelectProperty(item)}
                  >
                    <Text style={styles.suggestionText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                style={styles.suggestionsList}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              !address.trim() && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!address.trim()}
          >
            <Text style={styles.submitText}>Start Walkthrough</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: '#60a5fa',
    fontSize: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#374151',
    borderRadius: 8,
    maxHeight: 150,
  },
  suggestionsList: {
    borderRadius: 8,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  suggestionText: {
    color: '#fff',
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#4b5563',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
