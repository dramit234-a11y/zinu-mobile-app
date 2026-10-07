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
  STAFF_MANAGE: 'staff.manage',
  AUDIT_VIEW: 'audit.view',
  SETTINGS_MANAGE: 'settings.manage',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];
export const PERMISSIONS = Object.values(Permission);
