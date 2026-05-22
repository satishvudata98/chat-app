import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useMutation } from 'convex/react';
// @ts-ignore
import { api } from '../convex/_generated/api';
import { generateKeyPair } from '../utils/crypto';

type UserContextType = {
  userId: string | null;
  setUserId: (id: string | null) => void;
  isLoading: boolean;
  privateKey: string | null;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  // @ts-ignore
  const storePublicKey = useMutation(api.users.storePublicKey);

  const initCryptoKeys = useCallback(async (id: string) => {
    let pk = await SecureStore.getItemAsync('encryptionPrivateKey');
    let pubKey = await SecureStore.getItemAsync('encryptionPublicKey');
    if (!pk || !pubKey) {
      const kp = generateKeyPair();
      pk = kp.privateKey;
      pubKey = kp.publicKey;
      await SecureStore.setItemAsync('encryptionPrivateKey', pk);
      await SecureStore.setItemAsync('encryptionPublicKey', pubKey);
    }
    setPrivateKey(pk);
    storePublicKey({ userId: id, publicKey: pubKey }).catch(() => {});
  }, [storePublicKey]);

  useEffect(() => {
    async function loadUser() {
      try {
        const id = await SecureStore.getItemAsync('userId');
        if (id) {
          setUserIdState(id);
          await initCryptoKeys(id);
        }
      } catch (e) {
        console.error('Failed to load user ID', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [initCryptoKeys]);

  const setUserId = async (id: string | null) => {
    try {
      if (id) {
        await SecureStore.setItemAsync('userId', id);
        await initCryptoKeys(id);
      } else {
        await SecureStore.deleteItemAsync('userId');
        setPrivateKey(null);
      }
      setUserIdState(id);
    } catch (e) {
      console.error('Failed to save user ID', e);
    }
  };

  return (
    <UserContext.Provider value={{ userId, setUserId, isLoading, privateKey }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
