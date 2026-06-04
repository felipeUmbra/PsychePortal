import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from './locales/en/translation.json';
import ptTranslations from './locales/pt/translation.json';

// Determine initial language
const detectedLanguage = (typeof navigator !== 'undefined' && navigator.language?.split('-')[0]) || 'pt';
const initialLng = detectedLanguage === 'en' ? 'en' : 'pt';

// Initialize i18n
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: initialLng,
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: { translation: enTranslations },
      pt: { translation: ptTranslations }
    },
  });

// Custom language change function
export const changeLanguage = async (lng: string) => {
  return i18n.changeLanguage(lng);
};

export default i18n;
