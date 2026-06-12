import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { setDriveToken as setDriveTokenMock } from '../lib/firestore-mock';

const DRIVE_TOKEN_STORAGE_KEY = 'google_drive_token';
const CALENDAR_TOKEN_STORAGE_KEY = 'google_calendar_token';

interface GoogleAuthContextType {
  driveToken: string | null;
  calendarToken: string | null;
  setDriveToken: (token: string | null) => void;
  setCalendarToken: (token: string | null) => void;
  clearTokens: () => void;
  isAuthenticated: boolean;
}

const getSessionStorageItem = (key: string): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const setSessionStorageItem = (key: string, value: string | null) => {
  if (typeof window === 'undefined') return;

  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors. Token state will still work in memory for the current session.
  }
};

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [user] = useAuthState(auth);
  const [driveToken, setDriveTokenState] = useState<string | null>(() => getSessionStorageItem(DRIVE_TOKEN_STORAGE_KEY));
  const [calendarToken, setCalendarTokenState] = useState<string | null>(() => getSessionStorageItem(CALENDAR_TOKEN_STORAGE_KEY));

  const clearTokens = useCallback(() => {
    setDriveTokenState(null);
    setCalendarTokenState(null);
    setSessionStorageItem(DRIVE_TOKEN_STORAGE_KEY, null);
    setSessionStorageItem(CALENDAR_TOKEN_STORAGE_KEY, null);
    setDriveTokenMock(null);
  }, []);

  const setDriveToken = useCallback((newToken: string | null) => {
    setDriveTokenState(newToken);
    setSessionStorageItem(DRIVE_TOKEN_STORAGE_KEY, newToken);
    setDriveTokenMock(newToken);
  }, []);

  const setCalendarToken = useCallback((newToken: string | null) => {
    setCalendarTokenState(newToken);
    setSessionStorageItem(CALENDAR_TOKEN_STORAGE_KEY, newToken);
  }, []);

  // Sync restored Drive token into the mock module after the first render.
  useEffect(() => {
    if (driveToken) {
      setDriveTokenMock(driveToken);
    }
  }, [driveToken]);

  // Restore tokens from sessionStorage on mount (page reloads clear React state)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDriveToken = sessionStorage.getItem(DRIVE_TOKEN_STORAGE_KEY);
      if (savedDriveToken) {
        setDriveTokenState(savedDriveToken);
      }
      const savedCalendarToken = sessionStorage.getItem(CALENDAR_TOKEN_STORAGE_KEY);
      if (savedCalendarToken) {
        setCalendarTokenState(savedCalendarToken);
      }
    }
  }, []);

  // Expose token setters to window for E2E testing
  useEffect(() => {
    if (import.meta.env.DEV && typeof window !== 'undefined' && (window as any).Cypress) {
      (window as any).setTestTokens = (tokens: { driveToken: string | null, calendarToken: string | null }) => {
        setDriveToken(tokens.driveToken);
        setCalendarToken(tokens.calendarToken);
      };
      (window as any).clearTestTokens = clearTokens;
    }
  }, [setDriveToken, setCalendarToken, clearTokens]);

  // Inactivity timer to clear tokens after 30 minutes
  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        clearTokens();
      }, 30 * 60 * 1000); // 30 minutes
    };

    // Reset timer on user activity
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    // Initial reset
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [clearTokens]);

  useEffect(() => {
    if (!user) {
      clearTokens();
    }
  }, [user, clearTokens]);

  return (
    <GoogleAuthContext.Provider value={{
      driveToken,
      calendarToken,
      setDriveToken,
      setCalendarToken,
      clearTokens,
      isAuthenticated: !!driveToken
    }}>
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}