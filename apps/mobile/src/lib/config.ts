import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL. Set EXPO_PUBLIC_API_URL in apps/mobile/.env (e.g. http://192.168.1.20:4000 when testing on a phone).
 * Only public values belong here — the app bundle is readable by anyone. Secrets live on the server.
 */
function defaultApiUrl() {
  // Android emulator reaches the host machine through 10.0.2.2.
  if (Platform.OS === 'android' && !Constants.isDevice) return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || defaultApiUrl()).replace(/\/$/, '');
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
