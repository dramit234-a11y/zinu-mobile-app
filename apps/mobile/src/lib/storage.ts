import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Secrets (refresh token, device id) go to the iOS Keychain / Android Keystore via SecureStore.
 * On web (development preview only) SecureStore is unavailable, so localStorage is used.
 */
export const secure = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === 'web') return globalThis.localStorage?.setItem(key, value);
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  },
  async remove(key: string) {
    if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  },
};

/** Non-sensitive preferences. */
export const prefs = {
  get: (key: string) => AsyncStorage.getItem(`zinu.${key}`),
  set: (key: string, value: string) => AsyncStorage.setItem(`zinu.${key}`, value),
  remove: (key: string) => AsyncStorage.removeItem(`zinu.${key}`),
};

export const PrefKeys = {
  language: 'language',
  onboardingSeen: 'onboardingSeen',
  activeMode: 'activeMode',
  locationAsked: 'locationAsked',
} as const;

export const SecureKeys = {
  refreshToken: 'zinu_refresh_token',
  deviceId: 'zinu_device_id',
} as const;
