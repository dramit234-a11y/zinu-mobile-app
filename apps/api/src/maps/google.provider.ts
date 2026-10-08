import { HttpStatus, Logger } from '@nestjs/common';
import { ErrorCode } from '@zinu/shared';
import { AppError } from '../common/errors.js';
import type { LatLng, MapsProvider, PlaceDetails, RouteResult, Suggestion } from './maps.provider.js';

const unavailable = () => new AppError(ErrorCode.MAPS_UNAVAILABLE, 'Maps are temporarily unavailable. Please try again.', HttpStatus.BAD_GATEWAY);

/**
 * Google Maps Platform via its web services, called only from the server so the key never ships in the app.
 * Uses Places API (New) autocomplete + details with session tokens (billed as one session), Geocoding API for
 * reverse geocoding and Routes API computeRoutes for distance/ETA/polyline.
 */
export class GoogleMapsProvider implements MapsProvider {
  readonly name = 'google' as const;
  private readonly logger = new Logger('GoogleMaps');

  constructor(
    private readonly key: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call<T>(url: string, init: { method?: string; body?: unknown; fieldMask?: string }): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: init.method ?? 'GET',
        headers: {
          'X-Goog-Api-Key': this.key,
          ...(init.fieldMask ? { 'X-Goog-FieldMask': init.fieldMask } : {}),
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      this.logger.error(`Google Maps request failed: ${(e as Error).message}`);
      throw unavailable();
    }
    if (!res.ok) {
      this.logger.error(`Google Maps HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      throw unavailable();
    }
    return (await res.json()) as T;
  }

  async autocomplete(input: string, opts: { near?: LatLng; sessionToken?: string; language: string }): Promise<Suggestion[]> {
    type Res = {
      suggestions?: {
        placePrediction?: {
          placeId: string;
          distanceMeters?: number;
          text?: { text: string };
          structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
        };
      }[];
    };
    const json = await this.call<Res>('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      body: {
        input,
        sessionToken: opts.sessionToken,
        languageCode: opts.language,
        includedRegionCodes: ['in'],
        ...(opts.near
          ? {
              locationBias: { circle: { center: { latitude: opts.near.lat, longitude: opts.near.lng }, radius: 30000 } },
              origin: { latitude: opts.near.lat, longitude: opts.near.lng },
            }
          : {}),
      },
    });
    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({
        placeId: p.placeId,
        primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
        secondary: p.structuredFormat?.secondaryText?.text ?? '',
        distanceM: p.distanceMeters,
      }));
  }

  async placeDetails(placeId: string, opts: { sessionToken?: string; language: string }): Promise<PlaceDetails | null> {
    type Res = { id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } };
    const qs = new URLSearchParams({ languageCode: opts.language, ...(opts.sessionToken ? { sessionToken: opts.sessionToken } : {}) });
    const json = await this.call<Res>(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${qs}`, {
      fieldMask: 'id,displayName,formattedAddress,location',
    });
    if (!json.location) return null;
    return {
      placeId: json.id,
      name: json.displayName?.text ?? json.formattedAddress ?? '',
      address: json.formattedAddress ?? json.displayName?.text ?? '',
      lat: json.location.latitude,
      lng: json.location.longitude,
    };
  }

  async reverseGeocode(at: LatLng, language: string) {
    type Res = { status: string; results?: { formatted_address: string; place_id: string }[] };
    const qs = new URLSearchParams({ latlng: `${at.lat},${at.lng}`, language, key: this.key });
    const json = await this.call<Res>(`https://maps.googleapis.com/maps/api/geocode/json?${qs}`, {});
    if (json.status === 'ZERO_RESULTS') return null;
    if (json.status !== 'OK' || !json.results?.[0]) {
      this.logger.error(`Geocoding status ${json.status}`);
      throw unavailable();
    }
    return { address: json.results[0].formatted_address, placeId: json.results[0].place_id };
  }

  async route(from: LatLng, to: LatLng): Promise<RouteResult | null> {
    type Res = { routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[] };
    const json = await this.call<Res>('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      fieldMask: 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      body: {
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        units: 'METRIC',
      },
    });
    const r = json.routes?.[0];
    if (!r || r.distanceMeters === undefined || !r.duration) return null;
    return { distanceM: r.distanceMeters, durationS: parseInt(r.duration, 10), polyline: r.polyline?.encodedPolyline ?? '' };
  }
}
