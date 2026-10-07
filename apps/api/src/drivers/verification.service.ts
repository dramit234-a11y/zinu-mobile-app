import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DocumentStatus, DriverVerificationStatus as S, ErrorCode, Role, RoleStatus, type DocType } from '@zinu/shared';
import { and, count, desc, eq, ilike, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { AuditService } from '../common/audit.service.js';
import { todayIST } from '../common/dates.js';
import { AppError, notFound } from '../common/errors.js';
import { DB, type Db } from '../db/db.module.js';
import {
  auditLogs,
  cities,
  driverDocuments,
  driverProfiles,
  driverVehicles,
  emergencyContacts,
  payoutAccounts,
  userRoles,
  users,
  vehicles,
} from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { DriverRegistrationService, toDocumentDto, toDocumentTypeDto } from './registration.service.js';

export interface Actor {
  staffId: string;
  ip?: string;
}

const invalid = (msg: string) => new AppError(ErrorCode.INVALID_STATE, msg, HttpStatus.CONFLICT);

/** Admin side of spec §27: reviewing documents and moving drivers through verification statuses. Every change is audited. */
@Injectable()
export class VerificationService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly registration: DriverRegistrationService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async counts() {
    const rows = await this.db.select({ status: driverProfiles.verificationStatus, n: count() }).from(driverProfiles).groupBy(driverProfiles.verificationStatus);
    return Object.fromEntries(rows.map((r) => [r.status, r.n]));
  }

  async list(opts: { status?: string; cityId?: string; q?: string; cursor?: string; limit: number }) {
    const where: SQL[] = [sql`${users.status} <> 'DELETED'`];
    if (opts.status) where.push(eq(driverProfiles.verificationStatus, opts.status));
    if (opts.cityId) where.push(eq(driverProfiles.cityId, opts.cityId));
    if (opts.q) where.push(or(ilike(users.fullName, `%${opts.q}%`), ilike(users.phone, `%${opts.q}%`), ilike(vehicles.registrationNumber, `%${opts.q.replace(/\s/g, '').toUpperCase()}%`))!);
    if (opts.cursor) where.push(lt(driverProfiles.userId, opts.cursor));
    const rows = await this.db
      .select({
        id: driverProfiles.userId,
        fullName: users.fullName,
        phone: users.phone,
        status: driverProfiles.verificationStatus,
        submittedAt: driverProfiles.submittedAt,
        city: cities.name,
        vehicleNumber: vehicles.registrationNumber,
        vehicleType: vehicles.vehicleType,
        pendingDocuments: sql<number>`(select count(*)::int from ${driverDocuments} d where (d.driver_id = ${driverProfiles.userId} or d.vehicle_id = ${vehicles.id}) and d.status = 'PENDING' and d.superseded_at is null)`,
      })
      .from(driverProfiles)
      .innerJoin(users, eq(users.id, driverProfiles.userId))
      .leftJoin(cities, eq(cities.id, driverProfiles.cityId))
      .leftJoin(driverVehicles, and(eq(driverVehicles.driverId, driverProfiles.userId), eq(driverVehicles.active, true)))
      .leftJoin(vehicles, eq(vehicles.id, driverVehicles.vehicleId))
      .where(and(...where))
      .orderBy(desc(driverProfiles.userId))
      .limit(opts.limit + 1);
    const items = rows.slice(0, opts.limit);
    return { items, nextCursor: rows.length > opts.limit ? items[items.length - 1]!.id : null };
  }

  async detail(driverId: string) {
    const s = await this.registration.loadState(driverId).catch(() => {
      throw notFound('Driver');
    });
    const [contacts, city, history] = await Promise.all([
      this.db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, driverId)),
      s.profile.cityId ? this.db.query.cities.findFirst({ where: eq(cities.id, s.profile.cityId) }) : null,
      this.db.select().from(auditLogs).where(and(eq(auditLogs.entityType, 'driver'), eq(auditLogs.entityId, driverId))).orderBy(desc(auditLogs.id)).limit(100),
    ]);
    const dto = this.registration.toDto(s);
    return {
      id: driverId,
      phone: s.user.phone,
      language: s.user.language,
      accountStatus: s.user.status,
      city: city ? { id: city.id, name: city.name } : null,
      submittedAt: s.profile.submittedAt,
      approvedAt: s.profile.approvedAt,
      ...dto,
      // Reviewers see every version, newest first, so changes between submissions are visible.
      documents: s.entries.map((e) => ({
        type: toDocumentTypeDto(e.type),
        current: e.current ? toDocumentDto(e.current, s.files) : null,
        inForce: e.inForce ? toDocumentDto(e.inForce, s.files) : null,
        versions: e.versions.map((v) => ({ ...toDocumentDto(v, s.files), superseded: !!v.supersededAt })),
      })),
      payout: s.payout ? { id: s.payout.id, method: s.payout.method, holderName: s.payout.holderName, maskedLabel: s.payout.maskedLabel, status: s.payout.status } : null,
      emergencyContacts: contacts.map((c) => ({ name: c.name, phone: c.phone, relation: c.relation })),
      history: history.map((h) => ({ id: h.id, action: h.action, actorType: h.actorType, actorId: h.actorId, before: h.before, after: h.after, createdAt: h.createdAt })),
    };
  }

  // ---------------- Documents ----------------

  private async pendingDocument(documentId: string) {
    const doc = await this.db.query.driverDocuments.findFirst({ where: eq(driverDocuments.id, documentId) });
    if (!doc) throw notFound('Document');
    if (doc.supersededAt) throw invalid('A newer version of this document was uploaded');
    if (doc.status !== DocumentStatus.PENDING) throw invalid(`Document is already ${doc.status.toLowerCase()}`);
    return doc;
  }

  async approveDocument(documentId: string, actor: Actor) {
    const doc = await this.pendingDocument(documentId);
    if (doc.expiresOn && doc.expiresOn <= todayIST()) throw invalid('This document has already expired; ask the driver for a valid one');
    await this.db.transaction(async (tx) => {
      // The new version replaces whatever was in force for the same document (renewals).
      await tx
        .update(driverDocuments)
        .set({ supersededAt: new Date() })
        .where(
          and(
            eq(driverDocuments.docType, doc.docType),
            doc.vehicleId ? eq(driverDocuments.vehicleId, doc.vehicleId) : and(eq(driverDocuments.driverId, doc.driverId), isNull(driverDocuments.vehicleId)),
            isNull(driverDocuments.supersededAt),
            inArray(driverDocuments.status, [DocumentStatus.APPROVED, DocumentStatus.EXPIRED]),
          ),
        );
      await tx
        .update(driverDocuments)
        .set({ status: DocumentStatus.APPROVED, rejectionReason: null, reviewedBy: actor.staffId, reviewedAt: new Date() })
        .where(eq(driverDocuments.id, documentId));
    });
    await this.audit.record({ actorType: 'STAFF', actorId: actor.staffId, action: 'document.approved', entityType: 'driver', entityId: doc.driverId, after: { documentId, docType: doc.docType }, ip: actor.ip });
    if (await this.isApproved(doc.driverId)) await this.notifications.notify(doc.driverId, 'document.approved', { docType: doc.docType as DocType });
    return this.detail(doc.driverId);
  }

  async rejectDocument(documentId: string, reason: string, actor: Actor) {
    const doc = await this.pendingDocument(documentId);
    await this.db
      .update(driverDocuments)
      .set({ status: DocumentStatus.REJECTED, rejectionReason: reason, reviewedBy: actor.staffId, reviewedAt: new Date() })
      .where(eq(driverDocuments.id, documentId));
    await this.audit.record({ actorType: 'STAFF', actorId: actor.staffId, action: 'document.rejected', entityType: 'driver', entityId: doc.driverId, after: { documentId, docType: doc.docType, reason }, ip: actor.ip });
    // During onboarding the driver hears about rejections through "request more info"; renewals are notified directly.
    if (await this.isApproved(doc.driverId)) await this.notifications.notify(doc.driverId, 'document.rejected', { docType: doc.docType as DocType, reason });
    return this.detail(doc.driverId);
  }

  private async isApproved(driverId: string) {
    const p = await this.db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, driverId), columns: { verificationStatus: true } });
    return p?.verificationStatus === S.APPROVED;
  }

  // ---------------- Driver status transitions ----------------

  /** Compare-and-set on the status so two reviewers can't apply conflicting decisions. */
  private async transition(
    driverId: string,
    from: string[],
    to: string,
    actor: Actor,
    action: string,
    extra: Partial<typeof driverProfiles.$inferInsert> = {},
    roleStatus?: string,
  ) {
    const profile = await this.db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, driverId) });
    if (!profile) throw notFound('Driver');
    if (!from.includes(profile.verificationStatus)) throw invalid(`Not possible while the driver is ${profile.verificationStatus.replace(/_/g, ' ').toLowerCase()}`);
    await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(driverProfiles)
        .set({ verificationStatus: to, reviewedBy: actor.staffId, updatedAt: new Date(), ...extra })
        .where(and(eq(driverProfiles.userId, driverId), eq(driverProfiles.verificationStatus, profile.verificationStatus)))
        .returning({ id: driverProfiles.userId });
      if (!updated.length) throw invalid('The driver was updated by someone else; reload and try again');
      if (roleStatus)
        await tx.update(userRoles).set({ status: roleStatus, updatedAt: new Date() }).where(and(eq(userRoles.userId, driverId), eq(userRoles.role, Role.DRIVER)));
    });
    await this.audit.record({
      actorType: 'STAFF',
      actorId: actor.staffId,
      action,
      entityType: 'driver',
      entityId: driverId,
      before: { status: profile.verificationStatus },
      after: { status: to, ...(extra.statusReason ? { reason: extra.statusReason } : {}) },
      ip: actor.ip,
    });
  }

  async startReview(driverId: string, actor: Actor) {
    await this.transition(driverId, [S.PROFILE_SUBMITTED], S.DOCUMENTS_UNDER_REVIEW, actor, 'driver.review_started');
    return this.detail(driverId);
  }

  /** Approval requires a complete profile and every required document approved and valid. */
  async approve(driverId: string, actor: Actor) {
    const s = await this.registration.loadState(driverId);
    const checklist = this.registration.checklist(s);
    const today = todayIST();
    const notApproved = s.entries
      .filter((e) => e.type.required)
      .filter((e) => !e.inForce || e.inForce.status !== DocumentStatus.APPROVED || (e.inForce.expiresOn !== null && e.inForce.expiresOn < today))
      .map((e) => e.type.label);
    if (!checklist.personal || !checklist.vehicle || !checklist.payout || !checklist.emergencyContact || notApproved.length)
      throw new AppError(ErrorCode.REGISTRATION_INCOMPLETE, notApproved.length ? `Approve these documents first: ${notApproved.join(', ')}` : 'The driver profile is incomplete', HttpStatus.CONFLICT, { checklist, notApproved });

    await this.transition(driverId, [S.PROFILE_SUBMITTED, S.DOCUMENTS_UNDER_REVIEW], S.APPROVED, actor, 'driver.approved', { statusReason: null, approvedAt: new Date() }, RoleStatus.ACTIVE);
    await this.db.update(vehicles).set({ status: 'ACTIVE', updatedAt: new Date() }).where(eq(vehicles.id, s.vehicle!.id));
    await this.notifications.notify(driverId, 'driver.approved');
    return this.detail(driverId);
  }

  /** Sends the application back to the driver; listed pending documents are marked rejected so they re-upload them. */
  async requestInfo(driverId: string, message: string, documentIds: string[], actor: Actor) {
    await this.transition(driverId, [S.PROFILE_SUBMITTED, S.DOCUMENTS_UNDER_REVIEW], S.ADDITIONAL_INFO_REQUIRED, actor, 'driver.info_requested', { statusReason: message });
    if (documentIds.length)
      await this.db
        .update(driverDocuments)
        .set({ status: DocumentStatus.REJECTED, rejectionReason: message, reviewedBy: actor.staffId, reviewedAt: new Date() })
        .where(and(inArray(driverDocuments.id, documentIds), eq(driverDocuments.status, DocumentStatus.PENDING), or(eq(driverDocuments.driverId, driverId), sql`${driverDocuments.vehicleId} in (select vehicle_id from driver_vehicles where driver_id = ${driverId} and active)`)));
    await this.notifications.notify(driverId, 'driver.info_required', { message });
    return this.detail(driverId);
  }

  async reject(driverId: string, reason: string, actor: Actor) {
    await this.transition(driverId, [S.PROFILE_SUBMITTED, S.DOCUMENTS_UNDER_REVIEW, S.ADDITIONAL_INFO_REQUIRED], S.REJECTED, actor, 'driver.rejected', { statusReason: reason });
    await this.notifications.notify(driverId, 'driver.rejected', { reason });
    return this.detail(driverId);
  }

  async suspend(driverId: string, reason: string, actor: Actor) {
    await this.transition(driverId, [S.APPROVED], S.SUSPENDED, actor, 'driver.suspended', { statusReason: reason }, RoleStatus.SUSPENDED);
    await this.notifications.notify(driverId, 'driver.suspended', { reason });
    return this.detail(driverId);
  }

  async reinstate(driverId: string, actor: Actor) {
    await this.transition(driverId, [S.SUSPENDED], S.APPROVED, actor, 'driver.reinstated', { statusReason: null }, RoleStatus.ACTIVE);
    await this.notifications.notify(driverId, 'driver.reinstated');
    return this.detail(driverId);
  }

  // ---------------- Payout ----------------

  async setPayoutStatus(payoutId: string, verified: boolean, reason: string | undefined, actor: Actor) {
    const payout = await this.db.query.payoutAccounts.findFirst({ where: eq(payoutAccounts.id, payoutId) });
    if (!payout || !payout.active) throw notFound('Payout account');
    const status = verified ? 'VERIFIED' : 'REJECTED';
    await this.db.update(payoutAccounts).set({ status, verifiedBy: actor.staffId, verifiedAt: new Date() }).where(eq(payoutAccounts.id, payoutId));
    await this.audit.record({ actorType: 'STAFF', actorId: actor.staffId, action: verified ? 'payout.verified' : 'payout.rejected', entityType: 'driver', entityId: payout.driverId, after: { payoutId, reason }, ip: actor.ip });
    await this.notifications.notify(payout.driverId, verified ? 'payout.verified' : 'payout.rejected', reason ? { reason } : {});
    return this.detail(payout.driverId);
  }
}
