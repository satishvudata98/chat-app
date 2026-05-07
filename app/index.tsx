import { Redirect } from 'expo-router';
import { useUser } from '../store/UserContext';
import { ActivityIndicator, View } from 'react-native';
import React from 'react';

export default function Index() {
  const { userId, isLoading } = useUser();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (userId) {
    return <Redirect href="/(tabs)/chats" />;
  } else {
    return <Redirect href="/onboarding" />;
  }
}
