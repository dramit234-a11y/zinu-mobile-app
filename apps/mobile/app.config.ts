import type { ConfigContext, ExpoConfig } from 'expo/config';
import base from './app.base.json';

/**
 * Builds the app config. Google Maps SDK keys come from the environment (EAS secrets / local .env), never source.
 * They are restricted keys (Android package + SHA-1, iOS bundle id) and only render map tiles; all
 * search/routing goes through the ZINU API, which holds the server key.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const iosKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  const expo = { ...(base.expo as unknown as ExpoConfig), ...config };
  return {
    ...expo,
    plugins: [
      ...(expo.plugins ?? []),
      ['react-native-maps', { ...(androidKey ? { androidGoogleMapsApiKey: androidKey } : {}), ...(iosKey ? { iosGoogleMapsApiKey: iosKey } : {}) }],
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'ZINU uses your location to find nearby drivers, set your pickup point and calculate your trip.',
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
    ],
    extra: {
      ...expo.extra,
      // iOS draws Google maps only when built with a Google key; otherwise Apple Maps (no Google cost).
      iosGoogleMaps: !!iosKey,
    },
  };
};
