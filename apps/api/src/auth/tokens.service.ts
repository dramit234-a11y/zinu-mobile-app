import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode, type AuthTokensDto, type DeviceInfo } from '@zinu/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { ENV, type Env } from '../config/env.js';
import { AppError } from '../common/errors.js';
import { randomToken, safeEqual, sha256 } from '../common/crypto.js';
import { uuidv7 } from '../common/ids.js';
import { DB, type Db } from '../db/db.module.js';
import { authSessions } from '../db/schema.js';

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

const AUDIENCE = 'zinu-app';
const ISSUER = 'zinu-api';

/**
 * Short-lived JWT access tokens + opaque rotating refresh tokens bound to a device session.
 * Refresh token format: `<sessionId>.<secret>`; only sha256(secret) is stored.
 * Re-use of an already-rotated refresh token revokes the whole session (token theft detection).
 */
@Injectable()
export class TokensService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
  ) {
    this.key = new TextEncoder().encode(env.JWT_SECRET);
  }

  async createSession(userId: string, device: DeviceInfo, ip: string): Promise<AuthTokensDto> {
    // One active session per device: logging in again on the same device replaces the old session.
    await this.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.userId, userId), eq(authSessions.deviceId, device.deviceId), isNull(authSessions.revokedAt)));

    const sessionId = uuidv7();
    const secret = randomToken();
    await this.db.insert(authSessions).values({
      id: sessionId,
      userId,
      deviceId: device.deviceId,
      platform: device.platform,
      appVersion: device.appVersion ?? null,
      refreshTokenHash: sha256(secret),
      ip,
      expiresAt: this.refreshExpiry(),
    });
    return this.issue(userId, sessionId, secret);
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const [sessionId, secret] = refreshToken.split('.');
    const invalid = () => new AppError(ErrorCode.REFRESH_TOKEN_INVALID, 'Session expired. Please log in again.', HttpStatus.UNAUTHORIZED);
    if (!sessionId || !secret || !/^[0-9a-f-]{36}$/.test(sessionId)) throw invalid();

    const session = await this.db.query.authSessions.findFirst({ where: eq(authSessions.id, sessionId) });
    if (!session || session.revokedAt || session.expiresAt < new Date()) throw invalid();

    const presented = sha256(secret);
    if (!safeEqual(presented, session.refreshTokenHash)) {
      if (session.previousRefreshTokenHash && safeEqual(presented, session.previousRefreshTokenHash)) {
        await this.revokeSession(sessionId);
      }
      throw invalid();
    }

    const next = randomToken();
    const updated = await this.db
      .update(authSessions)
      .set({
        refreshTokenHash: sha256(next),
        previousRefreshTokenHash: session.refreshTokenHash,
        lastUsedAt: new Date(),
        expiresAt: this.refreshExpiry(),
      })
      // Compare-and-swap so two concurrent refreshes cannot both succeed.
      .where(and(eq(authSessions.id, sessionId), eq(authSessions.refreshTokenHash, session.refreshTokenHash)))
      .returning({ id: authSessions.id });
    if (updated.length === 0) throw invalid();
    return this.issue(session.userId, sessionId, next);
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, { audience: AUDIENCE, issuer: ISSUER, algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw new Error('bad claims');
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Invalid or expired access token', HttpStatus.UNAUTHORIZED);
    }
  }

  async revokeSession(sessionId: string) {
    await this.db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, sessionId));
  }

  async revokeAllForUser(userId: string) {
    await this.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
  }

  private async issue(userId: string, sessionId: string, secret: string): Promise<AuthTokensDto> {
    const exp = Math.floor(Date.now() / 1000) + this.env.ACCESS_TOKEN_TTL_SEC;
    const accessToken = await new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setAudience(AUDIENCE)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(this.key);
    return { accessToken, accessTokenExpiresAt: new Date(exp * 1000).toISOString(), refreshToken: `${sessionId}.${secret}` };
  }

  private refreshExpiry() {
    return new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  }
}
