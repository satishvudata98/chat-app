import React, { useMemo, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Application from 'expo-application';
import { useQuery } from 'convex/react';
// @ts-ignore
import { api } from '../convex/_generated/api';

function parseVersion(version: string | null | undefined) {
  if (!version) return [0, 0, 0];

  return version
    .split('.')
    .slice(0, 3)
    .map((part) => {
      const value = Number.parseInt(part, 10);
      return Number.isFinite(value) ? value : 0;
    });
}

function isVersionLessThan(current: string | null | undefined, target: string | null | undefined) {
  const currentParts = parseVersion(current);
  const targetParts = parseVersion(target);

  for (let index = 0; index < 3; index += 1) {
    if (currentParts[index] < targetParts[index]) return true;
    if (currentParts[index] > targetParts[index]) return false;
  }

  return false;
}

export function NativeUpdatePrompt() {
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  // @ts-ignore
  const updateConfig = useQuery(api.appConfig.getAndroidUpdate);
  const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';

  const updateState = useMemo(() => {
    if (!updateConfig?.apkUrl) return null;

    const isRequired = isVersionLessThan(currentVersion, updateConfig.minimumVersion);
    const isAvailable = isVersionLessThan(currentVersion, updateConfig.latestVersion);

    if (!isRequired && !isAvailable) return null;
    if (!isRequired && dismissedVersion === updateConfig.latestVersion) return null;

    return {
      isRequired,
      latestVersion: updateConfig.latestVersion,
      apkUrl: updateConfig.apkUrl,
      message: updateConfig.message,
    };
  }, [currentVersion, dismissedVersion, updateConfig]);

  if (!updateState) return null;

  const openDownload = () => {
    Linking.openURL(updateState.apkUrl).catch((e) => {
      console.error('Failed to open APK update link', e);
    });
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.message}>
            {updateState.message ||
              `Version ${updateState.latestVersion} is ready. Download and install the APK to keep using the latest app.`}
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={openDownload}>
            <Text style={styles.primaryButtonText}>Download APK</Text>
          </TouchableOpacity>

          {!updateState.isRequired && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setDismissedVersion(updateState.latestVersion)}
            >
              <Text style={styles.secondaryButtonText}>Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#00A884',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    padding: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
