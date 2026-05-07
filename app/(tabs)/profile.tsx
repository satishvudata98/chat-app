import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useUser } from '../../store/UserContext';
import { useQuery } from 'convex/react';
// @ts-ignore
import { api } from '../../convex/_generated/api';

export default function ProfileScreen() {
  const { userId } = useUser();
  // @ts-ignore
  const user = useQuery(api.users.getUser, userId ? { userId } : 'skip');

  const qrRef = useRef<any>(null);

  if (!userId || !user) {
    return (
      <View style={styles.container}>
        <Text>Loading profile...</Text>
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
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.subtitle}>Scan to chat</Text>
        
        <View style={styles.qrContainer}>
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

        <TouchableOpacity style={[styles.shareButton, styles.shareLinkButton]} onPress={shareProfileLink}>
          <Text style={styles.shareLinkButtonText}>Share Profile Link</Text>
        </TouchableOpacity>

        <Text style={styles.idText}>ID: {userId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 24,
  },
  idText: {
    fontSize: 12,
    color: '#999',
    marginTop: 16,
  },
  shareButton: {
    backgroundColor: '#00A884',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  shareLinkButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00A884',
    marginTop: 0,
  },
  shareLinkButtonText: {
    color: '#00A884',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
