import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { pushTokenSchema } from '@zinu/shared';
import { z } from 'zod';
import { CurrentAuth, UserAuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/tokens.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { NotificationsService } from './notifications.service.js';

@Controller('v1/me')
@UseGuards(UserAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(@CurrentAuth() auth: AccessClaims, @Query(new ZodPipe(z.object({ limit: z.coerce.number().int().min(1).max(100).default(30), before: z.uuid().optional() }))) q: { limit: number; before?: string }) {
    return this.notifications.list(auth.userId, q.limit, q.before);
  }

  @Post('notifications/:id/read')
  @HttpCode(204)
  async read(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    await this.notifications.markRead(auth.userId, id);
  }

  @Post('notifications/read-all')
  @HttpCode(204)
  async readAll(@CurrentAuth() auth: AccessClaims) {
    await this.notifications.markRead(auth.userId);
  }

  @Put('push-token')
  @HttpCode(204)
  async setToken(@CurrentAuth() auth: AccessClaims, @Body(new ZodPipe(pushTokenSchema)) body: z.output<typeof pushTokenSchema>) {
    await this.notifications.setPushToken(auth.sessionId, body.token, body.provider);
  }

  @Delete('push-token')
  @HttpCode(204)
  async clearToken(@CurrentAuth() auth: AccessClaims) {
    await this.notifications.clearPushToken(auth.sessionId);
  }
}
