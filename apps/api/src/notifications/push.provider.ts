import { Logger } from '@nestjs/common';
import type { Env } from '../config/env.js';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export type PushResult = { ok: true } | { ok: false; error: string; unregistered: boolean };

/** Delivers push messages to device tokens. Swap providers via PUSH_PROVIDER without touching callers. */
export interface PushProvider {
  readonly name: string;
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

export class ConsolePushProvider implements PushProvider {
  readonly name = 'console';
  private readonly logger = new Logger('ConsolePush');
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    for (const m of messages) this.logger.log(`[DEV] push to ${m.to.slice(0, 24)}…: ${m.title} — ${m.body}`);
    return messages.map(() => ({ ok: true as const }));
  }
}

/** Test provider: records messages; tokens containing "unregistered" behave like uninstalled apps. */
export class MemoryPushProvider implements PushProvider {
  readonly name = 'memory';
  static readonly outbox: PushMessage[] = [];
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    MemoryPushProvider.outbox.push(...messages);
    return messages.map((m) => (m.to.includes('unregistered') ? { ok: false as const, error: 'DeviceNotRegistered', unregistered: true } : { ok: true as const }));
  }
}

/**
 * Expo Push Service: one API for Android (FCM) and iOS (APNs). Requires the app to be built with an EAS project
 * whose FCM and APNs credentials are uploaded to Expo. https://docs.expo.dev/push-notifications/sending-notifications/
 */
export class ExpoPushProvider implements PushProvider {
  readonly name = 'expo';
  private readonly logger = new Logger('ExpoPush');
  constructor(private readonly accessToken?: string) {}

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(batch.map((m) => ({ to: m.to, title: m.title, body: m.body, data: m.data, sound: 'default', priority: 'high' }))),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`); // retried by the job queue
      const json = (await res.json()) as { data: { status: 'ok' | 'error'; message?: string; details?: { error?: string } }[] };
      for (const ticket of json.data) {
        if (ticket.status === 'ok') results.push({ ok: true });
        else {
          const error = ticket.details?.error ?? ticket.message ?? 'unknown';
          if (error !== 'DeviceNotRegistered') this.logger.warn(`Expo push error: ${error}`);
          results.push({ ok: false, error, unregistered: error === 'DeviceNotRegistered' });
        }
      }
    }
    return results;
  }
}

export function createPushProvider(env: Env): PushProvider {
  if (env.PUSH_PROVIDER === 'expo') return new ExpoPushProvider(env.EXPO_ACCESS_TOKEN || undefined);
  if (env.PUSH_PROVIDER === 'memory') return new MemoryPushProvider();
  return new ConsolePushProvider();
}
