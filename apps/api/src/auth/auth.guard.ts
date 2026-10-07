import { CanActivate, ExecutionContext, HttpStatus, Injectable, createParamDecorator } from '@nestjs/common';
import { ErrorCode } from '@zinu/shared';
import type { Request } from 'express';
import { AppError } from '../common/errors.js';
import { TokensService, type AccessClaims } from './tokens.service.js';

type AuthedRequest = Request & { auth?: AccessClaims };

/** Requires a valid `Authorization: Bearer <access token>` from the mobile app. */
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokensService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Missing access token', HttpStatus.UNAUTHORIZED);
    req.auth = await this.tokens.verifyAccess(header.slice(7));
    return true;
  }
}

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AccessClaims => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.auth) throw new AppError(ErrorCode.UNAUTHENTICATED, 'Not authenticated', HttpStatus.UNAUTHORIZED);
  return req.auth;
});
