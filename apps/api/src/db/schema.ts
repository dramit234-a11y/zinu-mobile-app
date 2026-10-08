import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  date,
  doublePrecision,
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
    /** Which push provider issued pushToken (expo | fcm | apns). */
    pushProvider: varchar('push_provider', { length: 16 }),
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
    dateOfBirth: date('date_of_birth', { mode: 'string' }),
    address: text('address'),
    /** Message shown to the driver for ADDITIONAL_INFO_REQUIRED / REJECTED / SUSPENDED. */
    statusReason: text('status_reason'),
    submittedAt: ts('submitted_at'),
    approvedAt: ts('approved_at'),
    reviewedBy: uuid('reviewed_by'),
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

// ---------------- Drivers: vehicles, documents, payouts (Phase 2) ----------------

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey(),
    /** Normalised: upper case, no spaces or dashes (e.g. JH01AB1234). */
    registrationNumber: varchar('registration_number', { length: 16 }).notNull(),
    vehicleType: varchar('vehicle_type', { length: 16 }).notNull(),
    fuelType: varchar('fuel_type', { length: 16 }).notNull(),
    ownershipType: varchar('ownership_type', { length: 24 }).notNull(),
    fleetPartnerName: varchar('fleet_partner_name', { length: 120 }),
    make: varchar('make', { length: 60 }),
    model: varchar('model', { length: 60 }),
    colour: varchar('colour', { length: 30 }),
    manufactureYear: integer('manufacture_year'),
    cityId: uuid('city_id').references(() => cities.id),
    status: varchar('status', { length: 16 }).notNull().default('PENDING'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('vehicles_registration_uq').on(t.registrationNumber)],
);

/** Which driver drives which vehicle. A ZINU/fleet vehicle may be shared across shifts; a driver-owned one may not. */
export const driverVehicles = pgTable(
  'driver_vehicles',
  {
    id: uuid('id').primaryKey(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    endedAt: ts('ended_at'),
  },
  (t) => [
    index('driver_vehicles_driver_idx').on(t.driverId),
    index('driver_vehicles_vehicle_idx').on(t.vehicleId),
    uniqueIndex('driver_vehicles_one_active_uq').on(t.driverId).where(sql`active`),
  ],
);

/** Admin-configurable document requirements (spec §26, §41). */
export const documentTypes = pgTable('document_types', {
  code: varchar('code', { length: 32 }).primaryKey(),
  label: varchar('label', { length: 80 }).notNull(),
  ownerType: varchar('owner_type', { length: 16 }).notNull(),
  required: boolean('required').notNull().default(true),
  requiresNumber: boolean('requires_number').notNull().default(false),
  requiresExpiry: boolean('requires_expiry').notNull().default(false),
  minFiles: integer('min_files').notNull().default(1),
  maxFiles: integer('max_files').notNull().default(2),
  /** Fuel types this document applies to; null = all (e.g. PUC does not apply to electric vehicles). */
  fuelTypes: text('fuel_types').array(),
  /** When an approved document of this type expires, the driver cannot go online. */
  blockOnlineWhenExpired: boolean('block_online_when_expired').notNull().default(true),
  /** Days before expiry on which reminders are sent. */
  reminderDays: integer('reminder_days').array().notNull().default(sql`'{30,15,7,1}'::int[]`),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: updatedAt(),
});

/** Every file upload, created when the client asks for an upload URL and confirmed after the object exists. */
export const uploads = pgTable(
  'uploads',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: varchar('purpose', { length: 32 }).notNull(),
    storageKey: text('storage_key').notNull(),
    contentType: varchar('content_type', { length: 64 }).notNull(),
    maxBytes: integer('max_bytes').notNull(),
    sizeBytes: integer('size_bytes'),
    status: varchar('status', { length: 16 }).notNull().default('PENDING'),
    createdAt: createdAt(),
    confirmedAt: ts('confirmed_at'),
  },
  (t) => [index('uploads_owner_idx').on(t.ownerId)],
);

/**
 * One row per submitted version of a document. Re-uploading creates a new version; the newest
 * approved version is the one in force, so a renewal can be reviewed while the old one is still valid.
 */
export const driverDocuments = pgTable(
  'driver_documents',
  {
    id: uuid('id').primaryKey(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id),
    docType: varchar('doc_type', { length: 32 })
      .notNull()
      .references(() => documentTypes.code),
    documentNumber: varchar('document_number', { length: 64 }),
    expiresOn: date('expires_on', { mode: 'string' }),
    status: varchar('status', { length: 16 }).notNull().default('PENDING'),
    rejectionReason: text('rejection_reason'),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: ts('reviewed_at'),
    supersededAt: ts('superseded_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('driver_documents_driver_idx').on(t.driverId, t.docType),
    index('driver_documents_expiry_idx').on(t.expiresOn).where(sql`status = 'APPROVED' and superseded_at is null`),
  ],
);

export const documentFiles = pgTable(
  'document_files',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => driverDocuments.id, { onDelete: 'cascade' }),
    uploadId: uuid('upload_id')
      .notNull()
      .references(() => uploads.id),
    position: integer('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.position] }), uniqueIndex('document_files_upload_uq').on(t.uploadId)],
);

/** Makes expiry reminders idempotent: one reminder per document per threshold. */
export const documentReminders = pgTable(
  'document_reminders',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => driverDocuments.id, { onDelete: 'cascade' }),
    thresholdDays: integer('threshold_days').notNull(),
    sentAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.thresholdDays] })],
);

