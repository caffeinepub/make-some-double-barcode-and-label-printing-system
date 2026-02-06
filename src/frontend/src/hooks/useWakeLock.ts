import { useEffect, useState, useRef } from 'react';

interface WakeLockState {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
}

export function useWakeLock() {
  const [state, setState] = useState<WakeLockState>({
    isSupported: false,
    isActive: false,
    error: null,
  });

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = async () => {
    // Check if Wake Lock API is supported
    if (!('wakeLock' in navigator)) {
      const errorMsg = 'Wake Lock API is not supported in this browser';
      console.warn(errorMsg);
      setState({
        isSupported: false,
        isActive: false,
        error: errorMsg,
      });
      return false;
    }

    try {
      // Request a screen wake lock
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      
      console.log('Wake Lock activated successfully');
      
      setState({
        isSupported: true,
        isActive: true,
        error: null,
      });

      // Listen for wake lock release
      wakeLockRef.current.addEventListener('release', () => {
        console.log('Wake Lock released');
        setState(prev => ({
          ...prev,
          isActive: false,
        }));
      });

      return true;
    } catch (err: any) {
      const errorMsg = `Wake Lock request failed: ${err.message}`;
      console.error(errorMsg);
      
      setState({
        isSupported: true,
        isActive: false,
        error: errorMsg,
      });
      
      return false;
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake Lock manually released');
      } catch (err: any) {
        console.error('Failed to release Wake Lock:', err);
      }
    }
  };

  useEffect(() => {
    // Initial wake lock request
    requestWakeLock();

    // Handle visibility change to reacquire wake lock
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, reacquiring Wake Lock');
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, []);

  return {
    ...state,
    requestWakeLock,
    releaseWakeLock,
  };
}
