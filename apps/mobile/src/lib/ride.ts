import type { PlaceDto } from '@zinu/shared';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

interface RideDraft {
  pickup: PlaceDto | null;
  dropoff: PlaceDto | null;
  /** Passenger's last known position (null when location is off). */
  here: { lat: number; lng: number } | null;
  /** Category tapped on the home screen, highlighted on the options screen. */
  preferredCategory: string | null;
  /** Groups autocomplete + place-details calls into one billable Places session. */
  sessionToken: string;
  setPickup(p: PlaceDto | null): void;
  setDropoff(p: PlaceDto | null): void;
  setHere(p: { lat: number; lng: number } | null): void;
  setPreferredCategory(c: string | null): void;
  newSession(): void;
}

export const useRide = create<RideDraft>((set) => ({
  pickup: null,
  dropoff: null,
  here: null,
  preferredCategory: null,
  sessionToken: randomUUID(),
  setPickup: (pickup) => set({ pickup }),
  setDropoff: (dropoff) => set({ dropoff }),
  setHere: (here) => set({ here }),
  setPreferredCategory: (preferredCategory) => set({ preferredCategory }),
  newSession: () => set({ sessionToken: randomUUID() }),
}));

/** GeoJSON polygon → map outline. */
export const ringToLatLng = (coords: number[][][]) => (coords[0] ?? []).map(([lng, lat]) => ({ lat: lat!, lng: lng! }));
