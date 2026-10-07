import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  DocumentStatus,
  DriverVerificationStatus,
  ErrorCode,
  type DocType,
  type DocumentTypeDto,
  type DriverDocumentDto,
  type DriverRegistrationDto,
  type EligibilityDto,
  type PayoutInput,
} from '@zinu/shared';
import { and, asc, count, desc, eq, inArray, or } from 'drizzle-orm';
import { ENV, type Env } from '../config/env.js';
import { AuditService } from '../common/audit.service.js';
import { encrypt } from '../common/crypto.js';
import { todayIST } from '../common/dates.js';
import { AppError } from '../common/errors.js';
import { uuidv7 } from '../common/ids.js';
import { DB, type Db } from '../db/db.module.js';
import {
  cities,
  documentFiles,
  documentTypes,
  driverDocuments,
  driverProfiles,
  driverVehicles,
  emergencyContacts,
  payoutAccounts,
  uploads,
  users,
  vehicles,
} from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';

type DocRow = typeof driverDocuments.$inferSelect;
type TypeRow = typeof documentTypes.$inferSelect;
type VehicleRow = typeof vehicles.$inferSelect;

export interface DocEntry {
  type: TypeRow;
  /** Latest non-superseded version (what the driver last submitted). */
  current: DocRow | null;
  /** Latest approved/expired version still in force. */
  inForce: DocRow | null;
  versions: DocRow[];
}

export interface DriverState {
  driverId: string;
  user: typeof users.$inferSelect;
  profile: typeof driverProfiles.$inferSelect;
  vehicle: VehicleRow | null;
  entries: DocEntry[];
  files: Map<string, string[]>;
  payout: typeof payoutAccounts.$inferSelect | null;
  contactCount: number;
}

/** Statuses in which the driver may edit their registration. */
const EDITABLE: string[] = [DriverVerificationStatus.NOT_SUBMITTED, DriverVerificationStatus.ADDITIONAL_INFO_REQUIRED];

const locked = () => new AppError(ErrorCode.REGISTRATION_LOCKED, 'Your application is under review and cannot be changed right now.', HttpStatus.CONFLICT);

export function toDocumentTypeDto(t: TypeRow): DocumentTypeDto {
  return {
    code: t.code as DocType,
    label: t.label,
    ownerType: t.ownerType as 'DRIVER' | 'VEHICLE',
    required: t.required,
    requiresNumber: t.requiresNumber,
    requiresExpiry: t.requiresExpiry,
    minFiles: t.minFiles,
    maxFiles: t.maxFiles,
    blockOnlineWhenExpired: t.blockOnlineWhenExpired,
    reminderDays: t.reminderDays,
  };
}

export function toDocumentDto(d: DocRow, files: Map<string, string[]>): DriverDocumentDto {
  return {
    id: d.id,
    docType: d.docType as DocType,
    documentNumber: d.documentNumber,
    expiresOn: d.expiresOn,
    status: d.status as DocumentStatus,
    rejectionReason: d.rejectionReason,
    fileIds: files.get(d.id) ?? [],
    createdAt: d.createdAt.toISOString(),
  };
}

function maskPayout(input: PayoutInput & { ifsc?: string }): string {
  if (input.method === 'BANK') return `A/c ••••${input.accountNumber.slice(-4)} · ${input.ifsc.toUpperCase()}`;
  const [name, handle] = input.upiId.split('@');
  return `${name!.slice(0, 2)}••••@${handle}`;
}

