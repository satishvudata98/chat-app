import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import uuid from 'react-native-uuid';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
// @ts-ignore
import { api } from '../convex/_generated/api';
import { useUser } from '../store/UserContext';
import { useDeviceProfileId } from '../hooks/useDeviceProfile';

export default function Onboarding() {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createNewProfile, setCreateNewProfile] = useState(false);
  const { setUserId } = useUser();
  const router = useRouter();
  const deviceId = useDeviceProfileId();

  // @ts-ignore
  const createUser = useMutation(api.users.createUser);
  // @ts-ignore
  const existingProfiles = useQuery(
    api.users.getUsersByDeviceId,
    deviceId ? { deviceId } : 'skip',
  );

  const existingProfile = existingProfiles?.[0] ?? null;
  const isCheckingDevice = deviceId && existingProfiles === undefined;
  const showRestoreProfile = existingProfile && !createNewProfile;

  const finishWithUserId = async (nextUserId: string) => {
    await setUserId(nextUserId);
    router.replace('/(tabs)/chats');
  };

  const handleRestoreProfile = async () => {
    if (!existingProfile) return;
    setIsSubmitting(true);

    try {
      await finishWithUserId(existingProfile.userId);
    } catch (e) {
      console.error("Failed to restore user", e);
      setIsSubmitting(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);

    try {
      const newUserId = uuid.v4().toString();
      await createUser({
        userId: newUserId,
        name: name.trim(),
        ...(deviceId ? { deviceId } : {}),
      });
      await finishWithUserId(newUserId);
    } catch (e) {
      console.error("Failed to create user", e);
      setIsSubmitting(false);
    }
  };

  if (isCheckingDevice) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00A884" />
      </View>
    );
  }

  if (showRestoreProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.restoreCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {existingProfile.name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>{existingProfile.name}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={handleRestoreProfile}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue as {existingProfile.name}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setCreateNewProfile(true)}
            disabled={isSubmitting}
          >
            <Text style={styles.secondaryButtonText}>Create new profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
        onSubmitEditing={handleCreateProfile}
      />

      <TouchableOpacity
        style={[styles.button, !name.trim() && styles.buttonDisabled]}
        onPress={handleCreateProfile}
        disabled={!name.trim() || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>

      {existingProfile && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCreateNewProfile(false)}
          disabled={isSubmitting}
        >
          <Text style={styles.backButtonText}>Use existing profile</Text>
        </TouchableOpacity>
      )}
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
  restoreCard: {
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E8F5F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarText: {
    color: '#00A884',
    fontSize: 30,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
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
    width: '100%',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
