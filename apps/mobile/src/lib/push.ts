import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let registered = false;

/**
 * Registers this device for push notifications through Expo Push (FCM on Android, APNs on iOS).
 * Silently skipped where push cannot work: web, simulators, Expo Go on Android, or before the app is linked
 * to an EAS project (no projectId). The in-app notification inbox works regardless.
 */
export async function registerForPush(): Promise<void> {
  if (registered || Platform.OS === 'web' || !Device.isDevice) return;
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.info('[push] No EAS projectId configured; push registration skipped.');
    return;
  }
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'ZINU', importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.setPushToken(token.data);
    registered = true;
  } catch (e) {
    console.warn('[push] registration failed', e);
  }
}

export const resetPushRegistration = () => {
  registered = false;
};
