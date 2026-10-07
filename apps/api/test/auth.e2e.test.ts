import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { call, login, nextPhone, setup, type TestContext } from './helpers.js';

let ctx: TestContext;
before(async () => (ctx = await setup()));
after(() => ctx.close());

describe('OTP authentication', () => {
  test('new user: request OTP, verify, receive tokens and an empty profile', async () => {
    const phone = nextPhone();
    const auth = await login(ctx.base, phone);
    assert.equal(auth.isNewUser, true);
    assert.equal(auth.user.phone, `+91${phone}`);
    assert.equal(auth.user.profileComplete, false);
    assert.deepEqual(auth.user.roles, []);

    const again = await login(ctx.base, phone);
    assert.equal(again.isNewUser, false);
    assert.equal(again.user.id, auth.user.id);
  });

  test('rejects invalid phone numbers', async () => {
    const res = await call(ctx.base, 'POST', '/v1/auth/otp/request', { body: { phone: '12345', deviceId: 'device-xyz-1' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_FAILED');
  });

  test('wrong codes count down attempts and the OTP locks after the limit', async () => {
    const phone = nextPhone();
    const req = await call(ctx.base, 'POST', '/v1/auth/otp/request', { body: { phone, deviceId: 'device-lock-1' } });
    const wrong = req.body.devCode === '000000' ? '111111' : '000000';
    const device = { deviceId: 'device-lock-1', platform: 'ios' };
    for (let left = 4; left >= 0; left--) {
      const r = await call(ctx.base, 'POST', '/v1/auth/otp/verify', { body: { phone, code: wrong, device } });
      assert.equal(r.body.error.code, 'OTP_INVALID');
      assert.equal(r.body.error.details.attemptsLeft, left);
    }
    const locked = await call(ctx.base, 'POST', '/v1/auth/otp/verify', { body: { phone, code: req.body.devCode, device } });
    assert.equal(locked.body.error.code, 'OTP_TOO_MANY_ATTEMPTS');
  });

  test('an OTP can only be used once', async () => {
    const phone = nextPhone();
    const req = await call(ctx.base, 'POST', '/v1/auth/otp/request', { body: { phone, deviceId: 'device-once-1' } });
    const body = { phone, code: req.body.devCode, device: { deviceId: 'device-once-1', platform: 'android' } };
    assert.equal((await call(ctx.base, 'POST', '/v1/auth/otp/verify', { body })).status, 200);
    const second = await call(ctx.base, 'POST', '/v1/auth/otp/verify', { body });
    assert.equal(second.body.error.code, 'OTP_EXPIRED');
  });

  test('per-phone rate limit', async () => {
    const phone = nextPhone();
    let last;
    for (let i = 0; i < 51; i++) last = await call(ctx.base, 'POST', '/v1/auth/otp/request', { body: { phone, deviceId: 'device-rate-1' } });
    assert.equal(last!.status, 429);
    assert.equal(last!.body.error.code, 'RATE_LIMITED');
  });
});

describe('sessions', () => {
  test('refresh rotates the token; replaying the old one revokes the session', async () => {
    const auth = await login(ctx.base);
    const r1 = await call(ctx.base, 'POST', '/v1/auth/refresh', { body: { refreshToken: auth.refreshToken } });
    assert.equal(r1.status, 200);
    assert.notEqual(r1.body.refreshToken, auth.refreshToken);

    const replay = await call(ctx.base, 'POST', '/v1/auth/refresh', { body: { refreshToken: auth.refreshToken } });
    assert.equal(replay.status, 401);
    // The newer token is dead too: the session was revoked as compromised.
    const r2 = await call(ctx.base, 'POST', '/v1/auth/refresh', { body: { refreshToken: r1.body.refreshToken } });
    assert.equal(r2.status, 401);
  });

  test('logout revokes the refresh token', async () => {
    const auth = await login(ctx.base);
    assert.equal((await call(ctx.base, 'POST', '/v1/auth/logout', { token: auth.accessToken })).status, 204);
    const r = await call(ctx.base, 'POST', '/v1/auth/refresh', { body: { refreshToken: auth.refreshToken } });
    assert.equal(r.status, 401);
  });

  test('protected routes require a valid access token', async () => {
    assert.equal((await call(ctx.base, 'GET', '/v1/me')).status, 401);
    assert.equal((await call(ctx.base, 'GET', '/v1/me', { token: 'not-a-jwt' })).status, 401);
  });
});

describe('profile and roles', () => {
  test('passenger profile completion activates the passenger role', async () => {
    const auth = await login(ctx.base);
    const res = await call(ctx.base, 'POST', '/v1/me/passenger-profile', {
      token: auth.accessToken,
      body: { fullName: 'Asha Kumari', email: '', language: 'hi', emergencyContact: { name: 'Ravi', phone: '9123456789', relation: 'Brother' } },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.profileComplete, true);
    assert.equal(res.body.language, 'hi');
    assert.equal(res.body.email, null);
    assert.deepEqual(res.body.roles, [{ role: 'PASSENGER', status: 'ACTIVE' }]);
    assert.equal(res.body.emergencyContacts[0].phone, '+919123456789');
  });

  test('driver role starts in onboarding with verification NOT_SUBMITTED', async () => {
    const auth = await login(ctx.base);
    await call(ctx.base, 'PATCH', '/v1/me', { token: auth.accessToken, body: { fullName: 'Raju Mahto' } });
    const res = await call(ctx.base, 'POST', '/v1/me/roles', { token: auth.accessToken, body: { role: 'DRIVER' } });
    assert.deepEqual(res.body.roles, [{ role: 'DRIVER', status: 'ONBOARDING' }]);
    assert.equal(res.body.driver.verificationStatus, 'NOT_SUBMITTED');
    const again = await call(ctx.base, 'POST', '/v1/me/roles', { token: auth.accessToken, body: { role: 'DRIVER' } });
    assert.equal(again.body.roles.length, 1);
  });

  test('account deletion erases personal data and frees the phone number', async () => {
    const phone = nextPhone();
    const auth = await login(ctx.base, phone);
    await call(ctx.base, 'POST', '/v1/me/passenger-profile', { token: auth.accessToken, body: { fullName: 'To Delete', language: 'en' } });
    assert.equal((await call(ctx.base, 'DELETE', '/v1/me', { token: auth.accessToken })).status, 204);
    assert.equal((await call(ctx.base, 'POST', '/v1/auth/refresh', { body: { refreshToken: auth.refreshToken } })).status, 401);
    const fresh = await login(ctx.base, phone);
    assert.equal(fresh.isNewUser, true);
    assert.notEqual(fresh.user.id, auth.user.id);
  });
});

describe('app config', () => {
  test('flags required updates below the minimum version', async () => {
    const old = await call(ctx.base, 'GET', '/v1/app/config?platform=android&version=0.9.0');
    assert.equal(old.body.updateRequired, true);
    const current = await call(ctx.base, 'GET', '/v1/app/config?platform=android&version=1.0.0');
    assert.equal(current.body.updateRequired, false);
  });
});
