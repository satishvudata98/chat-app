import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { useMutation } from 'convex/react';
// @ts-ignore
import { api } from '../convex/_generated/api';
import { useUser } from '../store/UserContext';

export function getDeviceProfileId() {
  if (Platform.OS !== 'android') return null;
  return Application.getAndroidId();
}

export function useDeviceProfileId() {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    setDeviceId(getDeviceProfileId());
  }, []);

  return deviceId;
}

export function useLinkCurrentDeviceToUser() {
  const { userId } = useUser();
  const deviceId = useDeviceProfileId();
  // @ts-ignore
  const updateDeviceId = useMutation(api.users.updateDeviceId);

  useEffect(() => {
    if (!userId || !deviceId) return;

    updateDeviceId({ userId, deviceId }).catch((e) => {
      console.error('Failed to link device to user', e);
    });
  }, [deviceId, updateDeviceId, userId]);
}
