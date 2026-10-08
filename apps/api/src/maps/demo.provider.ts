import { encodePolyline, haversineM } from '@zinu/shared';
import type { LatLng, MapsProvider, PlaceDetails, RouteResult, Suggestion } from './maps.provider.js';

/**
 * DEMONSTRATION DATA — used only when no Google Maps key is configured (never in production; env validation
 * refuses it). Well-known Ranchi places with APPROXIMATE coordinates, straight-line routes with a road factor
 * and an assumed average city speed. Every response is labelled "demo" so the app shows a banner.
 */
export const DEMO_PLACES: { id: string; name: string; area: string; lat: number; lng: number; aliases?: string[] }[] = [
  { id: 'railway-station', name: 'Ranchi Railway Station', area: 'Station Road, Ranchi', lat: 23.3486, lng: 85.3358, aliases: ['station', 'junction', 'rnc'] },
  { id: 'airport', name: 'Birsa Munda Airport', area: 'Hinoo, Ranchi', lat: 23.3143, lng: 85.3217, aliases: ['airport'] },
  { id: 'firayalal', name: 'Firayalal Chowk', area: 'Main Road, Ranchi', lat: 23.3701, lng: 85.3252, aliases: ['albert ekka chowk', 'main road'] },
  { id: 'morabadi', name: 'Morabadi Ground', area: 'Morabadi, Ranchi', lat: 23.3962, lng: 85.3258, aliases: ['morhabadi'] },
  { id: 'harmu', name: 'Harmu Housing Colony', area: 'Harmu, Ranchi', lat: 23.3618, lng: 85.2985 },
  { id: 'kanke', name: 'Kanke Dam', area: 'Kanke, Ranchi', lat: 23.4153, lng: 85.3133, aliases: ['kanke'] },
  { id: 'doranda', name: 'Doranda Chowk', area: 'Doranda, Ranchi', lat: 23.3392, lng: 85.3209 },
  { id: 'rims', name: 'RIMS Hospital', area: 'Bariatu, Ranchi', lat: 23.3878, lng: 85.3482, aliases: ['bariatu', 'hospital'] },
  { id: 'lalpur', name: 'Lalpur Chowk', area: 'Lalpur, Ranchi', lat: 23.3793, lng: 85.3331 },
  { id: 'kantatoli', name: 'Kantatoli Chowk', area: 'Kantatoli, Ranchi', lat: 23.3657, lng: 85.3462 },
  { id: 'ratu-road', name: 'Ratu Road Chowk', area: 'Ratu Road, Ranchi', lat: 23.3881, lng: 85.3127 },
  { id: 'argora', name: 'Argora Chowk', area: 'Argora, Ranchi', lat: 23.3497, lng: 85.2958 },
  { id: 'ranchi-university', name: 'Ranchi University', area: 'Morabadi, Ranchi', lat: 23.3786, lng: 85.3266, aliases: ['university'] },
  { id: 'hinoo', name: 'Hinoo Chowk', area: 'Hinoo, Ranchi', lat: 23.3266, lng: 85.3162 },
];

const ROAD_FACTOR = 1.3;
const AVG_SPEED_MPS = 20_000 / 3600; // 20 km/h city average
const placeIdOf = (id: string) => `demo:${id}`;

export class DemoMapsProvider implements MapsProvider {
  readonly name = 'demo' as const;

  async autocomplete(input: string, opts: { near?: LatLng }): Promise<Suggestion[]> {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return DEMO_PLACES.filter((p) => [p.name, p.area, ...(p.aliases ?? [])].some((s) => s.toLowerCase().includes(q)))
      .map((p) => ({
        placeId: placeIdOf(p.id),
        primary: p.name,
        secondary: `${p.area} (demo location)`,
        distanceM: opts.near ? Math.round(haversineM(opts.near, p)) : undefined,
      }))
      .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0))
      .slice(0, 8);
  }

  async placeDetails(placeId: string): Promise<PlaceDetails | null> {
    const p = DEMO_PLACES.find((x) => placeIdOf(x.id) === placeId);
    return p ? { placeId, name: p.name, address: `${p.name}, ${p.area}`, lat: p.lat, lng: p.lng } : null;
  }

  async reverseGeocode(at: LatLng) {
    const nearest = [...DEMO_PLACES].sort((a, b) => haversineM(at, a) - haversineM(at, b))[0]!;
    const d = haversineM(at, nearest);
    return { address: d < 150 ? `${nearest.name}, ${nearest.area}` : `Near ${nearest.name}, ${nearest.area}` };
  }

  async route(from: LatLng, to: LatLng): Promise<RouteResult> {
    const straight = haversineM(from, to);
    const distanceM = Math.round(straight * ROAD_FACTOR);
    const steps = 12;
    const points = Array.from({ length: steps + 1 }, (_, i) => ({ lat: from.lat + ((to.lat - from.lat) * i) / steps, lng: from.lng + ((to.lng - from.lng) * i) / steps }));
    return { distanceM, durationS: Math.round(distanceM / AVG_SPEED_MPS) + 60, polyline: encodePolyline(points) };
  }
}
