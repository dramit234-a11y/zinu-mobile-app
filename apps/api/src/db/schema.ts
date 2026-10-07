import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// PostGIS columns. Values are written/read through ST_* SQL functions in services, never as raw strings.
const geographyPoint = customType<{ data: string }>({ dataType: () => 'geography(Point,4326)' });
const geographyPolygon = customType<{ data: string }>({ dataType: () => 'geography(Polygon,4326)' });

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();
const updatedAt = () => ts('updated_at').notNull().defaultNow();

// ---------------- Identity ----------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    /** E.164. Nulled when the account is deleted so the number can register again. */
    phone: varchar('phone', { length: 16 }),
    fullName: varchar('full_name', { length: 80 }),
    email: varchar('email', { length: 254 }),
    language: varchar('language', { length: 8 }).notNull().default('en'),
    status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('users_phone_uq').on(t.phone)],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull(),
    status: varchar('status', { length: 16 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: varchar('device_id', { length: 128 }).notNull(),
    platform: varchar('platform', { length: 16 }).notNull(),
    appVersion: varchar('app_version', { length: 32 }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 64 }).notNull(),
    /** Hash of the token this one replaced: presenting it again means the token was stolen and replayed. */
    previousRefreshTokenHash: varchar('previous_refresh_token_hash', { length: 64 }),
    pushToken: text('push_token'),
    ip: varchar('ip', { length: 64 }),
    expiresAt: ts('expires_at').notNull(),
    lastUsedAt: ts('last_used_at').notNull().defaultNow(),
    revokedAt: ts('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [index('auth_sessions_user_idx').on(t.userId)],
);

export const emergencyContacts = pgTable(
  'emergency_contacts',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    phone: varchar('phone', { length: 16 }).notNull(),
    relation: varchar('relation', { length: 40 }),
    createdAt: createdAt(),
  },
  (t) => [index('emergency_contacts_user_idx').on(t.userId)],
);

export const passengerProfiles = pgTable('passenger_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  homeCityId: uuid('home_city_id').references(() => cities.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const driverProfiles = pgTable(
  'driver_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    cityId: uuid('city_id').references(() => cities.id),
    verificationStatus: varchar('verification_status', { length: 32 }).notNull().default('NOT_SUBMITTED'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('driver_profiles_city_status_idx').on(t.cityId, t.verificationStatus)],
);

// ---------------- Geography & configuration ----------------

export const cities = pgTable(
  'cities',
  {
    id: uuid('id').primaryKey(),
    code: varchar('code', { length: 6 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    state: varchar('state', { length: 80 }).notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Kolkata'),
    status: varchar('status', { length: 16 }).notNull().default('DRAFT'),
    center: geographyPoint('center').notNull(),
    settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('cities_code_uq').on(t.code)],
);

export const zones = pgTable(
  'zones',
  {
    id: uuid('id').primaryKey(),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id),
    name: varchar('name', { length: 80 }).notNull(),
    type: varchar('type', { length: 16 }).notNull().default('SERVICE'),
    active: boolean('active').notNull().default(true),
    boundary: geographyPolygon('boundary').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('zones_city_name_uq').on(t.cityId, t.name),
    index('zones_boundary_gix').using('gist', t.boundary),
  ],
);

export const appVersions = pgTable('app_versions', {
  platform: varchar('platform', { length: 16 }).primaryKey(),
  minSupported: varchar('min_supported', { length: 32 }).notNull(),
  latest: varchar('latest', { length: 32 }).notNull(),
  updatedAt: updatedAt(),
});

// ---------------- Admin / staff ----------------

export const staffRoles = pgTable('staff_roles', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 64 }).notNull().unique(),
  description: text('description'),
  permissions: text('permissions').array().notNull().default(sql`'{}'::text[]`),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: createdAt(),
});

export const staffUsers = pgTable('staff_users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  fullName: varchar('full_name', { length: 80 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  /** AES-256-GCM encrypted TOTP secret (iv.tag.ciphertext, base64url). */
  totpSecretEnc: text('totp_secret_enc').notNull(),
  roleId: uuid('role_id')
    .notNull()
    .references(() => staffRoles.id),
  status: varchar('status', { length: 16 }).notNull().default('ACTIVE'),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: ts('locked_until'),
  lastLoginAt: ts('last_login_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorType: varchar('actor_type', { length: 16 }).notNull(),
    actorId: uuid('actor_id'),
    action: varchar('action', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 32 }),
    entityId: varchar('entity_id', { length: 64 }),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: varchar('ip', { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_created_idx').on(t.createdAt),
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
  ],
);
