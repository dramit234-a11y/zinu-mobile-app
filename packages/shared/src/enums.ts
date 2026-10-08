/** Roles a single ZINU account (one mobile number) can hold. */
export const Role = {
  PASSENGER: 'PASSENGER',
  DRIVER: 'DRIVER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const ROLES = Object.values(Role);

/**
 * Lifecycle of a role on an account.
 * Passenger roles are ACTIVE immediately. Driver roles start in ONBOARDING and only become
 * ACTIVE after verification (Phase 2).
 */
export const RoleStatus = {
  ONBOARDING: 'ONBOARDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type RoleStatus = (typeof RoleStatus)[keyof typeof RoleStatus];

/** Driver verification statuses (spec §27). */
export const DriverVerificationStatus = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PROFILE_SUBMITTED: 'PROFILE_SUBMITTED',
  DOCUMENTS_UNDER_REVIEW: 'DOCUMENTS_UNDER_REVIEW',
  APPROVED: 'APPROVED',
  ADDITIONAL_INFO_REQUIRED: 'ADDITIONAL_INFO_REQUIRED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const;
export type DriverVerificationStatus =
  (typeof DriverVerificationStatus)[keyof typeof DriverVerificationStatus];

/** Supported UI languages. Add regional languages here and in the mobile i18n resources. */
export const Language = {
  EN: 'en',
  HI: 'hi',
} as const;
export type Language = (typeof Language)[keyof typeof Language];
export const LANGUAGES = Object.values(Language);

export const ClientPlatform = {
  ANDROID: 'android',
  IOS: 'ios',
  WEB: 'web',
} as const;
export type ClientPlatform = (typeof ClientPlatform)[keyof typeof ClientPlatform];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED',
  DELETED: 'DELETED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const CityStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
} as const;
export type CityStatus = (typeof CityStatus)[keyof typeof CityStatus];

export const ZoneType = {
  SERVICE: 'SERVICE',
  PREFERRED: 'PREFERRED',
  AIRPORT: 'AIRPORT',
  RAILWAY: 'RAILWAY',
  RESTRICTED: 'RESTRICTED',
} as const;
export type ZoneType = (typeof ZoneType)[keyof typeof ZoneType];

/** Granular admin permissions. Staff roles are sets of these. */
export const Permission = {
  DASHBOARD_VIEW: 'dashboard.view',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  CITIES_VIEW: 'cities.view',
  CITIES_MANAGE: 'cities.manage',
  ZONES_MANAGE: 'zones.manage',
  DRIVERS_VIEW: 'drivers.view',
  DRIVERS_VERIFY: 'drivers.verify',
  DRIVERS_SUSPEND: 'drivers.suspend',
  DOCUMENTS_VIEW_FILES: 'documents.view_files',
  DOCUMENT_RULES_MANAGE: 'document_rules.manage',
  PRICING_MANAGE: 'pricing.manage',
  STAFF_MANAGE: 'staff.manage',
  AUDIT_VIEW: 'audit.view',
  SETTINGS_MANAGE: 'settings.manage',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];
export const PERMISSIONS = Object.values(Permission);

// ---------------- Phase 2: drivers, vehicles, documents ----------------

/** Physical vehicle types a driver can register (ride categories and pricing are configured separately). */
export const VehicleType = {
  BIKE: 'BIKE',
  TOTO: 'TOTO',
  AUTO: 'AUTO',
  CAB: 'CAB',
} as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

export const FuelType = {
  ELECTRIC: 'ELECTRIC',
  PETROL: 'PETROL',
  DIESEL: 'DIESEL',
  CNG: 'CNG',
  LPG: 'LPG',
} as const;
export type FuelType = (typeof FuelType)[keyof typeof FuelType];

/** Spec §40. */
export const OwnershipType = {
  DRIVER_OWNED: 'DRIVER_OWNED',
  ZINU_OWNED: 'ZINU_OWNED',
  FLEET_PARTNER: 'FLEET_PARTNER',
} as const;
export type OwnershipType = (typeof OwnershipType)[keyof typeof OwnershipType];

export const DocumentStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

/** Built-in document types. Requirements (required, expiry rules, reminders) are admin-configurable. */
export const DocType = {
  DRIVING_LICENCE: 'DRIVING_LICENCE',
  PROFILE_PHOTO: 'PROFILE_PHOTO',
  VEHICLE_RC: 'VEHICLE_RC',
  INSURANCE: 'INSURANCE',
  PUC: 'PUC',
  PERMIT: 'PERMIT',
  VEHICLE_PHOTOS: 'VEHICLE_PHOTOS',
} as const;
export type DocType = (typeof DocType)[keyof typeof DocType];

export const PayoutMethod = { BANK: 'BANK', UPI: 'UPI' } as const;
export type PayoutMethod = (typeof PayoutMethod)[keyof typeof PayoutMethod];

export const UploadPurpose = { DRIVER_DOCUMENT: 'DRIVER_DOCUMENT' } as const;
export type UploadPurpose = (typeof UploadPurpose)[keyof typeof UploadPurpose];

export const UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
