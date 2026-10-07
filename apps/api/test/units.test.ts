import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareVersions } from '../src/app-config/app-config.controller.js';
import { decrypt, encrypt } from '../src/common/crypto.js';
import { uuidv7 } from '../src/common/ids.js';
import { base32Decode, base32Encode, totpCode, verifyTotp } from '../src/common/totp.js';
import { loadEnv } from '../src/config/env.js';

test('TOTP matches the RFC 6238 SHA-1 test vector', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  // RFC 6238 Appendix B: T=59s -> 94287082 (8 digits); the 6-digit code is the last 6.
  assert.equal(totpCode(secret, 59_000), '287082');
  assert.ok(verifyTotp(secret, totpCode(secret, 1_000_000), 1_000_000 + 30_000));
  assert.ok(!verifyTotp(secret, totpCode(secret, 1_000_000), 1_000_000 + 120_000));
  assert.deepEqual(base32Decode(secret), Buffer.from('12345678901234567890'));
});

test('AES-GCM round trip and tamper detection', () => {
  const key = 'ab'.repeat(32);
  const c = encrypt(key, 'secret');
  assert.equal(decrypt(key, c), 'secret');
  assert.throws(() => decrypt(key, c.slice(0, -2) + 'AA'));
});

test('uuidv7 is time-ordered and well formed', () => {
  const a = uuidv7();
  const b = uuidv7();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(a.slice(0, 13) <= b.slice(0, 13));
});

test('version comparison is numeric', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(compareVersions('0.9.0', '1.0.0'), -1);
});

test('production refuses development OTP settings', () => {
  const base = {
    DATABASE_URL: 'postgres://x@localhost/db',
    JWT_SECRET: 'x'.repeat(32),
    ADMIN_JWT_SECRET: 'y'.repeat(32),
    OTP_HMAC_SECRET: 'z'.repeat(32),
    STAFF_TOTP_ENC_KEY: 'a'.repeat(64),
  };
  assert.throws(() => loadEnv({ ...base, NODE_ENV: 'production' }), /console OTP provider/);
  assert.throws(() => loadEnv({ ...base, NODE_ENV: 'production', OTP_PROVIDER: 'msg91' }), /MSG91_AUTH_KEY/);
  assert.throws(
    () => loadEnv({ ...base, NODE_ENV: 'production', OTP_PROVIDER: 'msg91', MSG91_AUTH_KEY: 'k', MSG91_OTP_TEMPLATE_ID: 't', OTP_DEV_ECHO: 'true' }),
    /OTP_DEV_ECHO/,
  );
  assert.doesNotThrow(() => loadEnv({ ...base, NODE_ENV: 'production', OTP_PROVIDER: 'msg91', MSG91_AUTH_KEY: 'k', MSG91_OTP_TEMPLATE_ID: 't' }));
});
