import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    /** HMAC secret for user access tokens. 32+ random chars. */
    JWT_SECRET: z.string().min(32),
    /** Separate secret for admin (staff) sessions so a leak of one cannot mint the other. */
    ADMIN_JWT_SECRET: z.string().min(32),
    /** Pepper for hashing OTP codes at rest. */
    OTP_HMAC_SECRET: z.string().min(32),
    /** 64 hex chars (32 bytes) used to encrypt staff TOTP secrets at rest. */
    STAFF_TOTP_ENC_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'must be 64 hex characters'),
    ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().default(60),
    ADMIN_SESSION_TTL_SEC: z.coerce.number().int().default(8 * 3600),
    OTP_PROVIDER: z.enum(['console', 'msg91']).default('console'),
    /** Development only: include the OTP in the API response so the app can be tested without SMS. */
    OTP_DEV_ECHO: bool,
    OTP_TTL_SEC: z.coerce.number().int().default(300),
    OTP_RESEND_COOLDOWN_SEC: z.coerce.number().int().default(30),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().default(5),
    OTP_MAX_PER_PHONE_PER_HOUR: z.coerce.number().int().default(5),
    // Generous because mobile carriers put many users behind one IP (CGNAT); it only guards against SMS pumping.
    OTP_MAX_PER_IP_PER_HOUR: z.coerce.number().int().default(200),
    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_OTP_TEMPLATE_ID: z.string().optional(),
    /** Comma-separated origins allowed to call the API from a browser (admin dashboard). */
    CORS_ORIGINS: z.string().default(''),
    TRUST_PROXY: bool,
    SUPPORT_EMAIL: z.string().default('support@zinu.in'),

    // ---- File storage (S3 in production; any S3-compatible server such as RustFS locally) ----
    S3_BUCKET: z.string().min(3),
    S3_REGION: z.string().default('ap-south-1'),
    /** Leave empty for AWS S3. For a local S3-compatible server, e.g. http://localhost:9000 */
    S3_ENDPOINT: z.string().optional(),
    /** Endpoint phones/browsers use for uploads and downloads when it differs from S3_ENDPOINT (e.g. your LAN IP). */
    S3_PUBLIC_ENDPOINT: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool,
    /** Leave empty on AWS to use the task's IAM role. */
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    /** Development only: create the bucket on startup if missing. */
    S3_AUTO_CREATE_BUCKET: bool,

    /** 64 hex chars (32 bytes) used to encrypt bank / UPI payout details at rest. */
    PAYOUT_ENC_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'must be 64 hex characters'),

    // ---- Maps (spec §59) ----
    /** "google" needs GOOGLE_MAPS_SERVER_KEY. "demo" uses built-in, clearly labelled demonstration data for Ranchi. */
    MAPS_PROVIDER: z.enum(['google', 'demo']).default('demo'),
    /** Server-side key: Places API (New), Geocoding API, Routes API. Never shipped in the app. */
    GOOGLE_MAPS_SERVER_KEY: z.string().optional(),
    /** Per-user limit on map lookups (autocomplete, place, reverse geocode, quotes) to cap API spend. */
    MAPS_MAX_REQUESTS_PER_HOUR: z.coerce.number().int().default(300),
    QUOTE_TTL_SEC: z.coerce.number().int().default(600),

    // ---- Push notifications ----
    PUSH_PROVIDER: z.enum(['console', 'expo', 'memory']).default('console'),
    /** Optional Expo access token when "enhanced push security" is enabled on the Expo project. */
    EXPO_ACCESS_TOKEN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.OTP_PROVIDER === 'console')
        ctx.addIssue({ code: 'custom', path: ['OTP_PROVIDER'], message: 'console OTP provider is not allowed in production' });
      if (env.MAPS_PROVIDER === 'demo')
        ctx.addIssue({ code: 'custom', path: ['MAPS_PROVIDER'], message: 'demo map data is not allowed in production' });
      if (env.PUSH_PROVIDER === 'memory')
        ctx.addIssue({ code: 'custom', path: ['PUSH_PROVIDER'], message: 'memory push provider is for tests only' });
      if (env.S3_AUTO_CREATE_BUCKET)
        ctx.addIssue({ code: 'custom', path: ['S3_AUTO_CREATE_BUCKET'], message: 'create the production bucket explicitly' });
      if (env.OTP_DEV_ECHO)
        ctx.addIssue({ code: 'custom', path: ['OTP_DEV_ECHO'], message: 'OTP_DEV_ECHO must be false in production' });
    }
    if (env.MAPS_PROVIDER === 'google' && !env.GOOGLE_MAPS_SERVER_KEY)
      ctx.addIssue({ code: 'custom', path: ['GOOGLE_MAPS_SERVER_KEY'], message: 'GOOGLE_MAPS_SERVER_KEY is required for the google maps provider' });
    if (env.OTP_PROVIDER === 'msg91' && (!env.MSG91_AUTH_KEY || !env.MSG91_OTP_TEMPLATE_ID))
      ctx.addIssue({ code: 'custom', path: ['MSG91_AUTH_KEY'], message: 'MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID are required for the msg91 provider' });
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
