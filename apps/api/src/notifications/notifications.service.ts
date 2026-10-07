import { Inject, Injectable } from '@nestjs/common';
import type { NotificationDto } from '@zinu/shared';
import { and, desc, eq, gt, isNotNull, isNull, lt, ne } from 'drizzle-orm';
import { uuidv7 } from '../common/ids.js';
import { DB, type Db } from '../db/db.module.js';
import { authSessions, notifications, users } from '../db/schema.js';
import { JOB_PUSH, QUEUES, type Queues } from '../jobs/jobs.module.js';
import { PUSH_PROVIDER, type PushProvider } from './push.provider.js';
import { render, type NotificationType } from './templates.js';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(QUEUES) private readonly queues: Queues,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}

  /** Stores the notification in the user's inbox (in their language) and queues push delivery. */
  async notify(userId: string, type: NotificationType, params: Record<string, string | number> = {}, data?: Record<string, unknown>) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId), columns: { language: true } });
    const { title, body } = render(type, user?.language ?? 'en', params);
    const id = uuidv7();
    await this.db.insert(notifications).values({ id, userId, type, title, body, data: { type, ...params, ...data } });
    await this.queues.notifications.add(
      JOB_PUSH,
      { notificationId: id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 },
    );
    return id;
  }

  /** Worker side: sends one notification to every signed-in device of its user. */
  async deliver(notificationId: string) {
    const n = await this.db.query.notifications.findFirst({ where: eq(notifications.id, notificationId) });
    if (!n || n.pushStatus === 'SENT') return;
    const devices = await this.db
      .select({ sessionId: authSessions.id, token: authSessions.pushToken })
      .from(authSessions)
      .where(and(eq(authSessions.userId, n.userId), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date()), isNotNull(authSessions.pushToken)));
    if (devices.length === 0) {
      await this.db.update(notifications).set({ pushStatus: 'NO_DEVICE' }).where(eq(notifications.id, n.id));
      return;
    }
    const results = await this.push.send(
      devices.map((d) => ({ to: d.token!, title: n.title, body: n.body, data: { notificationId: n.id, ...(n.data as object) } })),
    );
    // App uninstalled / token invalid: stop sending to it.
    for (const [i, r] of results.entries()) {
      if (!r.ok && r.unregistered) await this.db.update(authSessions).set({ pushToken: null, pushProvider: null }).where(eq(authSessions.id, devices[i]!.sessionId));
    }
    await this.db
      .update(notifications)
      .set({ pushStatus: results.some((r) => r.ok) ? 'SENT' : 'FAILED' })
      .where(eq(notifications.id, n.id));
  }

  async list(userId: string, limit = 30, before?: string): Promise<NotificationDto[]> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), before ? lt(notifications.id, before) : undefined))
      .orderBy(desc(notifications.id))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      data: (r.data as Record<string, unknown>) ?? null,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async markRead(userId: string, id?: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), id ? eq(notifications.id, id) : undefined));
  }

  /** Attaches a push token to the current device session; a token moves with the device if another session had it. */
  async setPushToken(sessionId: string, token: string, provider: string) {
    await this.db.transaction(async (tx) => {
      await tx.update(authSessions).set({ pushToken: null, pushProvider: null }).where(and(eq(authSessions.pushToken, token), ne(authSessions.id, sessionId)));
      await tx.update(authSessions).set({ pushToken: token, pushProvider: provider }).where(eq(authSessions.id, sessionId));
    });
  }

  async clearPushToken(sessionId: string) {
    await this.db.update(authSessions).set({ pushToken: null, pushProvider: null }).where(eq(authSessions.id, sessionId));
  }
}
