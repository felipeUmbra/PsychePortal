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
  const isE2E = typeof window !== 'undefined' && ((window as any).Cypress || (window as any).playwright);
  const [driveToken, setDriveTokenState] = useState<string | null>(() => {
    if (isE2E) {
      try {
        return window.sessionStorage.getItem('e2e-drive-token');
      } catch {
        return null;
      }
    }
    return null;
  });
  const [calendarToken, setCalendarTokenState] = useState<string | null>(() => {
    if (isE2E) {
      try {
        return window.sessionStorage.getItem('e2e-calendar-token');
      } catch {
        return null;
      }
    }
    return null;
  });

  const clearTokens = useCallback(() => {
    if (isE2E) {
      try {
        window.sessionStorage.removeItem('e2e-drive-token');
        window.sessionStorage.removeItem('e2e-calendar-token');
      } catch {}
    }
    setDriveTokenState(null);
    setCalendarTokenState(null);
    setDriveTokenMock(null);
    clearTokenExpiration();
  }, [isE2E]);

  const setDriveToken = useCallback(async (newToken: string | null) => {
    if (isE2E) {
      try {
        if (newToken) window.sessionStorage.setItem('e2e-drive-token', newToken);
        else window.sessionStorage.removeItem('e2e-drive-token');
      } catch {}
    }
    if (newToken && user) {
      await logAuth(user.uid, 'login');
    }
    setDriveTokenState(newToken);
    if (newToken) {
      setTokenExpiration(3600);
    }
    setDriveTokenMock(newToken);
  }, [user, isE2E]);

  const setCalendarToken = useCallback(async (newToken: string | null) => {
    if (isE2E) {
      try {
        if (newToken) window.sessionStorage.setItem('e2e-calendar-token', newToken);
        else window.sessionStorage.removeItem('e2e-calendar-token');
      } catch {}
    }
    setCalendarTokenState(newToken);
    if (newToken) {
      setTokenExpiration(3600);
    }
  }, [isE2E]);


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