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
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.OTP_PROVIDER === 'console')
        ctx.addIssue({ code: 'custom', path: ['OTP_PROVIDER'], message: 'console OTP provider is not allowed in production' });
      if (env.OTP_DEV_ECHO)
        ctx.addIssue({ code: 'custom', path: ['OTP_DEV_ECHO'], message: 'OTP_DEV_ECHO must be false in production' });
    }
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
