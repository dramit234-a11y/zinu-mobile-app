import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { call, login, setup, type TestContext } from './helpers.js';

let ctx: TestContext;
before(async () => (ctx = await setup()));
after(() => ctx.close());

async function adminLogin(role = 'Super Admin') {
  const staff = await ctx.createStaff(role);
  const res = await call(ctx.base, 'POST', '/v1/admin/auth/login', { body: { email: staff.email, password: staff.password, totp: staff.totp() } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
  return { cookie, staff: res.body.staff };
}

const RING: [number, number][] = [
  [85.32, 23.36],
  [85.34, 23.36],
  [85.34, 23.38],
  [85.32, 23.38],
];

describe('admin authentication', () => {
  test('requires the TOTP code after a correct password', async () => {
    const staff = await ctx.createStaff('Super Admin');
    const res = await call(ctx.base, 'POST', '/v1/admin/auth/login', { body: { email: staff.email, password: staff.password } });
    assert.equal(res.body.error.code, 'TOTP_REQUIRED');
  });

  test('rejects a wrong password with a generic error', async () => {
    const staff = await ctx.createStaff('Super Admin');
    const res = await call(ctx.base, 'POST', '/v1/admin/auth/login', { body: { email: staff.email, password: 'wrong-password', totp: staff.totp() } });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  test('locks the account after repeated failures', async () => {
    const staff = await ctx.createStaff('Super Admin');
    for (let i = 0; i < 5; i++)
      await call(ctx.base, 'POST', '/v1/admin/auth/login', { body: { email: staff.email, password: staff.password, totp: '000000' } });
    const res = await call(ctx.base, 'POST', '/v1/admin/auth/login', { body: { email: staff.email, password: staff.password, totp: staff.totp() } });
    assert.equal(res.status, 429);
  });

  test('sets an httpOnly strict cookie and returns permissions', async () => {
    const staff = await ctx.createStaff('Analyst');
    const res = await call(ctx.base, 'POST', '/v1/admin/auth/login', { body: { email: staff.email, password: staff.password, totp: staff.totp() } });
    const setCookie = res.headers.get('set-cookie')!;
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    assert.ok(res.body.staff.permissions.includes('audit.view'));
  });

  test('user access tokens cannot reach admin routes', async () => {
    const user = await login(ctx.base);
    const res = await call(ctx.base, 'GET', '/v1/admin/dashboard', { token: user.accessToken });
    assert.equal(res.status, 401);
  });
});

describe('admin permissions', () => {
  test('mutations without the admin header are rejected (CSRF protection)', async () => {
    const { cookie } = await adminLogin();
    const res = await call(ctx.base, 'POST', '/v1/admin/cities', { cookie, body: {} });
    assert.equal(res.status, 403);
  });

  test('roles without the permission are forbidden', async () => {
    const { cookie } = await adminLogin('Support Agent');
    const res = await call(ctx.base, 'POST', `/v1/admin/cities/${ctx.cityId}/zones`, {
      cookie,
      admin: true,
      body: { name: 'X', boundary: { type: 'Polygon', coordinates: [RING] } },
    });
    assert.equal(res.status, 403);
    assert.equal((await call(ctx.base, 'GET', '/v1/admin/audit-logs', { cookie })).status, 403);
  });
});

describe('cities and zones', () => {
  test('seeded Ranchi city is present', async () => {
    const { cookie } = await adminLogin();
    const res = await call(ctx.base, 'GET', '/v1/admin/cities', { cookie });
    const ranchi = res.body.find((c: any) => c.code === 'RNC');
    assert.equal(ranchi.name, 'Ranchi');
    assert.equal(ranchi.status, 'ACTIVE');
  });

  test('create a city, add a zone, geofence a point, audit the changes', async () => {
    const { cookie, staff } = await adminLogin();
    const city = await call(ctx.base, 'POST', '/v1/admin/cities', {
      cookie,
      admin: true,
      body: { name: 'Jamshedpur', state: 'Jharkhand', code: 'JSR', centerLat: 22.8046, centerLng: 86.2029 },
    });
    assert.equal(city.status, 201, JSON.stringify(city.body));
    assert.equal(city.body.status, 'DRAFT');
    assert.ok(Math.abs(city.body.centerLat - 22.8046) < 1e-6);

    const dup = await call(ctx.base, 'POST', '/v1/admin/cities', { cookie, admin: true, body: { name: 'Dup', state: 'JH', code: 'JSR', centerLat: 1, centerLng: 1 } });
    assert.equal(dup.status, 409);

    // Ring deliberately left open: the API closes it.
    const zone = await call(ctx.base, 'POST', `/v1/admin/cities/${city.body.id}/zones`, {
      cookie,
      admin: true,
      body: { name: 'Bistupur', type: 'PREFERRED', boundary: { type: 'Polygon', coordinates: [RING] } },
    });
    assert.equal(zone.status, 201, JSON.stringify(zone.body));
    assert.equal(zone.body.boundary.type, 'Polygon');
    assert.ok(zone.body.areaSqKm > 4 && zone.body.areaSqKm < 6);

    const inside = await call(ctx.base, 'GET', `/v1/admin/cities/${city.body.id}/zones-at?lat=23.37&lng=85.33`, { cookie });
    assert.deepEqual(inside.body.map((z: any) => z.name), ['Bistupur']);
    const outside = await call(ctx.base, 'GET', `/v1/admin/cities/${city.body.id}/zones-at?lat=23.5&lng=85.33`, { cookie });
    assert.deepEqual(outside.body, []);

    const logs = await call(ctx.base, 'GET', '/v1/admin/audit-logs?limit=50', { cookie });
    const actions = logs.body.items.filter((l: any) => l.actorId === staff.id).map((l: any) => l.action);
    assert.ok(actions.includes('city.created'));
    assert.ok(actions.includes('zone.created'));
  });

  test('invalid polygons are rejected', async () => {
    const { cookie } = await adminLogin();
    const res = await call(ctx.base, 'POST', `/v1/admin/cities/${ctx.cityId}/zones`, {
      cookie,
      admin: true,
      body: { name: 'Bad', boundary: { type: 'Polygon', coordinates: [[[85.3, 23.3]]] } },
    });
    assert.equal(res.status, 400);
  });
});

describe('user management', () => {
  test('blocking a user revokes sessions and prevents login', async () => {
    const { cookie } = await adminLogin();
    const phone = '9000012345';
    const user = await login(ctx.base, phone);
    const list = await call(ctx.base, 'GET', '/v1/admin/users?q=9000012345', { cookie });
    assert.equal(list.body.items[0].id, user.user.id);

    assert.equal((await call(ctx.base, 'POST', `/v1/admin/users/${user.user.id}/block`, { cookie, admin: true })).status, 200);
    assert.equal((await call(ctx.base, 'POST', '/v1/auth/refresh', { body: { refreshToken: user.refreshToken } })).status, 401);
    assert.equal((await call(ctx.base, 'GET', '/v1/me', { token: user.accessToken })).body.error.code, 'ACCOUNT_BLOCKED');
    await assert.rejects(login(ctx.base, phone), /ACCOUNT_BLOCKED/);

    await call(ctx.base, 'POST', `/v1/admin/users/${user.user.id}/unblock`, { cookie, admin: true });
    assert.equal((await login(ctx.base, phone)).user.id, user.user.id);
  });

  test('dashboard counts', async () => {
    const { cookie } = await adminLogin();
    const res = await call(ctx.base, 'GET', '/v1/admin/dashboard', { cookie });
    assert.equal(res.status, 200);
    assert.ok(res.body.activeUsers >= 1);
    assert.ok(res.body.activeCities >= 1);
  });
});
