import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { setDriveToken as setDriveTokenMock } from '../lib/firestore-mock';
import { logAuth } from '../lib/audit';
import { setTokenExpiration, clearTokenExpiration } from '../lib/token-expiration';



interface GoogleAuthContextType {
  driveToken: string | null;
  calendarToken: string | null;
  setDriveToken: (token: string | null) => Promise<void>; // Changed to async
  setCalendarToken: (token: string | null) => Promise<void>; // Changed to async
  clearTokens: () => void;
  isAuthenticated: boolean;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [user] = useAuthState(auth);
  // OAuth tokens are held in React state only. They are never written to
  // sessionStorage, so no ciphertext/key pair can be harvested from storage.
  // Users re-authorize after a page reload — the accepted trade-off for not
  // storing reusable Google credentials where any in-page script can read them.
  const [driveToken, setDriveTokenState] = useState<string | null>(null);
  const [calendarToken, setCalendarTokenState] = useState<string | null>(null);

  const clearTokens = useCallback(() => {
    setDriveTokenState(null);
    setCalendarTokenState(null);
    setDriveTokenMock(null);
    clearTokenExpiration();
  }, []);

  const setDriveToken = useCallback(async (newToken: string | null) => {
    if (newToken && user) {
      await logAuth(user.uid, 'login');
    }
    setDriveTokenState(newToken);
    if (newToken) {
      setTokenExpiration(3600);
    }
    setDriveTokenMock(newToken);
  }, []);

  const setCalendarToken = useCallback(async (newToken: string | null) => {
    setCalendarTokenState(newToken);
    if (newToken) {
      setTokenExpiration(3600);
    }
  }, []);


  // Sync Drive token into the mock persistence module after each change.
  useEffect(() => {
    if (driveToken) {
      setDriveTokenMock(driveToken);
    }
  }, [driveToken]);


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