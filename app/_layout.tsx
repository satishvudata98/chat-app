import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { UserProvider, useUser } from '../store/UserContext';
import { ThemePreferenceProvider, useAppTheme } from '../store/ThemeContext';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import React, { Component, ReactNode } from 'react';

class ScreenErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error('Screen error caught by boundary:', error); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, textAlign: 'center', color: '#666' }}>Something went wrong. Please go back and try again.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useLinkCurrentDeviceToUser } from '../hooks/useDeviceProfile';
import { useNetworkState } from '../hooks/useNetworkState';
import { NativeUpdatePrompt } from '../components/NativeUpdatePrompt';
import { IncomingCallModal } from '../components/IncomingCallModal';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL || "https://example.convex.cloud");

function OfflineBanner() {
  const isOnline = useNetworkState();
  if (isOnline) return null;
  return (
    <View style={offlineStyles.banner}>
      <Text style={offlineStyles.text}>No internet connection</Text>
    </View>
  );
}

const offlineStyles = StyleSheet.create({
  banner: {
    backgroundColor: '#C62828',
    paddingVertical: 6,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

function AuthState() {
  const { isLoading } = useUser();

  usePushNotifications();
  useLinkCurrentDeviceToUser();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScreenErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: true, title: 'Chat' }} />
        <Stack.Screen name="call/[id]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="scan" options={{ presentation: 'modal', headerShown: true, title: 'Scan QR Code' }} />
      </Stack>
    </ScreenErrorBoundary>
  );
}

function AppShell() {
  const { themeName, colors, isLoading } = useAppTheme();
  const navigationTheme = {
    ...(themeName === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(themeName === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.panel,
      text: colors.text,
      border: colors.border,
      notification: colors.secondary,
    },
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <OfflineBanner />
      <AuthState />
      <IncomingCallModal />
      <NativeUpdatePrompt />
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <UserProvider>
        <ThemePreferenceProvider>
          <AppShell />
        </ThemePreferenceProvider>
      </UserProvider>
    </ConvexProvider>
  );
}
