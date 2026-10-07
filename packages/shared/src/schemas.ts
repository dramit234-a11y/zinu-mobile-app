import { z } from 'zod';
import {
  ClientPlatform,
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

const enumValues = <T extends Record<string, string>>(o: T) =>
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
  driver: { verificationStatus: DriverVerificationStatus; cityId: string | null } | null;
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
