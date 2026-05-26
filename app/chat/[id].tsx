import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useAppTheme } from '../../store/ThemeContext';
import { useUser } from '../../store/UserContext';
import { encryptMessage, decryptMessage } from '../../utils/crypto';

const REPLY_SWIPE_THRESHOLD = 64;
const REPLY_SWIPE_MAX_OFFSET = 76;

function getCallMessageLabel(message: any, viewerUserId?: string | null) {
  const mode = message.callMode === 'video' ? 'video' : 'audio';
  const modeLabel = mode === 'video' ? 'video' : 'audio';
  const isMe = message.senderId === viewerUserId;

  switch (message.callStatus) {
    case 'missed':
      return isMe ? `Unanswered ${modeLabel} call` : `Missed ${modeLabel} call`;
    case 'declined':
      return `Declined ${modeLabel} call`;
    case 'failed':
      return `Failed ${modeLabel} call`;
    default:
      return isMe ? `Outgoing ${modeLabel} call` : `Incoming ${modeLabel} call`;
  }
}

function getCallMessageIcon(message: any): keyof typeof Ionicons.glyphMap {
  return message.callMode === 'video' ? 'videocam' : 'call';
}

function SwipeReplyMessage({
  children,
  iconColor,
  iconBackgroundColor,
  onReply,
}: {
  children: ReactNode;
  iconColor: string;
  iconBackgroundColor: string;
  onReply: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const iconOpacity = translateX.interpolate({
    inputRange: [0, 18, 44],
    outputRange: [0, 0.2, 1],
    extrapolate: "clamp",
  });
  const iconTranslateX = translateX.interpolate({
    inputRange: [0, REPLY_SWIPE_MAX_OFFSET],
    outputRange: [-44, 0],
    extrapolate: "clamp",
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dx > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dx <= 0) return;
          translateX.setValue(Math.min(gestureState.dx * 0.45, REPLY_SWIPE_MAX_OFFSET));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx >= REPLY_SWIPE_THRESHOLD) {
            onReply();
          }

          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 7,
            tension: 80,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 7,
            tension: 80,
          }).start();
        },
      }),
    [onReply, translateX],
  );

  return (
    <View style={styles.swipeReplyRow} {...panResponder.panHandlers}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swipeReplyIcon,
          {
            backgroundColor: iconBackgroundColor,
            opacity: iconOpacity,
            transform: [{ translateX: iconTranslateX }],
          },
        ]}
      >
        <Ionicons name="return-up-back" size={18} color={iconColor} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

