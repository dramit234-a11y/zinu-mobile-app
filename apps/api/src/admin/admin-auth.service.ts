import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode, type Permission } from '@zinu/shared';
import argon2 from 'argon2';
import { eq, sql } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { ENV, type Env } from '../config/env.js';
import { decrypt } from '../common/crypto.js';
import { AppError } from '../common/errors.js';
import { verifyTotp } from '../common/totp.js';
import { DB, type Db } from '../db/db.module.js';
import { staffRoles, staffUsers } from '../db/schema.js';

export interface StaffPrincipal {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions: Permission[];
}

const AUDIENCE = 'zinu-admin';
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

// Used to keep response timing similar when the email does not exist.
const DUMMY_HASH = argon2.hash('not-a-real-password');

@Injectable()
export class AdminAuthService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
  ) {
    this.key = new TextEncoder().encode(env.ADMIN_JWT_SECRET);
  }

  /** Email + password + mandatory TOTP. Accounts lock for 15 minutes after 5 failures. */
  async login(email: string, password: string, totp: string | undefined): Promise<{ token: string; staff: StaffPrincipal }> {
    const invalid = () => new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email, password or code', HttpStatus.UNAUTHORIZED);
    const staff = await this.db.query.staffUsers.findFirst({ where: eq(staffUsers.email, email) });
    if (!staff) {
      await argon2.verify(await DUMMY_HASH, password).catch(() => false);
      throw invalid();
    }
    if (staff.status !== 'ACTIVE') throw invalid();
    if (staff.lockedUntil && staff.lockedUntil > new Date())
      throw new AppError(ErrorCode.RATE_LIMITED, 'Account temporarily locked. Try again later.', HttpStatus.TOO_MANY_REQUESTS);

    const passwordOk = await argon2.verify(staff.passwordHash, password);
    if (passwordOk && !totp) throw new AppError(ErrorCode.TOTP_REQUIRED, 'Enter the 6-digit code from your authenticator app', HttpStatus.UNAUTHORIZED);
    const totpOk = passwordOk && !!totp && verifyTotp(decrypt(this.env.STAFF_TOTP_ENC_KEY, staff.totpSecretEnc), totp);

    if (!totpOk) {
      await this.db
        .update(staffUsers)
        .set({
          failedLoginCount: sql`${staffUsers.failedLoginCount} + 1`,
          lockedUntil: staff.failedLoginCount + 1 >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        })
        .where(eq(staffUsers.id, staff.id));
      throw invalid();
    }

    await this.db.update(staffUsers).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(staffUsers.id, staff.id));
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(staff.id)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.env.ADMIN_SESSION_TTL_SEC}s`)
      .sign(this.key);
    return { token, staff: (await this.loadPrincipal(staff.id))! };
  }

  async verify(token: string): Promise<StaffPrincipal | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { audience: AUDIENCE, algorithms: ['HS256'] });
      return payload.sub ? this.loadPrincipal(payload.sub) : null;
    } catch {
      return null;
    }
  }

  /** Permissions are re-read on every request so role changes and deactivation take effect immediately. */
  async loadPrincipal(staffId: string): Promise<StaffPrincipal | null> {
    const [row] = await this.db
      .select({ id: staffUsers.id, email: staffUsers.email, fullName: staffUsers.fullName, status: staffUsers.status, role: staffRoles.name, permissions: staffRoles.permissions })
      .from(staffUsers)
      .innerJoin(staffRoles, eq(staffRoles.id, staffUsers.roleId))
      .where(eq(staffUsers.id, staffId));
    if (!row || row.status !== 'ACTIVE') return null;
    return { id: row.id, email: row.email, fullName: row.fullName, role: row.role, permissions: row.permissions as Permission[] };
  }
}
