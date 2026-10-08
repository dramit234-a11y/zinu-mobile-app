import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { calculateFare } from '@zinu/shared';
import pg from 'pg';
import { adminCookie, call, login, setup, type TestContext } from './helpers.js';

let ctx: TestContext;
let db: pg.Client;
before(async () => {
  ctx = await setup();
  db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
});
after(async () => {
  await db.end();
  await ctx.close();
});

const STATION = { lat: 23.3486, lng: 85.3358, address: 'Ranchi Railway Station, Station Road, Ranchi', placeId: 'demo:railway-station' };
const MORABADI = { lat: 23.3962, lng: 85.3258, address: 'Morabadi Ground, Morabadi, Ranchi', placeId: 'demo:morabadi' };
const OUTSIDE = { lat: 23.6, lng: 85.6, address: 'Outside Ranchi' };

describe('maps endpoints (demo provider)', () => {
  test('autocomplete, place details, reverse geocode require login and are labelled', async () => {
    assert.equal((await call(ctx.base, 'GET', '/v1/maps/autocomplete?q=air')).status, 401);
    const { accessToken: token } = await login(ctx.base);
    const ac = await call(ctx.base, 'GET', '/v1/maps/autocomplete?q=airport&lat=23.36&lng=85.32&sessionToken=abc', { token });
    assert.equal(ac.body.provider, 'demo');
    assert.equal(ac.body.suggestions[0].placeId, 'demo:airport');
    const place = await call(ctx.base, 'GET', '/v1/maps/places/demo:airport?sessionToken=abc', { token });
    assert.equal(place.body.place.name, 'Birsa Munda Airport');
    assert.equal((await call(ctx.base, 'GET', '/v1/maps/places/unknown', { token })).status, 404);
    const rev = await call(ctx.base, 'GET', '/v1/maps/reverse?lat=23.3962&lng=85.3258', { token });
    assert.match(rev.body.place.address, /Morabadi Ground/);
    assert.equal((await call(ctx.base, 'GET', '/v1/maps/autocomplete?q=a', { token })).status, 400);
  });

  test('service area and zone outlines', async () => {
    const inside = await call(ctx.base, 'GET', '/v1/service-area?lat=23.36&lng=85.32');
    assert.equal(inside.body.inService, true);
    assert.equal(inside.body.city.name, 'Ranchi');
    assert.equal((await call(ctx.base, 'GET', '/v1/service-area?lat=23.6&lng=85.6')).body.inService, false);
    const zones = await call(ctx.base, 'GET', `/v1/cities/${inside.body.city.id}/service-zones`);
    assert.equal(zones.body[0].boundary.type, 'Polygon');
  });
});

describe('fare quotes (spec §12–13)', () => {
  test('quotes every enabled category with fares computed by the shared engine, and stores them', async () => {
    const auth = await login(ctx.base);
    const q = await call(ctx.base, 'POST', '/v1/rides/quote', { token: auth.accessToken, body: { pickup: STATION, dropoff: MORABADI } });
    assert.equal(q.status, 200, JSON.stringify(q.body));
    assert.equal(q.body.provider, 'demo');
    assert.deepEqual(q.body.options.map((o: { category: string }) => o.category), ['BIKE', 'TOTO', 'AUTO', 'CAB', 'SHARED']);
    const shared = q.body.options.find((o: { category: string }) => o.category === 'SHARED');
    assert.equal(shared.perSeat, true);
    for (const o of q.body.options) {
      assert.equal(o.pickupEtaS, null, 'no fake pickup ETA');
      assert.equal(o.fare.lines.reduce((s: number, l: { amountPaise: number }) => s + l.amountPaise, 0), o.fare.totalPaise);
    }
    const { rows } = await db.query('select category_code, total_paise, expires_at, distance_m from fare_quotes where group_id = $1', [q.body.quoteGroupId]);
    assert.equal(rows.length, 5);
    assert.ok(new Date(rows[0].expires_at) > new Date());
    const auto = q.body.options.find((o: { category: string }) => o.category === 'AUTO');
    const { rows: rule } = await db.query(`select * from pricing_rules where category_code = 'AUTO' order by version desc limit 1`);
    const expected = calculateFare(
      {
        baseFarePaise: rule[0].base_fare_paise,
        baseDistanceM: rule[0].base_distance_m,
        perKmPaise: rule[0].per_km_paise,
        perMinPaise: rule[0].per_min_paise,
        minFarePaise: rule[0].min_fare_paise,
        platformFeePaise: rule[0].platform_fee_paise,
        taxBps: rule[0].tax_bps,
        nightSurchargeBps: rule[0].night_surcharge_bps,
        nightStartHour: rule[0].night_start_hour,
        nightEndHour: rule[0].night_end_hour,
      },
      { distanceM: q.body.route.distanceM, durationS: q.body.route.durationS },
    );
    assert.equal(auto.fare.totalPaise, expected.totalPaise);

    const recent = await call(ctx.base, 'GET', '/v1/me/recent-places', { token: auth.accessToken });
    assert.equal(recent.body[0].address, MORABADI.address);
  });

  test('refuses pickups or destinations outside the service area, and trips that are too short', async () => {
    const { accessToken: token } = await login(ctx.base);
    const a = await call(ctx.base, 'POST', '/v1/rides/quote', { token, body: { pickup: OUTSIDE, dropoff: MORABADI } });
    assert.equal(a.body.error.code, 'OUT_OF_SERVICE_AREA');
    assert.equal(a.body.error.details.which, 'pickup');
    const b = await call(ctx.base, 'POST', '/v1/rides/quote', { token, body: { pickup: STATION, dropoff: OUTSIDE } });
    assert.equal(b.body.error.details.which, 'dropoff');
    const c = await call(ctx.base, 'POST', '/v1/rides/quote', { token, body: { pickup: STATION, dropoff: { ...STATION, lat: STATION.lat + 0.0005, address: 'next door' } } });
    assert.match(c.body.error.message, /too close/);
  });
});

