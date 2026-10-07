import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  Role,
  RoleStatus,
  UserStatus,
  type DriverVerificationStatus,
  type MeDto,
  type Role as RoleT,
} from '@zinu/shared';
import { and, asc, eq } from 'drizzle-orm';
import { AppError } from '../common/errors.js';
import { uuidv7 } from '../common/ids.js';
import { DB, type Db } from '../db/db.module.js';
import { driverProfiles, emergencyContacts, passengerProfiles, userRoles, users } from '../db/schema.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface ContactInput {
  name: string;
  phone: string;
  relation?: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Returns the account for a verified phone, creating it on first login. */
  async findOrCreateByPhone(phone: string): Promise<{ userId: string; isNew: boolean }> {
    const inserted = await this.db
      .insert(users)
      .values({ id: uuidv7(), phone })
      .onConflictDoNothing({ target: users.phone })
      .returning({ id: users.id });
    if (inserted[0]) return { userId: inserted[0].id, isNew: true };
    const existing = await this.db.query.users.findFirst({ where: eq(users.phone, phone), columns: { id: true, status: true } });
    if (!existing) throw new AppError(ErrorCode.INTERNAL, 'Could not load account', HttpStatus.INTERNAL_SERVER_ERROR);
    if (existing.status === UserStatus.BLOCKED)
      throw new AppError(ErrorCode.ACCOUNT_BLOCKED, 'This account has been blocked. Please contact ZINU support.', HttpStatus.FORBIDDEN);
    return { userId: existing.id, isNew: false };
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user || user.status === UserStatus.DELETED)
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Account not found', HttpStatus.UNAUTHORIZED);
    if (user.status === UserStatus.BLOCKED)
      throw new AppError(ErrorCode.ACCOUNT_BLOCKED, 'This account has been blocked. Please contact ZINU support.', HttpStatus.FORBIDDEN);

    const [roles, contacts, driver] = await Promise.all([
      this.db.select({ role: userRoles.role, status: userRoles.status }).from(userRoles).where(eq(userRoles.userId, userId)).orderBy(asc(userRoles.createdAt)),
      this.db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, userId)).orderBy(asc(emergencyContacts.createdAt)),
      this.db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, userId) }),
    ]);

    return {
      id: user.id,
      phone: user.phone ?? '',
      fullName: user.fullName,
      email: user.email,
      language: user.language === 'hi' ? 'hi' : 'en',
      status: user.status as MeDto['status'],
      profileComplete: Boolean(user.fullName) && roles.length > 0,
      roles: roles.map((r) => ({ role: r.role as RoleT, status: r.status as MeDto['roles'][number]['status'] })),
      emergencyContacts: contacts.map((c) => ({ id: c.id, name: c.name, phone: c.phone, relation: c.relation ?? undefined })),
      driver: driver
        ? { verificationStatus: driver.verificationStatus as DriverVerificationStatus, cityId: driver.cityId, statusReason: driver.statusReason }
        : null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateMe(userId: string, patch: { fullName?: string; email?: string | null; language?: string }) {
    if (Object.keys(patch).length === 0) return this.getMe(userId);
    await this.db.update(users).set({ ...patch, updatedAt: new Date() }).where(eq(users.id, userId));
    return this.getMe(userId);
  }

  /** Spec §8: name, optional email, language, emergency contact. Activates the passenger role. */
  async completePassengerProfile(
    userId: string,
    input: { fullName: string; email?: string; language: string; emergencyContact?: ContactInput },
  ) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ fullName: input.fullName, email: input.email || null, language: input.language, updatedAt: new Date() })
        .where(eq(users.id, userId));
      await this.grantRole(tx, userId, Role.PASSENGER);
      if (input.emergencyContact) {
        await tx.delete(emergencyContacts).where(eq(emergencyContacts.userId, userId));
        await tx.insert(emergencyContacts).values({ id: uuidv7(), userId, ...input.emergencyContact });
      }
    });
    return this.getMe(userId);
  }

  /**
   * Adds a role to the account. Passenger is active immediately; driver starts in ONBOARDING
   * and can only go online once verification approves it (Phase 2).
   */
  async activateRole(userId: string, role: RoleT) {
    await this.db.transaction((tx) => this.grantRole(tx, userId, role));
    return this.getMe(userId);
  }

  async replaceEmergencyContacts(userId: string, contacts: ContactInput[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(emergencyContacts).where(eq(emergencyContacts.userId, userId));
      if (contacts.length) await tx.insert(emergencyContacts).values(contacts.map((c) => ({ id: uuidv7(), userId, ...c })));
    });
    return this.getMe(userId);
  }

  /**
   * Store-mandated in-app account deletion. Personal data is erased and the phone number released;
   * the row is kept (status DELETED) so future trip/payment records keep referential integrity.
   */
  async deleteAccount(userId: string) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ phone: null, fullName: null, email: null, status: UserStatus.DELETED, deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, userId));
      await tx.delete(emergencyContacts).where(eq(emergencyContacts.userId, userId));
      await tx.update(userRoles).set({ status: RoleStatus.SUSPENDED, updatedAt: new Date() }).where(eq(userRoles.userId, userId));
    });
  }

  private async grantRole(tx: Tx, userId: string, role: RoleT) {
    const existing = await tx.query.userRoles.findFirst({ where: and(eq(userRoles.userId, userId), eq(userRoles.role, role)) });
    if (existing) return;
    if (role === Role.PASSENGER) {
      await tx.insert(userRoles).values({ userId, role, status: RoleStatus.ACTIVE });
      await tx.insert(passengerProfiles).values({ userId }).onConflictDoNothing();
    } else {
      await tx.insert(userRoles).values({ userId, role, status: RoleStatus.ONBOARDING });
      await tx.insert(driverProfiles).values({ userId }).onConflictDoNothing();
    }
  }
}
