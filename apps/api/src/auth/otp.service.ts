import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode, type OtpRequestResponse } from '@zinu/shared';
import { randomInt } from 'node:crypto';
import type { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';
import { AppError } from '../common/errors.js';
import { hmacSha256, safeEqual } from '../common/crypto.js';
import { REDIS } from '../redis/redis.module.js';
import { OTP_SENDER, type OtpSender } from './otp-sender.js';

const key = {
  otp: (phone: string) => `otp:code:${phone}`,
  cooldown: (phone: string) => `otp:cooldown:${phone}`,
  phoneRate: (phone: string) => `otp:rate:phone:${phone}`,
  ipRate: (ip: string) => `otp:rate:ip:${ip}`,
};

/**
 * Issues and verifies 6-digit OTPs. Codes are never stored in plain text (HMAC with a server pepper),
 * expire after OTP_TTL_SEC, allow OTP_MAX_ATTEMPTS guesses, and requests are rate limited per phone and per IP.
 */
@Injectable()
export class OtpService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(OTP_SENDER) private readonly sender: OtpSender,
  ) {}

  async request(phone: string, ip: string): Promise<OtpRequestResponse> {
    const cooldownTtl = await this.redis.ttl(key.cooldown(phone));
    if (cooldownTtl > 0)
      throw new AppError(ErrorCode.OTP_RESEND_TOO_SOON, `Please wait ${cooldownTtl}s before requesting a new OTP`, HttpStatus.TOO_MANY_REQUESTS, { retryAfterSec: cooldownTtl });

    await this.hit(key.phoneRate(phone), this.env.OTP_MAX_PER_PHONE_PER_HOUR);
    await this.hit(key.ipRate(ip), this.env.OTP_MAX_PER_IP_PER_HOUR);

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.sender.send(phone, code);

    const tx = this.redis.multi().set(key.otp(phone), JSON.stringify({ h: this.hash(phone, code), a: 0 }), 'EX', this.env.OTP_TTL_SEC);
    if (this.env.OTP_RESEND_COOLDOWN_SEC > 0) tx.set(key.cooldown(phone), '1', 'EX', this.env.OTP_RESEND_COOLDOWN_SEC);
    await tx.exec();

    return {
      resendAfterSec: this.env.OTP_RESEND_COOLDOWN_SEC,
      expiresInSec: this.env.OTP_TTL_SEC,
      ...(this.env.OTP_DEV_ECHO && this.sender.name === 'console' ? { devCode: code } : {}),
    };
  }

  /** Throws unless the code matches. A correct code can be used once. */
  async verify(phone: string, code: string): Promise<void> {
    const k = key.otp(phone);
    const raw = await this.redis.get(k);
    if (!raw) throw new AppError(ErrorCode.OTP_EXPIRED, 'OTP expired. Please request a new one.');
    const state = JSON.parse(raw) as { h: string; a: number };

    if (state.a >= this.env.OTP_MAX_ATTEMPTS) {
      await this.redis.del(k);
      throw new AppError(ErrorCode.OTP_TOO_MANY_ATTEMPTS, 'Too many wrong attempts. Please request a new OTP.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!safeEqual(state.h, this.hash(phone, code))) {
      const ttl = await this.redis.ttl(k);
      await this.redis.set(k, JSON.stringify({ ...state, a: state.a + 1 }), 'EX', Math.max(ttl, 1));
      throw new AppError(ErrorCode.OTP_INVALID, 'Incorrect OTP', HttpStatus.BAD_REQUEST, {
        attemptsLeft: this.env.OTP_MAX_ATTEMPTS - state.a - 1,
      });
    }
    // Single use: only the first concurrent verifier succeeds.
    if ((await this.redis.del(k)) === 0) throw new AppError(ErrorCode.OTP_EXPIRED, 'OTP expired. Please request a new one.');
  }

  private hash(phone: string, code: string) {
    return hmacSha256(this.env.OTP_HMAC_SECRET, `${phone}:${code}`);
  }

  private async hit(k: string, limit: number) {
    const [[, count]] = (await this.redis.multi().incr(k).expire(k, 3600, 'NX').exec()) as [[null, number], unknown];
    if (count > limit)
      throw new AppError(ErrorCode.RATE_LIMITED, 'Too many OTP requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
