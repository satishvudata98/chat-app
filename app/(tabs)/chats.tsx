import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
// @ts-ignore
import { api } from '../../convex/_generated/api';
import { useUser } from '../../store/UserContext';

export default function ChatsScreen() {
  const router = useRouter();
  const { userId } = useUser();
  // @ts-ignore
  const chats = useQuery(api.messages.listChats, userId ? { userId } : 'skip');

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.scanButton}
        onPress={() => router.push('/scan')}
      >
        <Text style={styles.scanButtonText}>📷 Scan QR to Chat</Text>
      </TouchableOpacity>

      {chats === undefined ? (
        <Text style={styles.loading}>Loading chats...</Text>
      ) : chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No chats yet.</Text>
          <Text style={styles.emptySubtext}>Scan a friend's QR code to start.</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.chatItem}
              onPress={() => router.push(`/chat/${item._id}`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.otherUser?.name?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>{item.otherUser?.name || 'Unknown User'}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage?.content || (item.lastMessage?.type === 'image' ? '📷 Image' : 'Start chatting')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
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
});
