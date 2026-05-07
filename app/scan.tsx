import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
// @ts-ignore
import { api } from '../convex/_generated/api';
import { useUser } from '../store/UserContext';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const router = useRouter();
  const { userId } = useUser();
  // @ts-ignore
  const getOrCreateChat = useMutation(api.messages.getOrCreateChat);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>
          We need your permission to show the camera
        </Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);
    try {
      // Expected format: chatapp://user/uuid or just uuid
      let scannedUserId = data;
      if (data.startsWith('chatapp://user/')) {
        scannedUserId = data.replace('chatapp://user/', '');
      } else if (data.startsWith('myapp://user/')) {
        scannedUserId = data.replace('myapp://user/', '');
      }

      if (scannedUserId === userId) {
        alert("You can't chat with yourself!");
        setTimeout(() => setScanned(false), 2000);
        return;
      }

      const chatId = await getOrCreateChat({
        myUserId: userId!,
        otherUserId: scannedUserId,
      });

      router.replace(`/chat/${chatId}`);
    } catch (e) {
      console.error(e);
      alert('Invalid QR Code');
      setTimeout(() => setScanned(false), 2000);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      {scanned && (
        <View style={styles.scannedOverlay}>
          <Text style={styles.scannedText}>Processing...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  scannedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannedText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