@Injectable()
export class DriverRegistrationService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Everything known about a driver's registration, in one consistent read. */
  async loadState(driverId: string): Promise<DriverState> {
    const [user, profile] = await Promise.all([
      this.db.query.users.findFirst({ where: eq(users.id, driverId) }),
      this.db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, driverId) }),
    ]);
    if (!user || !profile)
      throw new AppError(ErrorCode.ROLE_NOT_ACTIVE, 'Start driving with ZINU first', HttpStatus.FORBIDDEN);

    const [link] = await this.db
      .select({ vehicle: vehicles })
      .from(driverVehicles)
      .innerJoin(vehicles, eq(vehicles.id, driverVehicles.vehicleId))
      .where(and(eq(driverVehicles.driverId, driverId), eq(driverVehicles.active, true)));
    const vehicle = link?.vehicle ?? null;

    const [types, docs, payout, [contacts]] = await Promise.all([
      this.db.select().from(documentTypes).orderBy(asc(documentTypes.sortOrder)),
      this.db
        .select()
        .from(driverDocuments)
        .where(or(eq(driverDocuments.driverId, driverId), vehicle ? eq(driverDocuments.vehicleId, vehicle.id) : undefined))
        .orderBy(desc(driverDocuments.createdAt), desc(driverDocuments.id)),
      this.db.query.payoutAccounts.findFirst({ where: and(eq(payoutAccounts.driverId, driverId), eq(payoutAccounts.active, true)) }),
      this.db.select({ n: count() }).from(emergencyContacts).where(eq(emergencyContacts.userId, driverId)),
    ]);

    const applicable = types.filter((t) => !t.fuelTypes || !vehicle || t.fuelTypes.includes(vehicle.fuelType));
    const entries = applicable.map((type) => {
      const versions = docs.filter((d) =>
        d.docType === type.code && (type.ownerType === 'DRIVER' ? d.driverId === driverId && !d.vehicleId : !!vehicle && d.vehicleId === vehicle.id),
      );
      const live = versions.filter((d) => !d.supersededAt);
      return {
        type,
        versions,
        current: live[0] ?? null,
        inForce: live.find((d) => d.status === DocumentStatus.APPROVED || d.status === DocumentStatus.EXPIRED) ?? null,
      };
    });

    const ids = entries.flatMap((e) => e.versions.map((v) => v.id));
    const fileRows = ids.length
      ? await this.db.select().from(documentFiles).where(inArray(documentFiles.documentId, ids)).orderBy(asc(documentFiles.position))
      : [];
    const files = new Map<string, string[]>();
    for (const f of fileRows) files.set(f.documentId, [...(files.get(f.documentId) ?? []), f.uploadId]);

    return { driverId, user, profile, vehicle, entries, files, payout: payout ?? null, contactCount: contacts?.n ?? 0 };
  }

  checklist(s: DriverState) {
    const p = s.profile;
    return {
      personal: !!(s.user.fullName && p.dateOfBirth && p.address && p.cityId),
      vehicle: !!s.vehicle,
      documents: !!s.vehicle && s.entries.filter((e) => e.type.required).every((e) => e.current && e.current.status !== DocumentStatus.REJECTED && e.current.status !== DocumentStatus.EXPIRED),
      payout: !!s.payout && s.payout.status !== 'REJECTED',
      emergencyContact: s.contactCount > 0,
    };
  }

  /** Whether the driver may go online now (spec §27, §41). Phase 4 calls this when a driver taps GO ONLINE. */
  eligibility(s: DriverState, today = todayIST()): EligibilityDto {
    const reasons: EligibilityDto['reasons'] = [];
    const status = s.profile.verificationStatus;
    if (status === DriverVerificationStatus.SUSPENDED) reasons.push({ code: 'SUSPENDED', message: 'Your driver account is suspended.' });
    else if (status !== DriverVerificationStatus.APPROVED) reasons.push({ code: 'NOT_APPROVED', message: 'Your driver profile is not approved yet.' });
    if (!s.vehicle) reasons.push({ code: 'NO_VEHICLE', message: 'Add your vehicle.' });
    for (const e of s.entries) {
      const doc = e.inForce;
      const expired = doc && (doc.status === DocumentStatus.EXPIRED || (doc.expiresOn !== null && doc.expiresOn < today));
      if (e.type.required && !doc) reasons.push({ code: 'DOCUMENT_MISSING', message: `${e.type.label} is not approved yet.`, docType: e.type.code as DocType });
      else if (expired && e.type.blockOnlineWhenExpired) reasons.push({ code: 'DOCUMENT_EXPIRED', message: `${e.type.label} has expired.`, docType: e.type.code as DocType });
    }
    return { canGoOnline: reasons.length === 0, reasons };
  }

  async getRegistration(driverId: string): Promise<DriverRegistrationDto> {
    return this.toDto(await this.loadState(driverId));
  }

  toDto(s: DriverState): DriverRegistrationDto {
    const checklist = this.checklist(s);
    const editable = EDITABLE.includes(s.profile.verificationStatus);
    return {
      status: s.profile.verificationStatus as DriverRegistrationDto['status'],
      statusReason: s.profile.statusReason,
      editable,
      personal: { fullName: s.user.fullName, dateOfBirth: s.profile.dateOfBirth, address: s.profile.address, cityId: s.profile.cityId },
      vehicle: s.vehicle
        ? {
            id: s.vehicle.id,
            status: s.vehicle.status,
            vehicleType: s.vehicle.vehicleType as never,
            fuelType: s.vehicle.fuelType as never,
            registrationNumber: s.vehicle.registrationNumber,
            ownershipType: s.vehicle.ownershipType as never,
            fleetPartnerName: s.vehicle.fleetPartnerName ?? undefined,
            make: s.vehicle.make ?? undefined,
            model: s.vehicle.model ?? undefined,
            colour: s.vehicle.colour ?? undefined,
            manufactureYear: s.vehicle.manufactureYear ?? undefined,
          }
        : null,
      documents: s.entries.map((e) => ({
        type: toDocumentTypeDto(e.type),
        current: e.current ? toDocumentDto(e.current, s.files) : null,
        inForce: e.inForce ? toDocumentDto(e.inForce, s.files) : null,
      })),
      payout: s.payout ? { method: s.payout.method as 'BANK' | 'UPI', holderName: s.payout.holderName, maskedLabel: s.payout.maskedLabel, status: s.payout.status } : null,
      emergencyContactCount: s.contactCount,
      checklist,
      canSubmit: editable && Object.values(checklist).every(Boolean),
      eligibility: this.eligibility(s),
    };
  }

  private async editableProfile(driverId: string) {
    const profile = await this.db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, driverId) });
    if (!profile) throw new AppError(ErrorCode.ROLE_NOT_ACTIVE, 'Start driving with ZINU first', HttpStatus.FORBIDDEN);
    if (!EDITABLE.includes(profile.verificationStatus)) throw locked();
    return profile;
  }

  async savePersonal(driverId: string, input: { fullName: string; dateOfBirth: string; address: string; cityId: string }) {
    await this.editableProfile(driverId);
    const city = await this.db.query.cities.findFirst({ where: eq(cities.id, input.cityId) });
    if (!city || city.status !== 'ACTIVE') throw new AppError(ErrorCode.VALIDATION_FAILED, 'ZINU is not available in this city yet');
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ fullName: input.fullName, updatedAt: new Date() }).where(eq(users.id, driverId));
      await tx
        .update(driverProfiles)
        .set({ dateOfBirth: input.dateOfBirth, address: input.address, cityId: input.cityId, updatedAt: new Date() })
        .where(eq(driverProfiles.userId, driverId));
    });
    return this.getRegistration(driverId);
  }

  /**
   * Registers or re-links the driver's vehicle. A driver-owned vehicle can only be linked to one driver;
   * ZINU / fleet vehicles may be shared across shift drivers (spec §39–40).
   */
  async saveVehicle(
    driverId: string,
    input: {
      vehicleType: string;
      fuelType: string;
      registrationNumber: string;
      ownershipType: string;
      fleetPartnerName?: string;
      make?: string;
      model?: string;
      colour?: string;
      manufactureYear?: number;
    },
  ) {
    const profile = await this.editableProfile(driverId);
    await this.db.transaction(async (tx) => {
      const existing = await tx.query.vehicles.findFirst({ where: eq(vehicles.registrationNumber, input.registrationNumber) });
      const otherDrivers = existing
        ? await tx
            .select({ driverId: driverVehicles.driverId })
            .from(driverVehicles)
            .where(and(eq(driverVehicles.vehicleId, existing.id), eq(driverVehicles.active, true)))
        : [];
      const sharedWithOthers = otherDrivers.some((d) => d.driverId !== driverId);
      if (sharedWithOthers && (input.ownershipType === 'DRIVER_OWNED' || existing?.ownershipType === 'DRIVER_OWNED'))
        throw new AppError(ErrorCode.VEHICLE_ALREADY_REGISTERED, 'This vehicle is already registered to another ZINU driver. Contact support if it is yours.', HttpStatus.CONFLICT);

      const details = {
        vehicleType: input.vehicleType,
        fuelType: input.fuelType,
        ownershipType: input.ownershipType,
        fleetPartnerName: input.ownershipType === 'FLEET_PARTNER' ? (input.fleetPartnerName ?? null) : null,
        make: input.make ?? null,
        model: input.model ?? null,
        colour: input.colour ?? null,
        manufactureYear: input.manufactureYear ?? null,
        cityId: profile.cityId,
        updatedAt: new Date(),
      };
      let vehicleId = existing?.id;
      if (!existing) {
        vehicleId = uuidv7();
        await tx.insert(vehicles).values({ id: vehicleId, registrationNumber: input.registrationNumber, ...details });
      } else if (!sharedWithOthers) {
        // Nobody else drives it: this driver's details are authoritative. Shared fleet vehicles are managed by ZINU.
        await tx.update(vehicles).set(details).where(eq(vehicles.id, existing.id));
      }

      const [current] = await tx.select().from(driverVehicles).where(and(eq(driverVehicles.driverId, driverId), eq(driverVehicles.active, true)));
      if (current?.vehicleId !== vehicleId) {
        if (current) await tx.update(driverVehicles).set({ active: false, endedAt: new Date() }).where(eq(driverVehicles.id, current.id));
        await tx.insert(driverVehicles).values({ id: uuidv7(), driverId, vehicleId: vehicleId! });
      }
    });
    return this.getRegistration(driverId);
  }

  /** Adds a new version of a document (spec §26). Older pending/rejected versions are replaced; an approved one stays in force until the new one is approved. */
  async submitDocument(driverId: string, docType: string, input: { documentNumber?: string; expiresOn?: string; uploadIds: string[] }) {
    const state = await this.loadState(driverId);
    if (state.profile.verificationStatus === DriverVerificationStatus.REJECTED) throw locked();
    // Documents can change while drafting or answering a review request, and as renewals once approved/suspended;
    // not while a reviewer is looking at the application.
    const underReview = state.profile.verificationStatus === DriverVerificationStatus.PROFILE_SUBMITTED || state.profile.verificationStatus === DriverVerificationStatus.DOCUMENTS_UNDER_REVIEW;
    if (underReview) throw locked();
    const entry = state.entries.find((e) => e.type.code === docType);
    if (!entry) throw new AppError(ErrorCode.VALIDATION_FAILED, 'This document is not needed for your vehicle');
    const t = entry.type;
    if (t.ownerType === 'VEHICLE' && !state.vehicle) throw new AppError(ErrorCode.VALIDATION_FAILED, 'Add your vehicle first');
    if (t.requiresNumber && !input.documentNumber) throw new AppError(ErrorCode.VALIDATION_FAILED, `Enter the ${t.label} number`);
    if (t.requiresExpiry && !input.expiresOn) throw new AppError(ErrorCode.VALIDATION_FAILED, `Enter the ${t.label} expiry date`);
    if (input.expiresOn && input.expiresOn <= todayIST()) throw new AppError(ErrorCode.VALIDATION_FAILED, `This ${t.label} has already expired. Upload a valid one.`);
    if (input.uploadIds.length < t.minFiles || input.uploadIds.length > t.maxFiles)
      throw new AppError(ErrorCode.VALIDATION_FAILED, `${t.label} needs ${t.minFiles === t.maxFiles ? t.minFiles : `${t.minFiles}–${t.maxFiles}`} photo(s)`);

    const owned = await this.db
      .select({ id: uploads.id })
      .from(uploads)
      .where(and(inArray(uploads.id, input.uploadIds), eq(uploads.ownerId, driverId), eq(uploads.status, 'UPLOADED'), eq(uploads.purpose, 'DRIVER_DOCUMENT')));
    if (owned.length !== new Set(input.uploadIds).size) throw new AppError(ErrorCode.UPLOAD_INVALID, 'One or more photos were not uploaded correctly. Please retake them.');

    const id = uuidv7();
    await this.db.transaction(async (tx) => {
      const stale = entry.versions.filter((v) => !v.supersededAt && (v.status === DocumentStatus.PENDING || v.status === DocumentStatus.REJECTED)).map((v) => v.id);
      if (stale.length) await tx.update(driverDocuments).set({ supersededAt: new Date() }).where(inArray(driverDocuments.id, stale));
      await tx.insert(driverDocuments).values({
        id,
        driverId,
        vehicleId: t.ownerType === 'VEHICLE' ? state.vehicle!.id : null,
        docType,
        documentNumber: t.requiresNumber ? (input.documentNumber ?? null) : null,
        expiresOn: input.expiresOn ?? null,
      });
      // Unique index on upload_id rejects re-using a file in two documents.
      await tx.insert(documentFiles).values(input.uploadIds.map((uploadId, position) => ({ documentId: id, uploadId, position })));
    });
    await this.audit.record({ actorType: 'USER', actorId: driverId, action: 'document.submitted', entityType: 'driver', entityId: driverId, after: { documentId: id, docType } });
    return this.getRegistration(driverId);
  }

  /** Bank/UPI details are encrypted at rest; only a masked label is stored in clear and ever returned. */
  async savePayout(driverId: string, input: PayoutInput & { ifsc?: string }) {
    const profile = await this.db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, driverId) });
    if (!profile) throw new AppError(ErrorCode.ROLE_NOT_ACTIVE, 'Start driving with ZINU first', HttpStatus.FORBIDDEN);
    if (profile.verificationStatus === DriverVerificationStatus.REJECTED) throw locked();
    const secret = input.method === 'BANK' ? { accountNumber: input.accountNumber, ifsc: input.ifsc } : { upiId: input.upiId };
    await this.db.transaction(async (tx) => {
      await tx.update(payoutAccounts).set({ active: false }).where(and(eq(payoutAccounts.driverId, driverId), eq(payoutAccounts.active, true)));
      await tx.insert(payoutAccounts).values({
        id: uuidv7(),
        driverId,
        method: input.method,
        holderName: input.holderName,
        detailsEnc: encrypt(this.env.PAYOUT_ENC_KEY, JSON.stringify(secret)),
        maskedLabel: maskPayout(input),
        ifsc: input.method === 'BANK' ? input.ifsc : null,
      });
    });
    await this.audit.record({ actorType: 'USER', actorId: driverId, action: 'payout.updated', entityType: 'driver', entityId: driverId, after: { method: input.method, label: maskPayout(input) } });
    return this.getRegistration(driverId);
  }

  async submit(driverId: string) {
    const state = await this.loadState(driverId);
    if (!EDITABLE.includes(state.profile.verificationStatus)) throw locked();
    const checklist = this.checklist(state);
    const missing = Object.entries(checklist).filter(([, ok]) => !ok).map(([k]) => k);
    if (missing.length)
      throw new AppError(ErrorCode.REGISTRATION_INCOMPLETE, 'Please complete every step before submitting', HttpStatus.BAD_REQUEST, { missing });
    const updated = await this.db
      .update(driverProfiles)
      .set({ verificationStatus: DriverVerificationStatus.PROFILE_SUBMITTED, statusReason: null, submittedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(driverProfiles.userId, driverId), eq(driverProfiles.verificationStatus, state.profile.verificationStatus)))
      .returning({ id: driverProfiles.userId });
    if (!updated.length) throw locked();
    await this.audit.record({
      actorType: 'USER',
      actorId: driverId,
      action: 'driver.submitted',
      entityType: 'driver',
      entityId: driverId,
      before: { status: state.profile.verificationStatus },
      after: { status: DriverVerificationStatus.PROFILE_SUBMITTED },
    });
    await this.notifications.notify(driverId, 'driver.application_received');
    return this.getRegistration(driverId);
  }

  /** Active cities a driver can register in. */
  listCities() {
    return this.db.select({ id: cities.id, name: cities.name, state: cities.state }).from(cities).where(eq(cities.status, 'ACTIVE')).orderBy(cities.name);
  }
}
