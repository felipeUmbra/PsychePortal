import { initializeApp } from 'firebase/app';
import { getAuth, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// --- Mock Auth Implementation for E2E Tests ---
class MockAuth {
  private handlers = new Set<(user: User | null) => void>();

  onAuthStateChanged(handler: (user: User | null) => void) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  setUser(user: any) {
    const mockUser: User = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL || '',
      ...user
    } as User;
    this.handlers.forEach(h => h(mockUser));
  }

  signOut() {
    this.setUser(null);
  }
}

const app = initializeApp(firebaseConfig);

// Substitute real auth with MockAuth when running in Cypress
export const auth = (typeof window !== 'undefined' && (window as any).Cypress)
  ? (function() {
      const mockAuth = new MockAuth();
      (window as any).mockAuth = mockAuth;
      return mockAuth;
    })()
  : getAuth(app);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export default app;
