import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Text } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

// A simple Icon component for tabs
function TabBarIcon(props: { name: string; color: string }) {
  return <Text style={{ fontSize: 24, color: props.color }}>{props.name}</Text>;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => <TabBarIcon name="💬" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}
