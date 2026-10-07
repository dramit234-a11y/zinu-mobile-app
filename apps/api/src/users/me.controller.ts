import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import {
  activateRoleSchema,
  passengerProfileSchema,
  replaceEmergencyContactsSchema,
  updateMeSchema,
  type MeDto,
} from '@zinu/shared';
import type { Request } from 'express';
import type { z } from 'zod';
import { CurrentAuth, UserAuthGuard } from '../auth/auth.guard.js';
import { TokensService, type AccessClaims } from '../auth/tokens.service.js';
import { AuditService } from '../common/audit.service.js';
import { clientIp } from '../common/request.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { UsersService } from './users.service.js';

@Controller('v1/me')
@UseGuards(UserAuthGuard)
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  me(@CurrentAuth() auth: AccessClaims): Promise<MeDto> {
    return this.users.getMe(auth.userId);
  }

  @Patch()
  update(@CurrentAuth() auth: AccessClaims, @Body(new ZodPipe(updateMeSchema)) body: z.output<typeof updateMeSchema>) {
    return this.users.updateMe(auth.userId, body);
  }

  @Post('passenger-profile')
  @HttpCode(200)
  completePassengerProfile(
    @CurrentAuth() auth: AccessClaims,
    @Body(new ZodPipe(passengerProfileSchema)) body: z.output<typeof passengerProfileSchema>,
  ) {
    return this.users.completePassengerProfile(auth.userId, body);
  }

  @Post('roles')
  @HttpCode(200)
  async activateRole(
    @CurrentAuth() auth: AccessClaims,
    @Body(new ZodPipe(activateRoleSchema)) body: z.output<typeof activateRoleSchema>,
    @Req() req: Request,
  ) {
    const me = await this.users.activateRole(auth.userId, body.role);
    await this.audit.record({ actorType: 'USER', actorId: auth.userId, action: 'user.role_activated', entityType: 'user', entityId: auth.userId, after: body, ip: clientIp(req) });
    return me;
  }

  @Put('emergency-contacts')
  replaceContacts(
    @CurrentAuth() auth: AccessClaims,
    @Body(new ZodPipe(replaceEmergencyContactsSchema)) body: z.output<typeof replaceEmergencyContactsSchema>,
  ) {
    return this.users.replaceEmergencyContacts(auth.userId, body.contacts);
  }

  @Delete()
  @HttpCode(204)
  async deleteAccount(@CurrentAuth() auth: AccessClaims, @Req() req: Request) {
    await this.users.deleteAccount(auth.userId);
    await this.tokens.revokeAllForUser(auth.userId);
    await this.audit.record({ actorType: 'USER', actorId: auth.userId, action: 'user.deleted', entityType: 'user', entityId: auth.userId, ip: clientIp(req) });
  }
}
