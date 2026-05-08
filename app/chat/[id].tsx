import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Modal, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery, useMutation, usePaginatedQuery } from 'convex/react';
// @ts-ignore
import { api } from '../../convex/_generated/api';
import { useUser } from '../../store/UserContext';
import { Id } from '../../convex/_generated/dataModel';
import { useAppTheme } from '../../store/ThemeContext';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { colors: theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useUser();
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [optionsMessage, setOptionsMessage] = useState<any | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // @ts-ignore
  const chatDetails = useQuery(
    api.messages.getChatDetails,
    id && userId ? { chatId: id as Id<"chats">, userId } : 'skip',
  );
  // @ts-ignore
  const {
    results: messages,
    status: messageStatus,
    loadMore,
  } = usePaginatedQuery(
    api.messages.getMessages,
    id && userId ? { chatId: id as Id<"chats">, viewerUserId: userId } : 'skip',
    { initialNumItems: 30 },
  );
  // @ts-ignore
  const sendMessage = useMutation(api.messages.sendMessage);
  // @ts-ignore
  const editMessage = useMutation(api.messages.editMessage);
  // @ts-ignore
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  // @ts-ignore
  const markChatRead = useMutation(api.messages.markChatRead);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: chatDetails?.otherUser?.name || 'Chat' });
  }, [chatDetails?.otherUser?.name, navigation]);

  useEffect(() => {
    if (!userId || !id || messageStatus === 'LoadingFirstPage') return;

    markChatRead({
      chatId: id as Id<"chats">,
      userId,
    }).catch((e) => console.error("Failed to mark chat read", e));
  }, [id, userId, messages.length, messageStatus, markChatRead]);

  const handleSend = async () => {
    if (!text.trim() || !userId) return;

    const content = text.trim();
    setText('');

    try {
      if (editingMessageId) {
        await editMessage({
          messageId: editingMessageId as Id<"messages">,
          senderId: userId!,
          content,
        });
        setEditingMessageId(null);
      } else {
        await sendMessage({
          chatId: id as Id<"chats">,
          senderId: userId!,
          type: "text",
          content,
          replyToId: replyingToMessage?._id,
        });
        setReplyingToMessage(null);
      }
    } catch (e) {
      console.error("Failed to send/edit message", e);
    }
  };

  const handleLongPress = (item: any) => {
    setOptionsMessage(item);
  };

  const handleReply = () => {
    setReplyingToMessage(optionsMessage);
    setEditingMessageId(null);
    setOptionsMessage(null);
  };

  const handleEdit = () => {
    setText(optionsMessage.content);
    setEditingMessageId(optionsMessage._id);
    setReplyingToMessage(null);
    setOptionsMessage(null);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, // Show native crop/rotate UI as requested
      quality: 0.8,
    });

    if (!result.canceled) {
      setPendingImage(result.assets[0].uri);
      setCaption(''); // clear previous caption
    }
  };

  const confirmAndSendImage = async () => {
    if (!pendingImage || !userId) return;
    setIsUploading(true);
    try {
      const postUrl = await generateUploadUrl();
      const response = await fetch(pendingImage);
      const blob = await response.blob();

      const uploadResult = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || "image/jpeg" },
        body: blob,
      });

      const { storageId } = await uploadResult.json();

      await sendMessage({
        chatId: id as Id<"chats">,
        senderId: userId!,
        type: "image",
        content: caption.trim(),
        fileId: storageId,
      });

      setPendingImage(null);
      setCaption('');
    } catch (e) {
      console.error("Failed to upload image", e);
      alert("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();

    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0 && now.getDate() === date.getDate()) {
      return 'Today';
    } else if (diffDays === 1 || (diffDays === 0 && now.getDate() !== date.getDate())) {
      return 'Yesterday';
    } else if (now.getFullYear() === date.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    }
  };

  const reversedMessages = messages;
  const keyboardCushion = keyboardHeight > 0 ? 8 : 0;
  const composerBottomOffset = Math.max(keyboardHeight - insets.bottom + keyboardCushion, 0);

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const isMe = item.senderId === userId;
    const timeString = new Date(item._creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let showDateHeader = false;
    if (index === reversedMessages.length - 1) {
      showDateHeader = true;
    } else {
      const currentDate = new Date(item._creationTime).toDateString();
      const olderDate = new Date(reversedMessages[index + 1]._creationTime).toDateString();
      if (currentDate !== olderDate) {
        showDateHeader = true;
      }
    }

    return (
      <View>
        <TouchableOpacity onLongPress={() => handleLongPress(item)} activeOpacity={0.8} delayLongPress={250}>
          <View
            style={[
              styles.messageBubble,
              isMe ? styles.myMessage : styles.theirMessage,
              {
                backgroundColor: isMe ? theme.outgoingBubble : theme.incomingBubble,
                borderColor: isMe ? theme.outgoingBubble : theme.incomingBubble,
              },
            ]}
          >
            {item.repliedMessage && (
              <View style={[styles.replyPreviewBubble, { borderLeftColor: theme.primary }]}>
                <Text style={[styles.replyPreviewText, { color: isMe ? 'rgba(255,255,255,0.84)' : theme.textSecondary }]} numberOfLines={2}>{item.repliedMessage.content}</Text>
              </View>
            )}

            {item.type === 'text' ? (
              <Text style={[styles.messageText, { color: isMe ? theme.outgoingText : theme.text }]}>
                {item.content}
              </Text>
            ) : item.url ? (
              <TouchableOpacity onPress={() => setViewingImage(item.url)} activeOpacity={0.8}>
                <Image source={{ uri: item.url }} style={{ width: 220, height: 220, borderRadius: 8, marginBottom: 4 }} resizeMode="cover" />
                {item.content ? (
                  <Text style={[styles.messageText, { color: isMe ? theme.outgoingText : theme.text }]}>
                    {item.content}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ) : (
              <Text style={[styles.messageText, { color: theme.text }]}>Loading image...</Text>
            )}

            <View style={{ flexDirection: 'row', alignSelf: 'flex-end', marginTop: 4, alignItems: 'center' }}>
              {item.isEdited && <Text style={[styles.timestamp, { color: isMe ? 'rgba(255,255,255,0.78)' : theme.textSecondary, marginRight: 4 }]}>Edited</Text>}
              <Text style={[styles.timestamp, { color: isMe ? 'rgba(255,255,255,0.78)' : theme.textSecondary, marginTop: 0 }]}>
                {timeString}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {showDateHeader && (
          <View style={[styles.dateHeaderContainer, { backgroundColor: theme.panel }]}>
            <Text style={[styles.dateHeaderText, { color: theme.textSecondary }]}>{formatDate(item._creationTime)}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.chatBackground }]} edges={['bottom']}>
      <View style={[styles.container, { backgroundColor: theme.chatBackground }]}>
      <FlatList
        inverted
        data={reversedMessages}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.messagesContainer}
        onEndReached={() => {
          if (messageStatus === 'CanLoadMore') {
            loadMore(30);
          }
        }}
        onEndReachedThreshold={0.2}
        ListFooterComponent={
          messageStatus === 'LoadingMore' ? (
            <ActivityIndicator color="#00A884" style={styles.loadingMore} />
          ) : null
        }
      />

      <View
        style={[
          styles.composerContainer,
          {
            backgroundColor: theme.chatBackground,
            borderTopColor: theme.border,
            marginBottom: composerBottomOffset,
          },
        ]}
      >
      {(replyingToMessage || editingMessageId) && (
        <View style={[styles.inputActionPreview, { backgroundColor: theme.panelSoft, borderLeftColor: theme.primary }]}>
          <View style={styles.inputActionLeft}>
            <Text style={[styles.inputActionTitle, { color: theme.primary }]}>
              {editingMessageId ? 'Editing Message' : 'Replying to message'}
            </Text>
            <Text style={[styles.inputActionContent, { color: theme.textSecondary }]} numberOfLines={1}>
              {editingMessageId ? text : (replyingToMessage.type === 'image' ? 'Image' : replyingToMessage.content)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setReplyingToMessage(null);
              if (editingMessageId) {
                setEditingMessageId(null);
                setText('');
              }
            }}
            style={styles.inputActionClose}
          >
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.inputContainer, { backgroundColor: theme.chatBackground }]}>
        <TouchableOpacity style={[styles.attachButton, { backgroundColor: theme.panel }]} onPress={pickImage} disabled={isUploading}>
          {isUploading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons name="image-outline" size={23} color={theme.text} />
          )}
        </TouchableOpacity>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.panel,
              borderColor: theme.panel,
              color: theme.text,
            },
          ]}
          placeholder="Type a message"
          placeholderTextColor={theme.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: text.trim() ? theme.primary : theme.panel },
          ]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Ionicons name="send-outline" size={22} color={text.trim() ? '#fff' : theme.textSecondary} />
        </TouchableOpacity>
      </View>
      </View>

      {/* Image Preview Modal before sending */}
      <Modal visible={!!pendingImage} animationType="slide" onRequestClose={() => setPendingImage(null)}>
        <SafeAreaView style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={() => setPendingImage(null)}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Image source={{ uri: pendingImage! }} style={styles.previewImage} resizeMode="contain" />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.previewInputContainer}
          >
            <TextInput
              style={styles.previewInput}
              placeholder="Add a caption..."
              placeholderTextColor="#ccc"
              value={caption}
              onChangeText={setCaption}
              multiline
            />
            <TouchableOpacity style={[styles.sendButton, { backgroundColor: theme.primary }]} onPress={confirmAndSendImage} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={19} color="#fff" />}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Full Screen Image Viewer Modal */}
      <Modal visible={!!viewingImage} transparent={true} animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <View style={styles.viewerContainer}>
          <TouchableOpacity style={styles.viewerCloseButton} onPress={() => setViewingImage(null)}>
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          <Image source={{ uri: viewingImage! }} style={styles.viewerImage} resizeMode="contain" />
        </View>
      </Modal>

      {/* Options Modal */}
      <Modal visible={!!optionsMessage} transparent={true} animationType="fade" onRequestClose={() => setOptionsMessage(null)}>
        <TouchableOpacity style={styles.optionsOverlay} activeOpacity={1} onPress={() => setOptionsMessage(null)}>
          <View style={styles.optionsSheet}>
            <TouchableOpacity style={styles.optionItem} onPress={handleReply}>
              <Text style={styles.optionText}>Reply</Text>
            </TouchableOpacity>
            {optionsMessage?.senderId === userId && optionsMessage?.type === 'text' && (Date.now() - optionsMessage?._creationTime < 600000) && (
              <TouchableOpacity style={styles.optionItem} onPress={handleEdit}>
                <Text style={styles.optionText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.optionItem, { borderBottomWidth: 0 }]} onPress={() => setOptionsMessage(null)}>
              <Text style={[styles.optionText, { color: 'red' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  loadingMore: {
    paddingVertical: 12,
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 9,
    paddingTop: 6,
    paddingBottom: 5,
    borderRadius: 7,
    marginBottom: 3,
    borderWidth: 1,
  },
  myMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 15.5,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 10.5,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  myTimestamp: {
    color: '#667781',
  },
  theirTimestamp: {
    color: '#667781',
  },
  composerContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
    alignItems: 'flex-end',
    gap: 6,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    minHeight: 44,
    maxHeight: 100,
    fontSize: 15,
    borderWidth: 1,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewHeader: {
    padding: 16,
    alignItems: 'flex-start',
  },
  closeText: {
    color: '#fff',
    fontSize: 18,
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  previewInputContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#000',
  },
  previewInput: {
    flex: 1,
    backgroundColor: '#333',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 16,
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCloseButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
  replyPreviewBubble: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#00A884',
  },
  replyPreviewText: {
    fontSize: 14,
    color: '#333',
  },
  inputActionPreview: {
    flexDirection: 'row',
    padding: 10,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  inputActionLeft: {
    flex: 1,
  },
  inputActionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  inputActionContent: {
    fontSize: 14,
  },
  inputActionClose: {
    padding: 4,
    justifyContent: 'center',
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  optionItem: {
    paddingVertical: 18,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    fontSize: 18,
    color: '#007AFF',
  },
  dateHeaderContainer: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginVertical: 10,
  },
  dateHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
