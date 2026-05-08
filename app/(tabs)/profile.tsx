import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '../../store/UserContext';
import { useQuery } from 'convex/react';
// @ts-ignore
import { api } from '../../convex/_generated/api';
import { useAppTheme } from '../../store/ThemeContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { userId } = useUser();
  const { colors } = useAppTheme();
  // @ts-ignore
  const user = useQuery(api.users.getUser, userId ? { userId } : 'skip');

  const qrRef = useRef<any>(null);

  if (!userId || !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Loading profile...</Text>
      </View>
    );
  }

  /*
  const shareQRCode = () => {
    if (qrRef.current) {
      qrRef.current.toDataURL(async (data: string) => {
        try {
          const filepath = FileSystem.cacheDirectory + 'qrcode.png';
          await FileSystem.writeAsStringAsync(filepath, data, {
            encoding: 'base64',
          });
          
          await Sharing.shareAsync(filepath, {
            mimeType: 'image/png',
            dialogTitle: 'Share your ChatNext QR Code',
            UTI: 'public.png',
          });
        } catch (error) {
          console.error('Error sharing QR code:', error);
        }
      });
    }
  };
  */

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

  const qrValue = `chatapp://user/${userId}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}>
        <Text style={[styles.name, { color: colors.text }]}>{user.name}</Text>
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

        {/* 
        <TouchableOpacity style={styles.shareButton} onPress={shareQRCode}>
          <Text style={styles.shareButtonText}>Share QR Image</Text>
        </TouchableOpacity>
        */}

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
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
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
