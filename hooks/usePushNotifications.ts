import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useMutation } from 'convex/react';
// @ts-ignore
import { api } from '../convex/_generated/api';
import { useUser } from '../store/UserContext';

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const { userId } = useUser();
  // @ts-ignore
  const updatePushToken = useMutation(api.users.updatePushToken);

  useEffect(() => {
    if (!userId) return;

    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (isExpoGo && Platform.OS === 'android') {
      console.log("Push notifications are not supported in Expo Go Android on SDK 53+. Returning empty token.");
      return;
    }

    try {
      // Dynamically require to prevent top-level crash in Expo Go
      const Notifications = require('expo-notifications');

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      registerForPushNotificationsAsync(Notifications)
        .then(token => {
          if (token) {
            setExpoPushToken(token);
            updatePushToken({ userId, pushToken: token }).catch(console.error);
          }
        })
        .catch(console.error);
    } catch (e) {
      console.log("Expo notifications failed to load", e);
    }
  }, [userId]);

  return expoPushToken;
}

async function registerForPushNotificationsAsync(Notifications: any) {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    if (!projectId) {
      console.log('Project ID not found for push notifications');
      return;
    }
    
    try {
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      console.log('Expo push token registered', token);
    } catch (e) {
      console.log('Error getting push token', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
