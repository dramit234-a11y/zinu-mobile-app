import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { presignUploadSchema } from '@zinu/shared';
import type { z } from 'zod';
import { CurrentAuth, UserAuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/tokens.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { UploadsService } from './uploads.service.js';

@Controller('v1/uploads')
@UseGuards(UserAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('presign')
  @HttpCode(200)
  presign(@CurrentAuth() auth: AccessClaims, @Body(new ZodPipe(presignUploadSchema)) body: z.output<typeof presignUploadSchema>) {
    return this.uploads.presign(auth.userId, body.purpose, body.contentType);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.uploads.confirm(auth.userId, id);
  }

  /** A user can only fetch their own files. */
  @Get(':id/url')
  async url(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    const { url, contentType, expiresInSec } = await this.uploads.downloadUrl(id, auth.userId);
    return { url, contentType, expiresInSec };
  }
}
