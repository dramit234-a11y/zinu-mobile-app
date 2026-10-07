import { Inject, Injectable, Logger } from '@nestjs/common';
import { DocumentStatus, type DocType } from '@zinu/shared';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { AuditService } from '../common/audit.service.js';
import { daysBetween, todayIST } from '../common/dates.js';
import { DB, type Db } from '../db/db.module.js';
import { documentReminders, documentTypes, driverDocuments, driverVehicles } from '../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export interface ExpiryScanResult {
  date: string;
  checked: number;
  reminders: number;
  expired: number;
}

/**
 * Spec §41: daily scan of approved documents with an expiry date. Sends reminders on the configured days
 * (once per threshold) and marks documents EXPIRED the day after their validity ends. Expired documents whose type
 * blocks going online make the driver ineligible (see DriverRegistrationService.eligibility).
 */
@Injectable()
export class DocumentExpiryService {
  private readonly logger = new Logger('DocumentExpiry');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async run(now = new Date()): Promise<ExpiryScanResult> {
    const today = todayIST(now);
    const rows = await this.db
      .select({ doc: driverDocuments, reminderDays: documentTypes.reminderDays })
      .from(driverDocuments)
      .innerJoin(documentTypes, eq(documentTypes.code, driverDocuments.docType))
      .where(and(eq(driverDocuments.status, DocumentStatus.APPROVED), isNull(driverDocuments.supersededAt), isNotNull(driverDocuments.expiresOn)));

    let reminders = 0;
    let expired = 0;
    for (const { doc, reminderDays } of rows) {
      const daysLeft = daysBetween(today, doc.expiresOn!);
      // Vehicle documents go to the drivers currently driving that vehicle.
      const recipients = doc.vehicleId
        ? (await this.db.select({ id: driverVehicles.driverId }).from(driverVehicles).where(and(eq(driverVehicles.vehicleId, doc.vehicleId), eq(driverVehicles.active, true)))).map((r) => r.id)
        : [doc.driverId];

      if (daysLeft < 0) {
        const marked = await this.db
          .update(driverDocuments)
          .set({ status: DocumentStatus.EXPIRED })
          .where(and(eq(driverDocuments.id, doc.id), eq(driverDocuments.status, DocumentStatus.APPROVED)))
          .returning({ id: driverDocuments.id });
        if (!marked.length) continue;
        expired++;
        await this.audit.record({ actorType: 'SYSTEM', action: 'document.expired', entityType: 'driver', entityId: doc.driverId, after: { documentId: doc.id, docType: doc.docType, expiresOn: doc.expiresOn } });
        for (const r of recipients) await this.notifications.notify(r, 'document.expired', { docType: doc.docType as DocType }, { documentId: doc.id });
        continue;
      }

      // Send the reminder for the smallest threshold reached, once (a missed day still gets its reminder).
      const due = reminderDays.filter((d) => daysLeft <= d).sort((a, b) => a - b)[0];
      if (due === undefined) continue;
      const inserted = await this.db
        .insert(documentReminders)
        .values({ documentId: doc.id, thresholdDays: due })
        .onConflictDoNothing()
        .returning({ id: documentReminders.documentId });
      if (!inserted.length) continue;
      reminders++;
      for (const r of recipients)
        await this.notifications.notify(r, 'document.expiring', { docType: doc.docType as DocType, days: daysLeft, date: doc.expiresOn! }, { documentId: doc.id });
    }
    const result = { date: today, checked: rows.length, reminders, expired };
    this.logger.log(`Expiry scan ${JSON.stringify(result)}`);
    return result;
  }
}
