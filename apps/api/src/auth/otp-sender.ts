import { HttpStatus, Logger } from '@nestjs/common';
import { ErrorCode } from '@zinu/shared';
import type { Env } from '../config/env.js';
import { AppError } from '../common/errors.js';

/** Delivers an OTP to a phone. Swap providers via OTP_PROVIDER without touching auth logic. */
export interface OtpSender {
  readonly name: string;
  send(phoneE164: string, code: string): Promise<void>;
}

export const OTP_SENDER = Symbol('OTP_SENDER');

/** Development provider: writes the code to the API log. Refused in production by env validation. */
export class ConsoleOtpSender implements OtpSender {
  readonly name = 'console';
  private readonly logger = new Logger('ConsoleOtpSender');
  async send(phone: string, code: string) {
    this.logger.warn(`[DEV] OTP for ${phone}: ${code}`);
  }
}

/**
 * MSG91 OTP API (v5). Requires a MSG91 account, TRAI DLT-registered sender ID and an approved OTP template
 * whose variable receives our server-generated code.
 */
export class Msg91OtpSender implements OtpSender {
  readonly name = 'msg91';
  private readonly logger = new Logger('Msg91OtpSender');

  constructor(
    private readonly authKey: string,
    private readonly templateId: string,
  ) {}

  async send(phone: string, code: string) {
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('template_id', this.templateId);
    url.searchParams.set('mobile', phone.replace(/^\+/, ''));
    url.searchParams.set('otp', code);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { authkey: this.authKey, 'content-type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
      if (!res.ok || body.type === 'error') throw new Error(body.message ?? `HTTP ${res.status}`);
    } catch (e) {
      this.logger.error(`MSG91 delivery failed: ${(e as Error).message}`);
      throw new AppError(ErrorCode.OTP_DELIVERY_FAILED, 'Could not send OTP. Please try again.', HttpStatus.BAD_GATEWAY);
    }
  }
}

export function createOtpSender(env: Env): OtpSender {
  if (env.OTP_PROVIDER === 'msg91') return new Msg91OtpSender(env.MSG91_AUTH_KEY!, env.MSG91_OTP_TEMPLATE_ID!);
  return new ConsoleOtpSender();
}
