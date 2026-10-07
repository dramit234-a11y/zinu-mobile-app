import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import {
  otpRequestSchema,
  otpVerifySchema,
  refreshSchema,
  type AuthResponseDto,
  type AuthTokensDto,
  type OtpRequestResponse,
} from '@zinu/shared';
import type { Request } from 'express';
import type { z } from 'zod';
import { AuditService } from '../common/audit.service.js';
import { clientIp } from '../common/request.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { UsersService } from '../users/users.service.js';
import { CurrentAuth, UserAuthGuard } from './auth.guard.js';
import { OtpService } from './otp.service.js';
import { TokensService, type AccessClaims } from './tokens.service.js';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokensService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Post('otp/request')
  @HttpCode(200)
  requestOtp(@Body(new ZodPipe(otpRequestSchema)) body: z.output<typeof otpRequestSchema>, @Req() req: Request): Promise<OtpRequestResponse> {
    return this.otp.request(body.phone, clientIp(req));
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body(new ZodPipe(otpVerifySchema)) body: z.output<typeof otpVerifySchema>, @Req() req: Request): Promise<AuthResponseDto> {
    await this.otp.verify(body.phone, body.code);
    const { userId, isNew } = await this.users.findOrCreateByPhone(body.phone);
    const tokens = await this.tokens.createSession(userId, body.device, clientIp(req));
    await this.audit.record({
      actorType: 'USER',
      actorId: userId,
      action: isNew ? 'user.registered' : 'user.login',
      entityType: 'user',
      entityId: userId,
      after: { platform: body.device.platform },
      ip: clientIp(req),
    });
    return { ...tokens, isNewUser: isNew, user: await this.users.getMe(userId) };
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshSchema)) body: z.output<typeof refreshSchema>): Promise<AuthTokensDto> {
    return this.tokens.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(UserAuthGuard)
  async logout(@CurrentAuth() auth: AccessClaims) {
    await this.tokens.revokeSession(auth.sessionId);
  }
}
