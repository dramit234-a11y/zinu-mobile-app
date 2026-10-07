import { Inject, Injectable } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { auditLogs } from '../db/schema.js';

export interface AuditEntry {
  actorType: 'STAFF' | 'USER' | 'SYSTEM';
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}

/** Append-only audit trail. Every admin write and sensitive user action is recorded. */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async record(e: AuditEntry) {
    await this.db.insert(auditLogs).values({
      actorType: e.actorType,
      actorId: e.actorId ?? null,
      action: e.action,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      before: e.before ?? null,
      after: e.after ?? null,
      ip: e.ip ?? null,
    });
  }
}
