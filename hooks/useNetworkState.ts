import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export function useNetworkState() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!cancelled) {
          setIsOnline(state.isInternetReachable !== false);
        }
      } catch {
        // If the API fails, assume online to avoid false positives
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return isOnline;
}
