import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import uuid from 'react-native-uuid';
import { useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
// @ts-ignore
import { api } from '../convex/_generated/api';
import { useUser } from '../store/UserContext';

export default function Onboarding() {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setUserId } = useUser();
  const router = useRouter();
  
  // @ts-ignore
  const createUser = useMutation(api.users.createUser);

  const handleContinue = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    
    try {
      const newUserId = uuid.v4().toString();
      await createUser({ userId: newUserId, name: name.trim() });
      await setUserId(newUserId);
      router.replace('/(tabs)/chats');
    } catch (e) {
      console.error("Failed to create user", e);
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to ChatApp</Text>
      <Text style={styles.subtitle}>Enter your name to get started.</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Your Name"
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleContinue}
      />

      <TouchableOpacity 
        style={[styles.button, !name.trim() && styles.buttonDisabled]} 
        onPress={handleContinue}
        disabled={!name.trim() || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
