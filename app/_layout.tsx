import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { UserProvider, useUser } from '../store/UserContext';
import { View, ActivityIndicator } from 'react-native';
import { usePushNotifications } from '../hooks/usePushNotifications';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL || "https://example.convex.cloud");

function AuthState() {
  const { userId, isLoading } = useUser();
  const segments = useSegments();
  const router = useRouter();
  
  // Initialize push notifications tracking
  usePushNotifications();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: 'Chat' }} />
      <Stack.Screen name="scan" options={{ presentation: 'modal', headerShown: true, title: 'Scan QR Code' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ConvexProvider client={convex}>
      <UserProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AuthState />
          <StatusBar style="auto" />
        </ThemeProvider>
      </UserProvider>
    </ConvexProvider>
  );
}
