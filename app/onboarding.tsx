import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import uuid from 'react-native-uuid';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
// @ts-ignore
import { api } from '../convex/_generated/api';
import { useUser } from '../store/UserContext';
import { useDeviceProfileId } from '../hooks/useDeviceProfile';
import { useAppTheme } from '../store/ThemeContext';

export default function Onboarding() {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createNewProfile, setCreateNewProfile] = useState(false);
  const { setUserId } = useUser();
  const { colors } = useAppTheme();
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (showRestoreProfile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.restoreCard}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {existingProfile.name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{existingProfile.name}</Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
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
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Create new profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Welcome to ChatApp</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Enter your name to get started.</Text>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.panelSoft,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        placeholder="Your Name"
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleCreateProfile}
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: name.trim() ? colors.primary : colors.disabled }]}
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
          <Text style={[styles.backButtonText, { color: colors.primary }]}>Use existing profile</Text>
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
  },
  restoreCard: {
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
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
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
