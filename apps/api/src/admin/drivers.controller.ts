import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DriverVerificationStatus, Permission, reasonSchema, requestInfoSchema, updateDocumentTypeSchema } from '@zinu/shared';
import { asc, eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../common/audit.service.js';
import { notFound } from '../common/errors.js';
import { clientIp } from '../common/request.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import { documentTypes } from '../db/schema.js';
import { DocumentExpiryService } from '../drivers/expiry.service.js';
import { toDocumentTypeDto } from '../drivers/registration.service.js';
import { VerificationService, type Actor } from '../drivers/verification.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import type { StaffPrincipal } from './admin-auth.service.js';
import { AdminGuard, CurrentStaff, RequirePermissions } from './admin.guard.js';

const listSchema = z.object({
  status: z.enum(Object.values(DriverVerificationStatus) as [string, ...string[]]).optional(),
  cityId: z.uuid().optional(),
  q: z.string().trim().max(40).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const optionalReason = z.object({ reason: z.string().trim().max(500).optional() });

const actor = (staff: StaffPrincipal, req: Request): Actor => ({ staffId: staff.id, ip: clientIp(req) });

/** Driver Verification module (spec §55). */
@Controller('v1/admin')
@UseGuards(AdminGuard)
export class AdminDriversController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly verification: VerificationService,
    private readonly uploads: UploadsService,
    private readonly expiry: DocumentExpiryService,
    private readonly audit: AuditService,
  ) {}

  @Get('drivers')
  @RequirePermissions(Permission.DRIVERS_VIEW)
  async list(@Query(new ZodPipe(listSchema)) q: z.output<typeof listSchema>) {
    const [page, counts] = await Promise.all([this.verification.list(q), this.verification.counts()]);
    return { ...page, counts };
  }

  @Get('drivers/:id')
  @RequirePermissions(Permission.DRIVERS_VIEW)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.verification.detail(id);
  }

  /** Short-lived link to a driver's document image. Each view is audited (sensitive personal data). */
  @Get('uploads/:id/url')
  @RequirePermissions(Permission.DOCUMENTS_VIEW_FILES)
  async fileUrl(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    const file = await this.uploads.downloadUrl(id).catch(() => {
      throw notFound('File');
    });
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: 'document.file_viewed', entityType: 'driver', entityId: file.ownerId, after: { uploadId: id }, ip: clientIp(req) });
    return { url: file.url, contentType: file.contentType, expiresInSec: file.expiresInSec };
  }

  @Post('drivers/:id/start-review')
  @HttpCode(200)
  @RequirePermissions(Permission.DRIVERS_VERIFY)
  startReview(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.verification.startReview(id, actor(staff, req));
  }

  @Post('drivers/:id/approve')
  @HttpCode(200)
  @RequirePermissions(Permission.DRIVERS_VERIFY)
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.verification.approve(id, actor(staff, req));
  }

  @Post('drivers/:id/request-info')
  @HttpCode(200)
  @RequirePermissions(Permission.DRIVERS_VERIFY)
  requestInfo(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(requestInfoSchema)) body: z.output<typeof requestInfoSchema>, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.verification.requestInfo(id, body.message, body.documentIds, actor(staff, req));
  }

  @Post('drivers/:id/reject')
  @HttpCode(200)
  @RequirePermissions(Permission.DRIVERS_VERIFY)
  reject(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(reasonSchema)) body: z.output<typeof reasonSchema>, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.verification.reject(id, body.reason, actor(staff, req));
  }

  @Post('drivers/:id/suspend')
  @HttpCode(200)
  @RequirePermissions(Permission.DRIVERS_SUSPEND)
  suspend(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(reasonSchema)) body: z.output<typeof reasonSchema>, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.verification.suspend(id, body.reason, actor(staff, req));
  }

  @Post('drivers/:id/reinstate')
  @HttpCode(200)
  @RequirePermissions(Permission.DRIVERS_SUSPEND)
  reinstate(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.verification.reinstate(id, actor(staff, req));
  }

  @Post('documents/:id/approve')
  @HttpCode(200)
  @RequirePermissions(Permission.DRIVERS_VERIFY)
  approveDocument(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.verification.approveDocument(id, actor(staff, req));
  }

  @Post('documents/:id/reject')
  @HttpCode(200)
  @RequirePermissions(Permission.DRIVERS_VERIFY)
  rejectDocument(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(reasonSchema)) body: z.output<typeof reasonSchema>, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.verification.rejectDocument(id, body.reason, actor(staff, req));
  }

  @Post('payout-accounts/:id/verify')
  @HttpCode(200)
  @RequirePermissions(Permission.DRIVERS_VERIFY)
  verifyPayout(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.verification.setPayoutStatus(id, true, undefined, actor(staff, req));
  }

  @Post('payout-accounts/:id/reject')
  @HttpCode(200)
  @RequirePermissions(Permission.DRIVERS_VERIFY)
  rejectPayout(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(optionalReason)) body: { reason?: string }, @CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    return this.verification.setPayoutStatus(id, false, body.reason || 'Please re-enter your payout details.', actor(staff, req));
  }

  // ---------------- Document rules (spec §41: admin-configurable restrictions) ----------------

  @Get('document-types')
  @RequirePermissions(Permission.DRIVERS_VIEW)
  async documentTypes() {
    return (await this.db.select().from(documentTypes).orderBy(asc(documentTypes.sortOrder))).map((t) => ({ ...toDocumentTypeDto(t), fuelTypes: t.fuelTypes }));
  }

  @Patch('document-types/:code')
  @RequirePermissions(Permission.DOCUMENT_RULES_MANAGE)
  async updateDocumentType(
    @Param('code') code: string,
    @Body(new ZodPipe(updateDocumentTypeSchema)) body: z.output<typeof updateDocumentTypeSchema>,
    @CurrentStaff() staff: StaffPrincipal,
    @Req() req: Request,
  ) {
    const before = await this.db.query.documentTypes.findFirst({ where: eq(documentTypes.code, code) });
    if (!before) throw notFound('Document type');
    const reminderDays = body.reminderDays ? [...new Set(body.reminderDays)].sort((a, b) => b - a) : undefined;
    const [after] = await this.db
      .update(documentTypes)
      .set({ ...body, ...(reminderDays ? { reminderDays } : {}), updatedAt: new Date() })
      .where(eq(documentTypes.code, code))
      .returning();
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: 'document_type.updated', entityType: 'document_type', entityId: code, before, after, ip: clientIp(req) });
    return toDocumentTypeDto(after!);
  }

  /** Runs the daily expiry scan immediately (it is idempotent). */
  @Post('jobs/document-expiry/run')
  @HttpCode(200)
  @RequirePermissions(Permission.DOCUMENT_RULES_MANAGE)
  async runExpiry(@CurrentStaff() staff: StaffPrincipal, @Req() req: Request) {
    const result = await this.expiry.run();
    await this.audit.record({ actorType: 'STAFF', actorId: staff.id, action: 'job.document_expiry_run', after: result, ip: clientIp(req) });
    return result;
  }
}
