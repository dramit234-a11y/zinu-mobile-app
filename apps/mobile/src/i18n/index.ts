import type { Language } from '@zinu/shared';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { PrefKeys, prefs } from '../lib/storage';
import en from './en';
import hi from './hi';

/** Add a regional language: create its file, register it here and in @zinu/shared LANGUAGES. */
export const resources = { en: { translation: en }, hi: { translation: hi } } as const;

export const LANGUAGE_OPTIONS: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
];

export const deviceLanguage = (): Language => (getLocales()[0]?.languageCode === 'hi' ? 'hi' : 'en');

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export async function setLanguage(lang: Language) {
  await i18n.changeLanguage(lang);
  await prefs.set(PrefKeys.language, lang);
}

export async function loadSavedLanguage(): Promise<Language | null> {
  const saved = (await prefs.get(PrefKeys.language)) as Language | null;
  if (saved) await i18n.changeLanguage(saved);
  return saved;
}

/** Localised message for an API error code, falling back to the server's message. */
export function errorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string };
  const key = `errors.${err?.code}`;
  return err?.code && i18n.exists(key) ? i18n.t(key) : (err?.message ?? i18n.t('common.error'));
}

export default i18n;