/** Bank/UPI payout details. Full details are encrypted at rest; only a masked label is ever returned. */
export const payoutAccounts = pgTable(
  'payout_accounts',
  {
    id: uuid('id').primaryKey(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    method: varchar('method', { length: 8 }).notNull(),
    holderName: varchar('holder_name', { length: 100 }).notNull(),
    detailsEnc: text('details_enc').notNull(),
    maskedLabel: varchar('masked_label', { length: 64 }).notNull(),
    ifsc: varchar('ifsc', { length: 11 }),
    status: varchar('status', { length: 24 }).notNull().default('PENDING_VERIFICATION'),
    active: boolean('active').notNull().default(true),
    verifiedBy: uuid('verified_by'),
    verifiedAt: ts('verified_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('payout_accounts_one_active_uq').on(t.driverId).where(sql`active`)],
);

/** In-app notification inbox; each row is also pushed to the user's devices when possible. */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 48 }).notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: jsonb('data'),
    pushStatus: varchar('push_status', { length: 16 }).notNull().default('PENDING'),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

// ---------------- Rides: categories, pricing, quotes, places (Phase 3) ----------------

/** Catalogue of ride categories (spec §12). Which ones a city offers is in city_ride_categories. */
export const rideCategories = pgTable('ride_categories', {
  code: varchar('code', { length: 16 }).primaryKey(),
  name: varchar('name', { length: 40 }).notNull(),
  description: varchar('description', { length: 120 }).notNull(),
  capacity: integer('capacity').notNull(),
  /** Vehicle types that can serve this category (driver vehicle_type). */
  vehicleTypes: text('vehicle_types').array().notNull(),
  perSeat: boolean('per_seat').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const cityRideCategories = pgTable(
  'city_ride_categories',
  {
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id),
    categoryCode: varchar('category_code', { length: 16 })
      .notNull()
      .references(() => rideCategories.code),
    enabled: boolean('enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.cityId, t.categoryCode] })],
);

/** Versioned fares per city and category (spec §13). Rows are never edited: a change is a new version. */
export const pricingRules = pgTable(
  'pricing_rules',
  {
    id: uuid('id').primaryKey(),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id),
    categoryCode: varchar('category_code', { length: 16 })
      .notNull()
      .references(() => rideCategories.code),
    version: integer('version').notNull(),
    baseFarePaise: integer('base_fare_paise').notNull(),
    baseDistanceM: integer('base_distance_m').notNull(),
    perKmPaise: integer('per_km_paise').notNull(),
    perMinPaise: integer('per_min_paise').notNull(),
    minFarePaise: integer('min_fare_paise').notNull(),
    platformFeePaise: integer('platform_fee_paise').notNull(),
    taxBps: integer('tax_bps').notNull(),
    nightSurchargeBps: integer('night_surcharge_bps').notNull(),
    nightStartHour: integer('night_start_hour').notNull(),
    nightEndHour: integer('night_end_hour').notNull(),
    note: varchar('note', { length: 200 }),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('pricing_rules_version_uq').on(t.cityId, t.categoryCode, t.version)],
);

/** A priced option shown to a passenger. Phase 4 books against a quote id so the fare can't be altered by the client. */
export const fareQuotes = pgTable(
  'fare_quotes',
  {
    id: uuid('id').primaryKey(),
    groupId: uuid('group_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id),
    categoryCode: varchar('category_code', { length: 16 }).notNull(),
    pricingRuleId: uuid('pricing_rule_id')
      .notNull()
      .references(() => pricingRules.id),
    pickup: jsonb('pickup').notNull(),
    dropoff: jsonb('dropoff').notNull(),
    distanceM: integer('distance_m').notNull(),
    durationS: integer('duration_s').notNull(),
    polyline: text('polyline').notNull(),
    breakdown: jsonb('breakdown').notNull(),
    totalPaise: integer('total_paise').notNull(),
    mapsProvider: varchar('maps_provider', { length: 16 }).notNull(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('fare_quotes_user_idx').on(t.userId, t.createdAt), index('fare_quotes_group_idx').on(t.groupId)],
);

export const savedPlaces = pgTable(
  'saved_places',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 8 }).notNull(),
    name: varchar('name', { length: 120 }),
    address: varchar('address', { length: 300 }).notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    placeId: varchar('place_id', { length: 300 }),
    createdAt: createdAt(),
  },
  (t) => [index('saved_places_user_idx').on(t.userId), uniqueIndex('saved_places_home_work_uq').on(t.userId, t.label).where(sql`label in ('HOME','WORK')`)],
);

export const recentPlaces = pgTable(
  'recent_places',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }),
    address: varchar('address', { length: 300 }).notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    placeId: varchar('place_id', { length: 300 }),
    usedAt: ts('used_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('recent_places_user_address_uq').on(t.userId, t.address), index('recent_places_user_idx').on(t.userId, t.usedAt)],
);
