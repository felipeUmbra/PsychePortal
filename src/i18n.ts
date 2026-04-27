import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Dynamic import function for loading translation JSON files
const loadTranslations = async (language: string) => {
  try {
    // Dynamic import - Vite will handle code splitting for these JSON files
    const module = await import(`./locales/${language}/translation.json`);
    return module.default;
  } catch (error) {
    console.warn(`Failed to load translations for ${language}, falling back to pt`);
    const module = await import('./locales/pt/translation.json');
    return module.default;
  }
};

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
    // Start with empty resources, will be populated dynamically
    resources: {},
  });

// Load initial translations and wait for them
const initializeTranslations = async () => {
  const resources = await loadTranslations(initialLng);
  i18n.addResourceBundle(initialLng, 'translation', resources, true, true);
};

initializeTranslations();

// Custom language change function that properly loads resources before switching
export const changeLanguage = async (lng: string) => {
  // If resources not loaded, load them first
  if (!i18n.hasResourceBundle(lng, 'translation')) {
    const resources = await loadTranslations(lng);
    i18n.addResourceBundle(lng, 'translation', resources, true, true);
  }
  // Now change the language - this will trigger re-render with new translations
  return i18n.changeLanguage(lng);
};

// Listen for language changes and ensure resources are loaded
i18n.on('languageChanged', (lng) => {
  // This event fires after language is changed
  // If for some reason resources aren't there, load them
  if (!i18n.hasResourceBundle(lng, 'translation')) {
    loadTranslations(lng).then((resources) => {
      i18n.addResourceBundle(lng, 'translation', resources, true, true);
    });
  }
});

export default i18n;
