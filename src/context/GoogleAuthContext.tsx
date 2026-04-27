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
