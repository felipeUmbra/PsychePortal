import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { setDriveToken } from '../lib/firestore-mock';

interface GoogleAuthContextType {
  driveToken: string | null;
  calendarToken: string | null;
  setDriveToken: (token: string | null) => void;
  setCalendarToken: (token: string | null) => void;
  isAuthenticated: boolean;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [user] = useAuthState(auth);
  const [driveToken, setDriveTokenState] = useState<string | null>(null);
  const [calendarToken, setCalendarTokenState] = useState<string | null>(null);

  // Persistence bridge for the mock (which runs outside React)
  const setDriveToken = (newToken: string | null) => {
    setDriveTokenState(newToken);
    setDriveTokenMock(newToken);
  };

  const setCalendarToken = (newToken: string | null) => {
    setCalendarTokenState(newToken);
  };

  // Restore tokens from sessionStorage on mount (page reloads clear React state)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = sessionStorage.getItem('google_drive_token');
      if (savedToken) {
        setDriveTokenState(savedToken);
        setCalendarTokenState(savedToken);
      }
    }
  }, []);

  // Expose token setters to window for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Cypress) {
      (window as any).setTestTokens = (tokens: { driveToken: string | null, calendarToken: string | null }) => {
        setDriveToken(tokens.driveToken);
        setCalendarToken(tokens.calendarToken);
      };
    }
  }, [setDriveToken, setCalendarToken]);

  // Inactivity timer to clear tokens after 30 minutes
  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        setDriveToken(null);
        setCalendarToken(null);
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
  }, [setDriveToken, setCalendarToken]);

  useEffect(() => {
    if (!user) {
      setDriveToken(null);
      setCalendarToken(null);
    }
  }, [user]);

  return (
    <GoogleAuthContext.Provider value={{
      driveToken,
      calendarToken,
      setDriveToken,
      setCalendarToken,
      isAuthenticated: !!driveToken
    }}>
      {children}
    </GoogleAuthContext.Provider>
  );
}

// Rename internal bridge call to avoid confusion with local state setter
import { setDriveToken as setDriveTokenMock } from '../lib/firestore-mock';

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}
