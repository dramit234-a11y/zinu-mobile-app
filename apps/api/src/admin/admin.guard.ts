import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, type Permission } from '@zinu/shared';
import type { Request } from 'express';
import { AppError } from '../common/errors.js';
import { readCookie } from '../common/request.js';
import { AdminAuthService, type StaffPrincipal } from './admin-auth.service.js';

export const ADMIN_COOKIE = 'zinu_admin';
const PERMS_KEY = 'zinu:permissions';
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(PERMS_KEY, perms);

type AdminRequest = Request & { staff?: StaffPrincipal };

/**
 * Staff session from the httpOnly cookie + permission check.
 * Mutating requests must carry `X-ZINU-Admin: 1`; browsers cannot add custom headers cross-site
 * without a CORS preflight, which blocks CSRF.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    if (req.method !== 'GET' && req.headers['x-zinu-admin'] !== '1')
      throw new AppError(ErrorCode.FORBIDDEN, 'Missing admin request header', HttpStatus.FORBIDDEN);

    const token = readCookie(req, ADMIN_COOKIE);
    const staff = token ? await this.auth.verify(token) : null;
    if (!staff) throw new AppError(ErrorCode.UNAUTHENTICATED, 'Please sign in', HttpStatus.UNAUTHORIZED);

    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMS_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (!required.every((p) => staff.permissions.includes(p)))
      throw new AppError(ErrorCode.FORBIDDEN, 'You do not have permission for this action', HttpStatus.FORBIDDEN);
    req.staff = staff;
    return true;
  }
}

export const CurrentStaff = createParamDecorator((_: unknown, ctx: ExecutionContext): StaffPrincipal => {
  const staff = ctx.switchToHttp().getRequest<AdminRequest>().staff;
  if (!staff) throw new AppError(ErrorCode.UNAUTHENTICATED, 'Please sign in', HttpStatus.UNAUTHORIZED);
  return staff;
});