describe('saved places', () => {
  test('Home and Work are single slots; Other accumulates; owner-only delete', async () => {
    const { accessToken: token } = await login(ctx.base);
    await call(ctx.base, 'POST', '/v1/me/places', { token, body: { ...STATION, label: 'HOME' } });
    let list = await call(ctx.base, 'POST', '/v1/me/places', { token, body: { ...MORABADI, label: 'HOME' } });
    assert.equal(list.body.filter((p: { label: string }) => p.label === 'HOME').length, 1);
    assert.equal(list.body[0].address, MORABADI.address);
    await call(ctx.base, 'POST', '/v1/me/places', { token, body: { ...STATION, label: 'OTHER', name: 'Gym' } });
    list = await call(ctx.base, 'POST', '/v1/me/places', { token, body: { ...STATION, label: 'OTHER', name: 'Office 2' } });
    assert.equal(list.body.length, 3);
    const other = await login(ctx.base);
    assert.equal((await call(ctx.base, 'DELETE', `/v1/me/places/${list.body[0].id}`, { token: other.accessToken })).status, 404);
    assert.equal((await call(ctx.base, 'DELETE', `/v1/me/places/${list.body[0].id}`, { token })).body.length, 2);
  });
});

describe('admin ride categories and pricing', () => {
  test('new pricing versions apply to new quotes; disabled categories disappear; all audited', async () => {
    const cookie = await adminCookie(ctx);
    const cities = await call(ctx.base, 'GET', '/v1/admin/cities', { cookie });
    const ranchi = cities.body.find((c: { code: string }) => c.code === 'RNC');
    const cats = await call(ctx.base, 'GET', `/v1/admin/cities/${ranchi.id}/ride-categories`, { cookie });
    assert.equal(cats.body.length, 5);
    assert.ok(cats.body.every((c: { enabled: boolean; pricing: unknown }) => c.enabled && c.pricing));

    const v2 = await call(ctx.base, 'POST', `/v1/admin/cities/${ranchi.id}/pricing/AUTO`, {
      cookie,
      admin: true,
      body: { baseFarePaise: 4000, baseDistanceM: 2000, perKmPaise: 1500, perMinPaise: 100, minFarePaise: 5000, platformFeePaise: 500, taxBps: 500, nightSurchargeBps: 0, nightStartHour: 22, nightEndHour: 6, note: 'Pilot fare' },
    });
    assert.equal(v2.status, 201, JSON.stringify(v2.body));
    assert.equal(v2.body.version, 2);
    const history = await call(ctx.base, 'GET', `/v1/admin/cities/${ranchi.id}/pricing/AUTO`, { cookie });
    assert.deepEqual(history.body.map((h: { version: number }) => h.version), [2, 1]);

    await call(ctx.base, 'PATCH', `/v1/admin/cities/${ranchi.id}/ride-categories/CAB`, { cookie, admin: true, body: { enabled: false } });
    const { accessToken: token } = await login(ctx.base);
    const q = await call(ctx.base, 'POST', '/v1/rides/quote', { token, body: { pickup: STATION, dropoff: MORABADI } });
    assert.ok(!q.body.options.some((o: { category: string }) => o.category === 'CAB'));
    const auto = q.body.options.find((o: { category: string }) => o.category === 'AUTO');
    assert.equal(auto.fare.lines.find((l: { code: string }) => l.code === 'BASE_FARE').amountPaise, 4000);
    assert.ok(auto.fare.lines.some((l: { code: string }) => l.code === 'TAX'));
    await call(ctx.base, 'PATCH', `/v1/admin/cities/${ranchi.id}/ride-categories/CAB`, { cookie, admin: true, body: { enabled: true } });

    const logs = await call(ctx.base, 'GET', '/v1/admin/audit-logs?limit=20', { cookie });
    const actions = logs.body.items.map((l: { action: string }) => l.action);
    assert.ok(actions.includes('pricing.published') && actions.includes('ride_category.updated'));
  });

  test('pricing validation and permissions', async () => {
    const support = await adminCookie(ctx, 'Support Agent');
    const cities = await call(ctx.base, 'GET', '/v1/admin/cities', { cookie: support });
    const id = cities.body[0].id;
    assert.equal((await call(ctx.base, 'GET', `/v1/admin/cities/${id}/ride-categories`, { cookie: support })).status, 200);
    const body = { baseFarePaise: 1, baseDistanceM: 0, perKmPaise: 1, perMinPaise: 1, minFarePaise: 1, platformFeePaise: 0, taxBps: 0, nightSurchargeBps: 0, nightStartHour: 0, nightEndHour: 0 };
    assert.equal((await call(ctx.base, 'POST', `/v1/admin/cities/${id}/pricing/AUTO`, { cookie: support, admin: true, body })).status, 403);
    const manager = await adminCookie(ctx, 'City Manager');
    assert.equal((await call(ctx.base, 'POST', `/v1/admin/cities/${id}/pricing/AUTO`, { cookie: manager, admin: true, body: { ...body, perKmPaise: -5 } })).status, 400);
    assert.equal((await call(ctx.base, 'POST', `/v1/admin/cities/${id}/pricing/ROCKET`, { cookie: manager, admin: true, body })).status, 400);
  });
});