function MessageSkeleton({ theme }: { theme: any }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);
  const rows = [
    { isMe: false, width: '60%' },
    { isMe: true, width: '45%' },
    { isMe: false, width: '70%' },
    { isMe: true, width: '50%' },
    { isMe: false, width: '55%' },
  ];
  return (
    <Animated.View style={{ opacity, flex: 1, padding: 12, gap: 10, justifyContent: 'flex-end' }}>
      {rows.map((row, i) => (
        <View key={i} style={{ alignSelf: row.isMe ? 'flex-end' : 'flex-start', width: row.width as any, height: 38, borderRadius: 8, backgroundColor: row.isMe ? theme.outgoingBubble : theme.incomingBubble, opacity: 0.5 }} />
      ))}
    </Animated.View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { colors: theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { userId, privateKey } = useUser();
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [optionsMessage, setOptionsMessage] = useState<any | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const lastMarkedReadKey = useRef<string | null>(null);

  // @ts-ignore
  const chatDetails = useQuery(
    api.messages.getChatDetails,
    id && userId ? { chatId: id as Id<"chats">, userId } : 'skip',
  );
  const otherPublicKey: string | null = (chatDetails as any)?.otherUser?.publicKey ?? null;
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
  const typingName = useQuery(
    // @ts-ignore
    api.typing.getTypingUsers,
    id && userId ? { chatId: id as Id<"chats">, viewerUserId: userId } : 'skip',
  );
  // @ts-ignore
  const setTypingMutation = useMutation(api.typing.setTyping);
  // @ts-ignore
  const clearTypingMutation = useMutation(api.typing.clearTyping);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // @ts-ignore
  const sendMessage = useMutation(api.messages.sendMessage);
  // @ts-ignore
  const editMessage = useMutation(api.messages.editMessage);
  // @ts-ignore
  const deleteMessage = useMutation(api.messages.deleteMessage);
  // @ts-ignore
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  // @ts-ignore
  const markChatRead = useMutation(api.messages.markChatRead);
  // @ts-ignore
  const startCall = useMutation(api.calls.startCall);
  const latestIncomingMessageId = messages.find((message: any) => message.senderId !== userId)?._id;

  const handleStartCall = useCallback(
    async (mode: "audio" | "video") => {
      if (!userId || !id) return;

      try {
        const callId = await startCall({
          chatId: id as Id<"chats">,
          callerId: userId,
          mode,
        });
        router.push(`/call/${callId}` as any);
      } catch (error) {
        console.error("Failed to start call", error);
        Alert.alert("Could not start call", "Please try again.");
      }
    },
    [id, router, startCall, userId],
  );

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
    navigation.setOptions({
      title: chatDetails?.otherUser?.name || 'Chat',
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => handleStartCall("audio")}
            disabled={!chatDetails?.otherUser}
          >
            <Ionicons name="call-outline" size={22} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => handleStartCall("video")}
            disabled={!chatDetails?.otherUser}
          >
            <Ionicons name="videocam-outline" size={23} color={theme.primary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [chatDetails?.otherUser, handleStartCall, navigation, theme.primary]);

  const markReadIfReady = useCallback(() => {
    if (!userId || !id || messageStatus === 'LoadingFirstPage') return;

    const readKey = `${id}:${latestIncomingMessageId ?? 'none'}`;
    if (lastMarkedReadKey.current === readKey) return;
    lastMarkedReadKey.current = readKey;

    markChatRead({
      chatId: id as Id<"chats">,
      userId,
    }).catch((e) => {
      lastMarkedReadKey.current = null;
      console.error("Failed to mark chat read", e);
    });
  }, [id, latestIncomingMessageId, markChatRead, messageStatus, userId]);

  useEffect(() => {
    markReadIfReady();
  }, [markReadIfReady]);

  useFocusEffect(
    useCallback(() => {
      markReadIfReady();
      // Dismiss stacked notifications for this chat when screen comes into focus
      try {
        const Notifications = require('expo-notifications');
        Notifications.dismissAllNotificationsAsync().catch(() => {});
      } catch {}
    }, [markReadIfReady]),
  );

  const handleTyping = useCallback((value: string) => {
    setText(value);
    if (!userId || !id || editingMessageId) return;
    // Debounce: only call setTyping once per 2s while user is typing
    if (!typingTimeoutRef.current) {
      setTypingMutation({ chatId: id as Id<"chats">, userId }).catch(() => {});
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
      clearTypingMutation({ chatId: id as Id<"chats">, userId }).catch(() => {});
    }, 2000);
  }, [userId, id, editingMessageId, setTypingMutation, clearTypingMutation]);

  const handleSend = async () => {
    if (!text.trim() || !userId) return;

    const rawContent = text.trim();
    setText('');
    // Clear typing on send
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;
    clearTypingMutation({ chatId: id as Id<"chats">, userId }).catch(() => {});

    const otherPublicKey = (chatDetails as any)?.otherUser?.publicKey ?? null;
    const canEncrypt = !!(otherPublicKey && privateKey);
    const content = canEncrypt ? encryptMessage(rawContent, otherPublicKey, privateKey!) : rawContent;

    try {
      if (editingMessageId) {
        await editMessage({
          messageId: editingMessageId as Id<"messages">,
          senderId: userId!,
          content,
          ...(canEncrypt ? { isEncrypted: true } : {}),
        });
        setEditingMessageId(null);
      } else {
        await sendMessage({
          chatId: id as Id<"chats">,
          senderId: userId!,
          type: "text",
          content,
          replyToId: replyingToMessage?._id,
          ...(canEncrypt ? { isEncrypted: true } : {}),
        });
        setReplyingToMessage(null);
      }
    } catch (e) {
      console.error("Failed to send/edit message", e);
      Alert.alert('Error', editingMessageId ? 'Could not edit message. Please try again.' : 'Message failed to send. Please try again.');
    }
  };

  const handleLongPress = (item: any) => {
    if (item.type === 'call') return;
    setOptionsMessage(item);
  };

  const handleReply = () => {
    setReplyingToMessage(optionsMessage);
    setEditingMessageId(null);
    setOptionsMessage(null);
  };

  const handleSwipeReply = useCallback((message: any) => {
    if (message.type === 'call') return;
    setReplyingToMessage(message);
    setEditingMessageId(null);
    setOptionsMessage(null);
  }, []);

  const handleEdit = () => {
    const rawContent = optionsMessage.isEncrypted && otherPublicKey && privateKey
      ? (decryptMessage(optionsMessage.content, otherPublicKey, privateKey) ?? optionsMessage.content)
      : optionsMessage.content;
    setText(rawContent);
    setEditingMessageId(optionsMessage._id);
    setReplyingToMessage(null);
    setOptionsMessage(null);
  };

  const handleDelete = () => {
    const msg = optionsMessage;
    setOptionsMessage(null);
    Alert.alert('Delete message', 'This message will be deleted for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMessage({ messageId: msg._id, senderId: userId! }).catch(() => {
            Alert.alert('Error', 'Could not delete message. Please try again.');
          });
        },
      },
    ]);
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
      Alert.alert('Upload failed', 'Could not send image. Please try again.');
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

  const isLoadingMessages = messageStatus === 'LoadingFirstPage';
  const reversedMessages = messages;
  const keyboardCushion = keyboardHeight > 0 ? 10 : 0;
  const composerBottomOffset = Math.max(keyboardHeight - insets.bottom + keyboardCushion, 0);

  const renderItem = ({ item, index }: { item: any, index: number }) => {
    const isMe = item.senderId === userId;
    const timeString = new Date(item._creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tickColor = item.deliveryStatus === 'read' ? theme.accent : theme.textSecondary;

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

    const dateHeader = showDateHeader ? (
      <View style={[styles.dateHeaderContainer, { backgroundColor: theme.panel }]}>
        <Text style={[styles.dateHeaderText, { color: theme.textSecondary }]}>{formatDate(item._creationTime)}</Text>
      </View>
    ) : null;

    if (item.type === 'call') {
      const isProblemStatus = item.callStatus === 'missed' || item.callStatus === 'declined' || item.callStatus === 'failed';
      const callColor = isProblemStatus ? '#D14343' : theme.primary;
      const callTextColor = isMe ? theme.outgoingText : theme.text;
      const callSecondaryColor = isMe ? 'rgba(255,255,255,0.78)' : theme.textSecondary;

      return (
        <View>
          <View
            style={[
              styles.callMessageBubble,
              isMe ? styles.myMessage : styles.theirMessage,
              {
                backgroundColor: isMe ? theme.outgoingBubble : theme.incomingBubble,
                borderColor: isMe ? theme.outgoingBubble : theme.incomingBubble,
              },
            ]}
          >
            <View style={[styles.callMessageIcon, { backgroundColor: isMe ? 'rgba(255,255,255,0.16)' : theme.panelSoft }]}>
              <Ionicons name={getCallMessageIcon(item)} size={17} color={callColor} />
            </View>
            <View style={styles.callMessageTextBlock}>
              <Text style={[styles.callMessageTitle, { color: callTextColor }]} numberOfLines={1}>
                {getCallMessageLabel(item, userId)}
              </Text>
              <Text style={[styles.timestamp, { color: callSecondaryColor, marginTop: 1 }]}>
                {timeString}
              </Text>
            </View>
          </View>
          {dateHeader}
        </View>
      );
    }

    if (item.isDeleted) {
      return (
        <View>
          <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage, { backgroundColor: 'transparent', borderColor: theme.border }]}>
            <Text style={{ color: theme.textSecondary, fontStyle: 'italic', fontSize: 14 }}>This message was deleted</Text>
          </View>
          {dateHeader}
        </View>
      );
    }

    return (
      <View>
        <SwipeReplyMessage
          iconColor={theme.primary}
          iconBackgroundColor={theme.panel}
          onReply={() => handleSwipeReply(item)}
        >
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
                  <Text style={[styles.replyPreviewText, { color: isMe ? 'rgba(255,255,255,0.84)' : theme.textSecondary, fontStyle: item.repliedMessage.content == null ? 'italic' : 'normal' }]} numberOfLines={2}>
                    {item.repliedMessage.content == null
                      ? 'This message was deleted'
                      : item.repliedMessage.isEncrypted && otherPublicKey && privateKey
                        ? (decryptMessage(item.repliedMessage.content, otherPublicKey, privateKey) ?? item.repliedMessage.content)
                        : item.repliedMessage.content}
                  </Text>
                </View>
              )}

              {item.type === 'text' ? (
                <Text style={[styles.messageText, { color: isMe ? theme.outgoingText : theme.text }]}>
                  {item.isEncrypted && otherPublicKey && privateKey
                    ? (decryptMessage(item.content, otherPublicKey, privateKey) ?? item.content)
                    : item.content}
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
                {isMe && (
                  <Ionicons
                    name={item.deliveryStatus === 'read' ? 'checkmark-done' : 'checkmark'}
                    size={14}
                    color={tickColor}
                    style={styles.messageTick}
                  />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </SwipeReplyMessage>

        {dateHeader}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.chatBackground }]} edges={['bottom']}>
      <View style={[styles.container, { backgroundColor: theme.chatBackground }]}>
      {isLoadingMessages ? (
        <MessageSkeleton theme={theme} />
      ) : (
        <FlatList
          inverted
          style={styles.messageList}
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
      )}

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
      {!!typingName && (
        <View style={[styles.typingBubble, { backgroundColor: theme.panelSoft }]}>
          <Text style={[styles.typingText, { color: theme.textSecondary }]}>{typingName} is typing...</Text>
        </View>
      )}

      {(replyingToMessage || editingMessageId) && (
        <View style={[styles.inputActionPreview, { backgroundColor: theme.panelSoft, borderLeftColor: theme.primary }]}>
          <View style={styles.inputActionLeft}>
            <Text style={[styles.inputActionTitle, { color: theme.primary }]}>
              {editingMessageId ? 'Editing Message' : 'Replying to message'}
            </Text>
            <Text style={[styles.inputActionContent, { color: theme.textSecondary }]} numberOfLines={1}>
              {editingMessageId ? text : (replyingToMessage.type === 'image' ? 'Image' : replyingToMessage.type === 'call' ? getCallMessageLabel(replyingToMessage, userId) : replyingToMessage.content)}
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
          onChangeText={handleTyping}
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
            {optionsMessage?.senderId === userId && optionsMessage?.type !== 'call' && (
              <TouchableOpacity style={styles.optionItem} onPress={handleDelete}>
                <Text style={[styles.optionText, { color: '#E53935' }]}>Delete</Text>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
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
  swipeReplyRow: {
    position: 'relative',
    overflow: 'hidden',
  },
  swipeReplyIcon: {
    position: 'absolute',
    top: 12,
    left: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
  messageTick: {
    marginLeft: 2,
    marginTop: 1,
  },
  callMessageBubble: {
    maxWidth: '76%',
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
    marginBottom: 3,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callMessageIcon: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callMessageTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  callMessageTitle: {
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '600',
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
  typingBubble: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  typingText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
