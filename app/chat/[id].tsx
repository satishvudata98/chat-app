import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Modal } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQuery, useMutation, usePaginatedQuery } from 'convex/react';
// @ts-ignore
import { api } from '../../convex/_generated/api';
import { useUser } from '../../store/UserContext';
import { Id } from '../../convex/_generated/dataModel';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const { userId } = useUser();
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [optionsMessage, setOptionsMessage] = useState<any | null>(null);

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
          <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
            {item.repliedMessage && (
              <View style={styles.replyPreviewBubble}>
                <Text style={styles.replyPreviewText} numberOfLines={2}>{item.repliedMessage.content}</Text>
              </View>
            )}

            {item.type === 'text' ? (
              <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                {item.content}
              </Text>
            ) : item.url ? (
              <TouchableOpacity onPress={() => setViewingImage(item.url)} activeOpacity={0.8}>
                <Image source={{ uri: item.url }} style={{ width: 220, height: 220, borderRadius: 8, marginBottom: 4 }} resizeMode="cover" />
                {item.content ? (
                  <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                    {item.content}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ) : (
              <Text style={styles.messageText}>Loading image...</Text>
            )}

            <View style={{ flexDirection: 'row', alignSelf: 'flex-end', marginTop: 4, alignItems: 'center' }}>
              {item.isEdited && <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp, { marginRight: 4 }]}>Edited</Text>}
              <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp, { marginTop: 0 }]}>
                {timeString}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {showDateHeader && (
          <View style={styles.dateHeaderContainer}>
            <Text style={styles.dateHeaderText}>{formatDate(item._creationTime)}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
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

      <View style={styles.composerContainer}>
      {(replyingToMessage || editingMessageId) && (
        <View style={styles.inputActionPreview}>
          <View style={styles.inputActionLeft}>
            <Text style={styles.inputActionTitle}>
              {editingMessageId ? 'Editing Message' : 'Replying to message'}
            </Text>
            <Text style={styles.inputActionContent} numberOfLines={1}>
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
            <Ionicons name="close" size={20} color="#777" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton} onPress={pickImage} disabled={isUploading}>
          {isUploading ? (
            <ActivityIndicator size="small" color="#00A884" />
          ) : (
            <Ionicons name="add" size={30} color="#00A884" />
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Type a message"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Ionicons name="send" size={19} color="#fff" />
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
            <TouchableOpacity style={styles.sendButton} onPress={confirmAndSendImage} disabled={isUploading}>
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

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#e5ddd5',
  },
  container: {
    flex: 1,
    backgroundColor: '#e5ddd5', // WhatsApp background color
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  loadingMore: {
    paddingVertical: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#dcf8c6',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#000',
  },
  theirMessageText: {
    color: '#000',
  },
  timestamp: {
    fontSize: 10,
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
    backgroundColor: '#e5ddd5',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#e5ddd5',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  attachButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#00A884',
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
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
    backgroundColor: '#f0f0f0',
    padding: 10,
    marginHorizontal: 8,
    marginTop: 8,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#00A884',
  },
  inputActionLeft: {
    flex: 1,
  },
  inputActionTitle: {
    color: '#00A884',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  inputActionContent: {
    color: '#666',
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
    backgroundColor: '#E1F3FB', // Light blue date header like WhatsApp
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  dateHeaderText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '500',
  },
});
