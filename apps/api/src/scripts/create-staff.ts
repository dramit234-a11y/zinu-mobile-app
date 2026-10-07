import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { loadEnv } from '../config/env.js';
import { encrypt, randomToken } from '../common/crypto.js';
import { uuidv7 } from '../common/ids.js';
import { generateTotpSecret, totpUri } from '../common/totp.js';
import * as schema from '../db/schema.js';

/**
 * Creates (or resets) an admin staff account and prints its one-time password and TOTP secret.
 *   pnpm --filter @zinu/api staff:create --email you@zinu.in --name "Your Name" --role "Super Admin"
 * Pass --password to choose the password; otherwise a strong random one is generated.
 */
const { values } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'Super Admin' },
    password: { type: 'string' },
  },
});

if (!values.email || !values.name) {
  console.error('Usage: staff:create -- --email <email> --name "<full name>" [--role "Super Admin"] [--password <pw>]');
  process.exit(1);
}
if (values.password && values.password.length < 12) {
  console.error('Password must be at least 12 characters');
  process.exit(1);
}

const env = loadEnv();
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 1 });
const db = drizzle(pool, { schema });
try {
  const role = await db.query.staffRoles.findFirst({ where: eq(schema.staffRoles.name, values.role!) });
  if (!role) throw new Error(`Unknown role "${values.role}". Run db:seed first.`);
  const email = values.email.toLowerCase();
  const password = values.password ?? randomToken(15);
  const totpSecret = generateTotpSecret();
  const fields = {
    fullName: values.name,
    passwordHash: await argon2.hash(password),
    totpSecretEnc: encrypt(env.STAFF_TOTP_ENC_KEY, totpSecret),
    roleId: role.id,
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
  };
  await db
    .insert(schema.staffUsers)
    .values({ id: uuidv7(), email, ...fields })
    .onConflictDoUpdate({ target: schema.staffUsers.email, set: { ...fields, updatedAt: new Date() } });

  console.log(`\nStaff account ready: ${email} (${role.name})`);
  console.log(`Password:     ${password}`);
  console.log(`TOTP secret:  ${totpSecret}`);
  console.log(`TOTP URI:     ${totpUri(totpSecret, email)}`);
  console.log('\nAdd the TOTP secret to Google Authenticator / Microsoft Authenticator (\"enter a setup key\").');
  console.log('These values are shown once. Store them in a password manager.\n');
} finally {
  await pool.end();
}
