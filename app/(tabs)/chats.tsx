import React from 'react';
import { Alert, View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
// @ts-ignore
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useUser } from '../../store/UserContext';

export default function ChatsScreen() {
  const router = useRouter();
  const { userId } = useUser();
  // @ts-ignore
  const chats = useQuery(api.messages.listChats, userId ? { userId } : 'skip');
  // @ts-ignore
  const archiveChatForUser = useMutation(api.messages.archiveChatForUser);

  const confirmArchiveChat = (chatId: Id<"chats">, chatName: string) => {
    if (!userId) return;

    Alert.alert(
      'Delete chat for me?',
      `Old messages with ${chatName} will be hidden only for you. New messages will show this chat again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            archiveChatForUser({ chatId, userId }).catch((e: unknown) => {
              console.error('Failed to delete chat for user', e);
              Alert.alert('Could not delete chat', 'Please try again.');
            });
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => router.push('/scan')}
      >
        <Text style={styles.scanButtonText}>Scan QR to Chat</Text>
      </TouchableOpacity>

      {chats === undefined ? (
        <Text style={styles.loading}>Loading chats...</Text>
      ) : chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No chats yet.</Text>
          <Text style={styles.emptySubtext}>{"Scan a friend's QR code to start."}</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const hasUnread = item.hasUnread ?? false;

            return (
              <TouchableOpacity
                style={[styles.chatItem, hasUnread && styles.unreadChatItem]}
                onPress={() => router.push(`/chat/${item._id}`)}
                onLongPress={() =>
                  confirmArchiveChat(item._id, item.otherUser?.name || 'this user')
                }
                delayLongPress={300}
              >
                {hasUnread && <View style={styles.unreadAccent} />}
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.otherUser?.name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.chatInfo}>
                  <Text style={[styles.chatName, hasUnread && styles.unreadText]}>
                    {item.otherUser?.name || 'Unknown User'}
                  </Text>
                  <Text style={[styles.lastMessage, hasUnread && styles.unreadText]} numberOfLines={1}>
                    {item.lastMessage?.content || (item.lastMessage?.type === 'image' ? 'Image' : 'Start chatting')}
                  </Text>
                </View>
                {hasUnread && (
                  <View style={styles.unreadDot} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scanButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loading: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
    position: 'relative',
  },
  unreadChatItem: {
    backgroundColor: '#F2FBF8',
  },
  unreadAccent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#00A884',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555',
  },
  chatInfo: {
    flex: 1,
    marginRight: 12,
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  unreadText: {
    fontWeight: 'bold',
    color: '#111',
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00A884',
  },
});
