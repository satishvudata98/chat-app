import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

type UserContextType = {
  userId: string | null;
  setUserId: (id: string | null) => void;
  isLoading: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const id = await SecureStore.getItemAsync('userId');
        if (id) {
          setUserIdState(id);
        }
      } catch (e) {
        console.error('Failed to load user ID', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const setUserId = async (id: string | null) => {
    try {
      if (id) {
        await SecureStore.setItemAsync('userId', id);
      } else {
        await SecureStore.deleteItemAsync('userId');
      }
      setUserIdState(id);
    } catch (e) {
      console.error('Failed to save user ID', e);
    }
  };

  return (
    <UserContext.Provider value={{ userId, setUserId, isLoading }}>
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
