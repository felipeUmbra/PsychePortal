import { initializeApp } from 'firebase/app';
import { getAuth, User, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// --- Mock Auth Implementation for E2E Tests ---
export const MOCK_GOOGLE_OAUTH_TOKEN = 'mock-google-oauth-token-789';

const MOCK_GOOGLE_USER = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://via.placeholder.com/150'
};

// Persists the mocked session across page reloads, mirroring how real
// Firebase Auth restores the user from storage on startup.
const MOCK_USER_STORAGE_KEY = 'cypress-mock-user';

class MockAuth {
  private handlers = new Set<(user: User | null) => void>();
  private currentUser: User | null = (() => {
    try {
      const saved = window.sessionStorage.getItem(MOCK_USER_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as User) : null;
    } catch {
      return null;
    }
  })();

  onAuthStateChanged(handler: (user: User | null) => void) {
    // Emit current state immediately, mirroring real Firebase behavior
    handler(this.currentUser);
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  setUser(user: any) {
    if (!user) {
      this.currentUser = null;
      try {
        window.sessionStorage.removeItem(MOCK_USER_STORAGE_KEY);
      } catch { /* ignore storage errors */ }
      this.handlers.forEach(h => h(null));
      return;
    }
    const mockUser: User = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL || '',
      ...user
    } as User;
    this.currentUser = mockUser;
    try {
      window.sessionStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(mockUser));
    } catch { /* ignore storage errors */ }
    this.handlers.forEach(h => h(mockUser));
  }

  signOut() {
    this.setUser(null);
  }

  // Simulates the Google OAuth popup flow used by signInWithPopup().
  // Resolves with a UserCredential-shaped object containing a fake OAuth token,
  // so the real login code path (token storage, profile creation) is exercised.
  async signInWithPopup(_provider?: unknown) {
    const user = { ...MOCK_GOOGLE_USER } as User;
    this.setUser(user);
    return {
      user,
      providerId: 'google.com',
      operationType: 'signIn',
      _tokenResponse: {
        oauthAccessToken: MOCK_GOOGLE_OAUTH_TOKEN,
        oauthIdToken: 'mock-google-id-token',
        expiresIn: '3600',
        localId: user.uid
      }
    };
  }
}

const app = initializeApp(firebaseConfig);

// Substitute real auth with MockAuth when running in Cypress
export const auth: Auth = ((typeof window !== 'undefined' && (window as any).Cypress)
  ? (function () {
    const mockAuth = new MockAuth();
    (window as any).mockAuth = mockAuth;
    return mockAuth;
  })()
  : getAuth(app)) as Auth;

// @ts-ignore getFirestore may accept optional second arg depending on SDK version
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export default app;