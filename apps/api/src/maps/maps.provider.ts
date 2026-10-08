export interface LatLng {
  lat: number;
  lng: number;
}

export interface Suggestion {
  placeId: string;
  primary: string;
  secondary: string;
  distanceM?: number;
}

export interface PlaceDetails extends LatLng {
  placeId: string;
  name: string;
  address: string;
}

export interface RouteResult {
  distanceM: number;
  durationS: number;
  /** Google encoded polyline (precision 5). */
  polyline: string;
}

/**
 * Everything ZINU needs from a maps platform (spec §59). Google is the first implementation; others
 * (Ola Maps, Mappls) can be added without touching callers. Service zones / geofencing stay in PostGIS.
 */
export interface MapsProvider {
  readonly name: 'google' | 'demo';
  autocomplete(input: string, opts: { near?: LatLng; sessionToken?: string; language: string }): Promise<Suggestion[]>;
  placeDetails(placeId: string, opts: { sessionToken?: string; language: string }): Promise<PlaceDetails | null>;
  reverseGeocode(at: LatLng, language: string): Promise<{ address: string; placeId?: string } | null>;
  route(from: LatLng, to: LatLng): Promise<RouteResult | null>;
}

export const MAPS_PROVIDER = Symbol('MAPS_PROVIDER');
