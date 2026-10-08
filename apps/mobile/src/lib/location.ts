import * as Location from 'expo-location';
import { PrefKeys, prefs } from './storage';

export type LocationPermission = 'granted' | 'denied' | 'undetermined';

/**
 * Foreground ("while using the app") location only (spec §9). Passengers are never tracked in the background;
 * driver background location arrives with going online in Phase 4.
 */
export async function locationPermission(): Promise<LocationPermission> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

export async function requestLocationPermission(): Promise<LocationPermission> {
  await prefs.set(PrefKeys.locationAsked, '1');
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted' ? 'granted' : 'denied';
}

/** Whether to show our explanation screen before the OS prompt. */
export async function shouldExplainLocation(): Promise<boolean> {
  return (await locationPermission()) === 'undetermined' && !(await prefs.get(PrefKeys.locationAsked));
}

export async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  if ((await locationPermission()) !== 'granted') return null;
  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
    const p = pos ?? (await Location.getLastKnownPositionAsync());
    return p ? { lat: p.coords.latitude, lng: p.coords.longitude } : null;
  } catch {
    return null;
  }
}
