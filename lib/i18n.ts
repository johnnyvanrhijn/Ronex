import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from '@/i18n/en.json';
import nl from '@/i18n/nl.json';

// Detect the device language, fall back to English
const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';
const supportedLanguages = ['en', 'nl'] as const;
const resolvedLanguage = supportedLanguages.includes(deviceLanguage as any)
  ? deviceLanguage
  : 'en';

export const defaultNS = 'translation' as const;
export const resources = {
  en: { translation: en },
  nl: { translation: nl },
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: resolvedLanguage,
  fallbackLng: 'en',
  defaultNS,
  interpolation: {
    // React Native already escapes by default
    escapeValue: false,
  },
  // Suppress console warnings in production
  compatibilityJSON: 'v4',
});

export default i18n;
