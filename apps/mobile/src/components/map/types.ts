export interface LatLng {
  lat: number;
  lng: number;
}

export interface ZinuMapProps {
  /** Initial centre. Later changes move the map only when `follow` is true. */
  center: LatLng;
  follow?: boolean;
  markers?: { id: string; at: LatLng; kind: 'pickup' | 'dropoff' }[];
  route?: LatLng[];
  /** Service-zone outlines. */
  zones?: LatLng[][];
  showsUserLocation?: boolean;
  /** Fit the view to these points whenever they change (e.g. a route). */
  fitTo?: LatLng[];
  /** Called after the user finishes moving the map (used by "Choose on map"). */
  onCenterChange?: (center: LatLng) => void;
  accessibilityLabel?: string;
}

/** Ranchi city centre; used before the passenger's location is known. */
export const DEFAULT_CENTER: LatLng = { lat: 23.3441, lng: 85.3096 };
