import type { DeviceInfo } from '@zinu/shared';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import { APP_VERSION } from './config';
import { SecureKeys, secure } from './storage';

let cached: string | null = null;

/** Stable per-install identifier used to bind auth sessions to a device. Not a hardware identifier. */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await secure.get(SecureKeys.deviceId);
  if (!id) {
    id = `${Platform.OS}-${randomUUID()}`;
    await secure.set(SecureKeys.deviceId, id);
  }
  cached = id;
  return id;
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  return {
    deviceId: await getDeviceId(),
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    appVersion: APP_VERSION,
  };
}
