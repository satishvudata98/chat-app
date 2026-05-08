import React, { useState } from 'react';
import { Alert, View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useUser } from '../../store/UserContext';
import { useAppTheme } from '../../store/ThemeContext';

export default function ChatsScreen() {
  const router = useRouter();
  const { userId } = useUser();
  const { colors } = useAppTheme();
  const [searchText, setSearchText] = useState('');
  // @ts-ignore
  const chats = useQuery(
    api.messages.listChats,
    userId ? { userId, searchText: searchText.trim() || undefined } : 'skip',
  );
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchBox, { backgroundColor: colors.panelSoft }]}>
        <Ionicons name="search" size={22} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search"
          placeholderTextColor={colors.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.searchClear}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {chats === undefined ? (
        <Text style={[styles.loading, { color: colors.textSecondary }]}>Loading chats...</Text>
      ) : chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            {searchText.trim() ? 'No chats found.' : 'No chats yet.'}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>{"Scan a friend's QR code to start."}</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const hasUnread = item.hasUnread ?? false;

            return (
              <TouchableOpacity
                style={[
                  styles.chatItem,
                  {
                    backgroundColor: hasUnread ? colors.panelSoft : colors.background,
                    borderBottomColor: colors.border,
                  },
                ]}
                onPress={() => router.push(`/chat/${item._id}`)}
                onLongPress={() =>
                  confirmArchiveChat(item._id, item.otherUser?.name || 'this user')
                }
                delayLongPress={300}
              >
                {hasUnread && <View style={[styles.unreadAccent, { backgroundColor: colors.primary }]} />}
                <View style={[styles.avatar, { backgroundColor: hasUnread ? colors.primaryDark : colors.panelSoft }]}>
                  <Text style={[styles.avatarText, { color: hasUnread ? '#fff' : colors.primary }]}>
                    {item.otherUser?.name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.chatInfo}>
                  <Text style={[styles.chatName, { color: colors.text }, hasUnread && styles.unreadText]}>
                    {item.otherUser?.name || 'Unknown User'}
                  </Text>
                  <Text style={[styles.lastMessage, { color: hasUnread ? colors.text : colors.textSecondary }, hasUnread && styles.unreadText]} numberOfLines={1}>
                    {item.lastMessage?.content || (item.lastMessage?.type === 'image' ? 'Image' : 'Start chatting')}
                  </Text>
                </View>
                {hasUnread && (
                  <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
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
  searchBox: {
    minHeight: 48,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  searchClear: {
    padding: 4,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
    position: 'relative',
  },
  unreadAccent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 19,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
    marginRight: 12,
  },
  chatName: {
    fontSize: 16.5,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  lastMessage: {
    fontSize: 15,
    color: '#666',
  },
  unreadText: {
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
