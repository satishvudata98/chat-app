import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { useUser } from '../../store/UserContext';
// @ts-ignore
import { api } from '../../convex/_generated/api';

export default function UserDeepLinkHandler() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useUser();
  // @ts-ignore
  const getOrCreateChat = useMutation(api.messages.getOrCreateChat);

  useEffect(() => {
    async function handlePairing() {
      if (!userId) {
        // If the user isn't logged in at all, onboarding will catch them, 
        // but we'll safely redirect them to onboarding here just in case.
        router.replace('/onboarding');
        return;
      }

      if (!id) return;

      if (id === userId) {
        alert("You can't chat with yourself!");
        router.replace('/(tabs)/chats');
        return;
      }

      try {
        const chatId = await getOrCreateChat({
          myUserId: userId,
          otherUserId: id,
        });

        // Redirect directly into the chat
        router.replace(`/chat/${chatId}`);
      } catch (e) {
        console.error('Failed to pair from deep link:', e);
        alert('Invalid Link');
        router.replace('/(tabs)/chats');
      }
    }

    handlePairing();
  }, [id, userId]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#00A884" />
      <Text style={styles.text}>Connecting...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
});
