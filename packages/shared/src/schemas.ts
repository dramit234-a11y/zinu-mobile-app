import { z } from 'zod';
import {
  ClientPlatform,
  DocType,
  FuelType,
  MAX_UPLOAD_BYTES,
  OwnershipType,
  PayoutMethod,
  UPLOAD_CONTENT_TYPES,
  UploadPurpose,
  VehicleType,
  type DocumentStatus,
  CityStatus,
  DriverVerificationStatus,
  LANGUAGES,
  Permission,
  Role,
  RoleStatus,
  UserStatus,
  ZoneType,
} from './enums.js';
import { normalizeIndianMobile } from './phone.js';

export const enumValues = <T extends Record<string, string>>(o: T) =>
  Object.values(o) as [T[keyof T], ...T[keyof T][]];

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeIndianMobile(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit Indian mobile number' });
      return z.NEVER;
    }
    return n;
  });

export const languageSchema = z.enum(LANGUAGES as ['en', 'hi']);
export const roleSchema = z.enum(enumValues(Role));

// ---------- Auth ----------

export const deviceSchema = z.object({
  deviceId: z.string().min(8).max(128),
  platform: z.enum(enumValues(ClientPlatform)),
  appVersion: z.string().max(32).optional(),
});
export type DeviceInfo = z.infer<typeof deviceSchema>;

export const otpRequestSchema = z.object({
  phone: phoneSchema,
  deviceId: z.string().min(8).max(128),
});
export type OtpRequestInput = z.input<typeof otpRequestSchema>;

export const otpRequestResponseSchema = z.object({
  /** Seconds until the user may request another OTP. */
  resendAfterSec: z.number(),
  expiresInSec: z.number(),
  /** Only present when the server runs with the development console OTP provider. */
  devCode: z.string().optional(),
});
export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>;

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP'),
  device: deviceSchema,
});
export type OtpVerifyInput = z.input<typeof otpVerifySchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

// ---------- Users ----------

export const userRoleSchema = z.object({
  role: roleSchema,
  status: z.enum(enumValues(RoleStatus)),
});
export type UserRoleDto = z.infer<typeof userRoleSchema>;

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  relation: z.string().trim().max(40).optional(),
});
export type EmergencyContactInput = z.input<typeof emergencyContactSchema>;
export type EmergencyContactDto = z.output<typeof emergencyContactSchema> & { id: string };

export interface MeDto {
  id: string;
  phone: string;
  fullName: string | null;
  email: string | null;
  language: 'en' | 'hi';
  status: UserStatus;
  profileComplete: boolean;
  roles: UserRoleDto[];
  emergencyContacts: EmergencyContactDto[];
  driver: { verificationStatus: DriverVerificationStatus; cityId: string | null; statusReason: string | null } | null;
  createdAt: string;
}

export interface AuthTokensDto {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}

export interface AuthResponseDto extends AuthTokensDto {
  isNewUser: boolean;
  user: MeDto;
}

export const updateMeSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    email: z.union([z.email().max(254), z.literal('')]).transform((v) => v || null),
    language: languageSchema,
  })
  .partial();
export type UpdateMeInput = z.input<typeof updateMeSchema>;

/** Completing the passenger profile (spec §8). */
export const passengerProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(80),
  email: z.union([z.email('Enter a valid email').max(254), z.literal('')]).optional(),
  language: languageSchema,
  emergencyContact: emergencyContactSchema.optional(),
});
export type PassengerProfileInput = z.input<typeof passengerProfileSchema>;

export const activateRoleSchema = z.object({ role: roleSchema });

export const replaceEmergencyContactsSchema = z.object({
  contacts: z.array(emergencyContactSchema).max(5),
});

// ---------- App config ----------

export interface AppConfigDto {
  minSupportedVersion: string;
  latestVersion: string;
  updateRequired: boolean;
  updateAvailable: boolean;
  supportedLanguages: string[];
  supportEmail: string;
}

// ---------- Admin ----------

export const adminLoginSchema = z.object({
  email: z.email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
  totp: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export const permissionSchema = z.enum(enumValues(Permission));

export const createCitySchema = z.object({
  name: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z]{3,6}$/, 'Use 3-6 capital letters, e.g. RNC'),
  timezone: z.string().default('Asia/Kolkata'),
  status: z.enum(enumValues(CityStatus)).default('DRAFT'),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
});
export const updateCitySchema = createCitySchema.partial();

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export const geoJsonPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(position).min(4)).min(1),
});

export const createZoneSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(enumValues(ZoneType)).default('SERVICE'),
  active: z.boolean().default(true),
  boundary: geoJsonPolygonSchema,
});
export const updateZoneSchema = createZoneSchema.partial();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
  q: z.string().trim().max(80).optional(),
});

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ---------------- Phase 2: driver registration ----------------

/** "JH 01 AB 1234" / "jh-01-ab-1234" -> "JH01AB1234"; null when not a valid Indian registration number. */
export function normalizeVehicleNumber(input: string): string | null {
  const v = input.toUpperCase().replace(/[\s-]/g, '');
  const standard = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/;
  const bharat = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
  return v.length >= 6 && (standard.test(v) || bharat.test(v)) ? v : null;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');

/** Whole years between an ISO date and today (UTC). */
export function ageOn(isoDob: string, today = new Date()): number {
  const [y, m, d] = isoDob.split('-').map(Number) as [number, number, number];
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) age--;
  return age;
}

