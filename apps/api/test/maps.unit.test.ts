import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodePolyline } from '@zinu/shared';
import { DemoMapsProvider } from '../src/maps/demo.provider.js';
import { GoogleMapsProvider } from '../src/maps/google.provider.js';

/** Records requests and replays canned Google responses (formats per Google Maps Platform docs). */
function fakeFetch(responses: Record<string, unknown>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const key = Object.keys(responses).find((k) => String(url).includes(k));
    if (!key) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(responses[key]), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { impl, calls };
}

test('Google autocomplete sends a biased Places (New) request and parses predictions', async () => {
  const { impl, calls } = fakeFetch({
    'places:autocomplete': {
      suggestions: [
        { placePrediction: { placeId: 'ChIJ123', distanceMeters: 4200, text: { text: 'Birsa Munda Airport, Ranchi' }, structuredFormat: { mainText: { text: 'Birsa Munda Airport' }, secondaryText: { text: 'Hinoo, Ranchi, Jharkhand' } } } },
        { queryPrediction: { text: { text: 'airport road' } } },
      ],
    },
  });
  const g = new GoogleMapsProvider('test-key', impl);
  const res = await g.autocomplete('airport', { near: { lat: 23.36, lng: 85.32 }, sessionToken: 'sess-1', language: 'en' });
  assert.deepEqual(res, [{ placeId: 'ChIJ123', primary: 'Birsa Munda Airport', secondary: 'Hinoo, Ranchi, Jharkhand', distanceM: 4200 }]);
  const body = JSON.parse(String(calls[0]!.init.body));
  assert.equal(calls[0]!.init.method, 'POST');
  assert.equal((calls[0]!.init.headers as Record<string, string>)['X-Goog-Api-Key'], 'test-key');
  assert.equal(body.sessionToken, 'sess-1');
  assert.deepEqual(body.includedRegionCodes, ['in']);
  assert.deepEqual(body.locationBias.circle.center, { latitude: 23.36, longitude: 85.32 });
});

test('Google place details, reverse geocode and routes', async () => {
  const { impl, calls } = fakeFetch({
    'places/ChIJ123': { id: 'ChIJ123', displayName: { text: 'Birsa Munda Airport' }, formattedAddress: 'Hinoo, Ranchi 834002', location: { latitude: 23.3143, longitude: 85.3217 } },
    'geocode/json': { status: 'OK', results: [{ formatted_address: 'Main Rd, Ranchi', place_id: 'ChIJabc' }] },
    'computeRoutes': { routes: [{ distanceMeters: 7012, duration: '1265s', polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC' } }] },
  });
  const g = new GoogleMapsProvider('k', impl);
  assert.deepEqual(await g.placeDetails('ChIJ123', { sessionToken: 's', language: 'hi' }), {
    placeId: 'ChIJ123',
    name: 'Birsa Munda Airport',
    address: 'Hinoo, Ranchi 834002',
    lat: 23.3143,
    lng: 85.3217,
  });
  assert.match(calls[0]!.url, /sessionToken=s/);
  assert.equal((calls[0]!.init.headers as Record<string, string>)['X-Goog-FieldMask'], 'id,displayName,formattedAddress,location');
  assert.deepEqual(await g.reverseGeocode({ lat: 23.37, lng: 85.325 }, 'en'), { address: 'Main Rd, Ranchi', placeId: 'ChIJabc' });
  assert.match(calls[1]!.url, /latlng=23.37%2C85.325/);
  assert.deepEqual(await g.route({ lat: 23.34, lng: 85.33 }, { lat: 23.39, lng: 85.32 }), { distanceM: 7012, durationS: 1265, polyline: '_p~iF~ps|U_ulLnnqC' });
  const routeBody = JSON.parse(String(calls[2]!.init.body));
  assert.equal(routeBody.travelMode, 'DRIVE');
  assert.equal((calls[2]!.init.headers as Record<string, string>)['X-Goog-FieldMask'], 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline');
});

test('Google errors surface as MAPS_UNAVAILABLE, never as raw provider errors', async () => {
  const g = new GoogleMapsProvider('k', (async () => new Response('denied', { status: 403 })) as typeof fetch);
  await assert.rejects(g.route({ lat: 1, lng: 1 }, { lat: 2, lng: 2 }), (e: { code?: string }) => e.code === 'MAPS_UNAVAILABLE');
});

test('demo provider is labelled and self-consistent', async () => {
  const d = new DemoMapsProvider();
  const s = await d.autocomplete('station', { near: { lat: 23.36, lng: 85.32 } });
  assert.equal(s[0]!.placeId, 'demo:railway-station');
  assert.match(s[0]!.secondary, /demo location/);
  const p = await d.placeDetails('demo:airport');
  assert.equal(p!.name, 'Birsa Munda Airport');
  const r = await d.route({ lat: 23.3486, lng: 85.3358 }, { lat: 23.3962, lng: 85.3258 });
  const pts = decodePolyline(r.polyline);
  assert.ok(Math.abs(pts[0]!.lat - 23.3486) < 1e-4 && Math.abs(pts.at(-1)!.lat - 23.3962) < 1e-4);
  assert.match((await d.reverseGeocode({ lat: 23.3962, lng: 85.3258 })).address, /^Morabadi Ground/);
});
