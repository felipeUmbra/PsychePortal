import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Cookie } from 'lucide-react';

export default function CookieConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie_consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border-custom shadow-lg px-4 py-3 sm:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 rounded-full bg-primary-custom/10 flex items-center justify-center text-primary-custom shrink-0">
            <Cookie className="w-4 h-4" />
          </div>
          <p className="text-[13px] text-text-main">
            {t('cookies.message', 'This site uses cookies to improve your experience. By continuing, you agree to our Privacy Policy.')}{' '}
            <Link to="/privacy" className="text-primary-custom font-semibold hover:underline">
              {t('cookies.policy', 'Privacy Policy')}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDecline}
            className="px-4 py-1.5 text-[13px] font-bold text-text-muted hover:text-text-main border border-border-custom rounded-lg hover:bg-bg transition-colors"
          >
            {t('cookies.decline', 'Decline')}
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-1.5 text-[13px] font-bold text-white bg-primary-custom hover:bg-primary-custom/90 rounded-lg transition-colors"
          >
            {t('cookies.accept', 'Accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
