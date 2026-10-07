import type { INestApplication } from '@nestjs/common';
import argon2 from 'argon2';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Redis } from 'ioredis';
import pg from 'pg';
import { createApp } from '../src/bootstrap.js';
import { loadEnv } from '../src/config/env.js';
import { encrypt } from '../src/common/crypto.js';
import { uuidv7 } from '../src/common/ids.js';
import { generateTotpSecret, totpCode } from '../src/common/totp.js';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import { seed } from '../src/scripts/seed.js';

export interface TestContext {
  app: INestApplication;
  base: string;
  cityId: string;
  createStaff(role: string): Promise<{ email: string; password: string; totp: () => string }>;
  close(): Promise<void>;
}

/** Fresh database + Redis for each test file, then a real HTTP server on a random port. */
export async function setup(): Promise<TestContext> {
  const env = loadEnv();
  if (!env.DATABASE_URL.includes('test')) throw new Error('Refusing to run tests against a non-test database');

  const admin = new pg.Client({ connectionString: env.DATABASE_URL });
  await admin.connect();
  await admin.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
  await admin.end();
  await runMigrations(env.DATABASE_URL);
  const { cityId } = await seed(env.DATABASE_URL);

  const redis = new Redis(env.REDIS_URL);
  await redis.flushdb();
  await redis.quit();

  const app = await createApp();
  await app.listen(0, '127.0.0.1');
  const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');

  const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 2 });
  const db = drizzle(pool, { schema });

  return {
    app,
    base,
    cityId,
    async createStaff(roleName) {
      const role = await db.query.staffRoles.findFirst({ where: (r, { eq }) => eq(r.name, roleName) });
      const secret = generateTotpSecret();
      const email = `${roleName.replace(/\s/g, '').toLowerCase()}-${uuidv7().slice(-6)}@zinu.test`;
      const password = 'correct-horse-battery';
      await db.insert(schema.staffUsers).values({
        id: uuidv7(),
        email,
        fullName: roleName,
        passwordHash: await argon2.hash(password),
        totpSecretEnc: encrypt(env.STAFF_TOTP_ENC_KEY, secret),
        roleId: role!.id,
      });
      return { email, password, totp: () => totpCode(secret) };
    },
    async close() {
      await app.close();
      await pool.end();
    },
  };
}

export interface CallResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export async function call<T = any>(
  base: string,
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; cookie?: string; admin?: boolean } = {},
): Promise<CallResult<T>> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.admin) headers['x-zinu-admin'] = '1';
  const res = await fetch(base + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

let phoneCounter = 0;
/** Unique valid Indian mobile number per call. */
export const nextPhone = () => `98${String(Date.now() % 1e6).padStart(6, '0')}${String(phoneCounter++ % 100).padStart(2, '0')}`;

/** Full OTP login using the development echo code. */
export async function login(base: string, phone = nextPhone(), deviceId = `device-${uuidv7()}`) {
  const req = await call(base, 'POST', '/v1/auth/otp/request', { body: { phone, deviceId } });
  if (req.status !== 200) throw new Error(`otp request failed: ${JSON.stringify(req.body)}`);
  const res = await call(base, 'POST', '/v1/auth/otp/verify', {
    body: { phone, code: req.body.devCode, device: { deviceId, platform: 'android', appVersion: '1.0.0' } },
  });
  if (res.status !== 200) throw new Error(`otp verify failed: ${JSON.stringify(res.body)}`);
  return res.body as { accessToken: string; refreshToken: string; isNewUser: boolean; user: any };
}
