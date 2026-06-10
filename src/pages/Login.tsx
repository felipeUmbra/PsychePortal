import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, setDriveToken as setMockToken, forceSync } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useGoogleAuth } from '../context/GoogleAuthContext';

export const googleScopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file'
];

export default function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setDriveToken, setCalendarToken } = useGoogleAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      setMockToken(null);
      setDriveToken(null);
      setCalendarToken(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'consent' });
      googleScopes.forEach(scope => provider.addScope(scope));

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Save the OAuth token for Google APIs
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        // Note: setMockToken internally calls forceSync now, 
        // but we await it here to ensure the profile check uses fresh data.
        setMockToken(credential.accessToken);
        setDriveToken(credential.accessToken);
        setCalendarToken(credential.accessToken);
        await forceSync();
      }

      // Check if psychologist profile exists, if not create it
      const docRef = doc(db, 'psychologists', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          id: user.uid,
          name: user.displayName || 'New Psychologist',
          email: user.email,
          specialization: [],
          bio: '',
          avatarUrl: user.photoURL || '',
          createdAt: new Date().toISOString()
        });
      }

      navigate('/app');
    } catch (err: any) {
      // Don't show error if user just closed the popup
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        console.error('Login failed:', err);
        const errorMessages: Record<string, string> = {
          'auth/network-request-failed': t('login.error_network', 'Network error. Please check your connection.'),
          'auth/too-many-requests': t('login.error_rate_limit', 'Too many attempts. Please try again later.'),
          'auth/user-disabled': t('login.error_user_disabled', 'This account has been disabled.'),
          'auth/operation-not-allowed': t('login.error_operation_not_allowed', 'Operation not allowed.'),
        };
        setError(errorMessages[err.code] || t('login.error_fallback', 'An error occurred. Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-surface rounded-sm shadow-xl shadow-primary-custom/5 border border-border-custom p-10 text-center"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-[#897fff] rounded-sm flex items-center justify-center shadow-lg shadow-primary-custom/20">
            <img src="/logo.png?v=2" alt="Portal Psis" className="w-10 h-10" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-text-main tracking-tight mb-2">Portal Psis</h1>
        <p className="text-text-muted text-[15px] mb-8">{t('login.title')}</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-border-custom text-text-main font-bold py-3.5 px-4 rounded-sm hover:bg-bg hover:border-primary-custom/30 transition-all duration-200 shadow-sm group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary-custom" />
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                {t('login.sign_in')}
              </>
            )}
          </button>
        </div>

        <div className="mt-10 pt-8 border-t border-border-custom">
          <p className="text-[12px] text-text-muted font-medium leading-relaxed">
            {t('login.secure_text_1')}
            <Link to="/terms" className="text-primary-custom hover:underline">{t('login.terms')}</Link>
            {t('login.secure_text_2')}
          </p>
        </div>

      </motion.div>
    </div>
  );
}