export const driverPersonalSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  dateOfBirth: isoDate.refine((v) => ageOn(v) >= 18, 'You must be at least 18 years old').refine((v) => ageOn(v) <= 80, 'Check the date of birth'),
  address: z.string().trim().min(10, 'Enter your full address').max(300),
  cityId: z.uuid(),
});
export type DriverPersonalInput = z.input<typeof driverPersonalSchema>;

export const driverVehicleSchema = z
  .object({
    vehicleType: z.enum(enumValues(VehicleType)),
    fuelType: z.enum(enumValues(FuelType)),
    registrationNumber: z.string().transform((v, ctx) => {
      const n = normalizeVehicleNumber(v);
      if (!n) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid vehicle number, e.g. JH01AB1234' });
        return z.NEVER;
      }
      return n;
    }),
    ownershipType: z.enum(enumValues(OwnershipType)),
    fleetPartnerName: z.string().trim().max(120).optional(),
    make: z.string().trim().max(60).optional(),
    model: z.string().trim().max(60).optional(),
    colour: z.string().trim().max(30).optional(),
    manufactureYear: z.number().int().min(1990).max(new Date().getUTCFullYear() + 1).optional(),
  })
  .refine((v) => v.vehicleType !== 'TOTO' || v.fuelType === 'ELECTRIC', { path: ['fuelType'], message: 'A Toto is electric' })
  .refine((v) => v.ownershipType !== 'FLEET_PARTNER' || !!v.fleetPartnerName, { path: ['fleetPartnerName'], message: 'Enter the fleet partner name' });
export type DriverVehicleInput = z.input<typeof driverVehicleSchema>;

export const presignUploadSchema = z.object({
  purpose: z.enum(enumValues(UploadPurpose)),
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES, 'File is larger than 10 MB'),
});
export type PresignUploadInput = z.input<typeof presignUploadSchema>;

export interface PresignedUploadDto {
  uploadId: string;
  url: string;
  fields: Record<string, string>;
  expiresAt: string;
}

export const submitDocumentSchema = z.object({
  documentNumber: z.string().trim().min(3).max(64).optional(),
  expiresOn: isoDate.optional(),
  uploadIds: z.array(z.uuid()).min(1).max(6),
});
export type SubmitDocumentInput = z.input<typeof submitDocumentSchema>;

export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export const payoutSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal(PayoutMethod.BANK),
    holderName: z.string().trim().min(2).max(100),
    accountNumber: z.string().trim().regex(/^\d{9,18}$/, 'Account number must be 9–18 digits'),
    ifsc: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(IFSC_RE, 'Enter a valid IFSC, e.g. SBIN0001234')),
  }),
  z.object({
    method: z.literal(PayoutMethod.UPI),
    holderName: z.string().trim().min(2).max(100),
    upiId: z.string().trim().regex(UPI_RE, 'Enter a valid UPI ID, e.g. name@okbank'),
  }),
]);
export type PayoutInput = z.input<typeof payoutSchema>;

export interface DocumentTypeDto {
  code: DocType;
  label: string;
  ownerType: 'DRIVER' | 'VEHICLE';
  required: boolean;
  requiresNumber: boolean;
  requiresExpiry: boolean;
  minFiles: number;
  maxFiles: number;
  blockOnlineWhenExpired: boolean;
  reminderDays: number[];
}

export interface DriverDocumentDto {
  id: string;
  docType: DocType;
  documentNumber: string | null;
  expiresOn: string | null;
  status: DocumentStatus;
  rejectionReason: string | null;
  fileIds: string[];
  createdAt: string;
}

export interface EligibilityDto {
  canGoOnline: boolean;
  reasons: { code: string; message: string; docType?: DocType }[];
}

export interface DriverRegistrationDto {
  status: DriverVerificationStatus;
  statusReason: string | null;
  editable: boolean;
  personal: { fullName: string | null; dateOfBirth: string | null; address: string | null; cityId: string | null };
  vehicle: (z.output<typeof driverVehicleSchema> & { id: string; status: string }) | null;
  /** Document types that apply to this driver (given vehicle fuel type), with the latest version of each. */
  documents: { type: DocumentTypeDto; current: DriverDocumentDto | null; inForce: DriverDocumentDto | null }[];
  payout: { method: PayoutMethod; holderName: string; maskedLabel: string; status: string } | null;
  emergencyContactCount: number;
  checklist: { personal: boolean; vehicle: boolean; documents: boolean; payout: boolean; emergencyContact: boolean };
  canSubmit: boolean;
  eligibility: EligibilityDto;
}

export const pushTokenSchema = z.object({
  token: z.string().min(10).max(512),
  provider: z.enum(['expo', 'fcm', 'apns']),
});

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

// ---------- Admin: verification ----------

export const reasonSchema = z.object({ reason: z.string().trim().min(5, 'Give a reason the driver will understand').max(500) });
export const requestInfoSchema = z.object({
  message: z.string().trim().min(5).max(500),
  /** Documents to mark as rejected so the driver re-uploads them. */
  documentIds: z.array(z.uuid()).max(20).default([]),
});
export const updateDocumentTypeSchema = z
  .object({
    required: z.boolean(),
    blockOnlineWhenExpired: z.boolean(),
    reminderDays: z.array(z.number().int().min(0).max(365)).max(10),
  })
  .partial();
