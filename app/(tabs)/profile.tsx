import React, { useRef, useState } from 'react';
import { Alert, View, Text, TextInput, StyleSheet, TouchableOpacity, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '../../store/UserContext';
import { useMutation, useQuery } from 'convex/react';
// @ts-ignore
import { api } from '../../convex/_generated/api';
import { useAppTheme } from '../../store/ThemeContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { userId } = useUser();
  const { colors } = useAppTheme();
  // @ts-ignore
  const user = useQuery(api.users.getUser, userId ? { userId } : 'skip');
  // @ts-ignore
  const updateUser = useMutation(api.users.updateUser);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const qrRef = useRef<any>(null);

  if (!userId || !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Loading profile...</Text>
      </View>
    );
  }

  const siteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL || 'https://dashing-chickadee-619.convex.site';
  const shareUrl = `${siteUrl}/add?id=${userId}`;

  const shareProfileLink = async () => {
    try {
      await Share.share({
        message: `Add me on ChatNext!\n\n${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      console.error('Error sharing link:', error);
    }
  };

  const startEditing = () => {
    setEditName(user.name);
    setIsEditing(true);
  };

  const saveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Invalid name', 'Name cannot be empty.');
      return;
    }
    try {
      await updateUser({ userId, name: trimmed });
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Could not update name. Please try again.');
    }
  };

  const qrValue = `chatapp://user/${userId}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              style={[styles.editInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.panelSoft }]}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <TouchableOpacity onPress={saveName} style={[styles.editSave, { backgroundColor: colors.primary }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.editCancel}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.nameRow} onPress={startEditing} activeOpacity={0.7}>
            <Text style={[styles.name, { color: colors.text }]}>{user.name}</Text>
            <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        )}

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Scan to chat</Text>

        <View style={[styles.qrContainer, { borderColor: colors.border }]}>
          <QRCode
            getRef={(c) => (qrRef.current = c)}
            value={qrValue}
            size={200}
            color="black"
            backgroundColor="white"
          />
        </View>

        <TouchableOpacity style={[styles.shareButton, styles.shareLinkButton, { borderColor: colors.primary }]} onPress={shareProfileLink}>
          <Text style={[styles.shareLinkButtonText, { color: colors.primary }]}>Share Profile Link</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.shareButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/scan')}>
          <Ionicons name="scan-outline" size={18} color="#fff" />
          <Text style={styles.shareButtonText}>Scan QR to Connect</Text>
        </TouchableOpacity>

        <Text style={[styles.idText, { color: colors.textSecondary }]}>ID: {userId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  editInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editSave: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editCancel: {
    padding: 4,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
  },
  idText: {
    fontSize: 12,
    color: '#999',
    marginTop: 16,
  },
  shareButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  shareLinkButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    marginTop: 0,
  },
  shareLinkButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});
