import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';

export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_MAINTENANCE = 'maintenance';
export const JOB_PUSH = 'push';
export const JOB_DOCUMENT_EXPIRY_SCAN = 'document-expiry-scan';

export interface Queues {
  notifications: Queue;
  maintenance: Queue;
  /** BullMQ does not close connections it was given, so we close it ourselves on shutdown. */
  connection: Redis;
}
export const QUEUES = Symbol('QUEUES');

/** BullMQ needs its own connection with maxRetriesPerRequest disabled. */
export const bullConnection = (env: Env) => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

@Global()
@Module({
  providers: [
    {
      provide: QUEUES,
      inject: [ENV],
      useFactory: (env: Env): Queues => {
        const connection = bullConnection(env);
        return {
          notifications: new Queue(QUEUE_NOTIFICATIONS, { connection }),
          maintenance: new Queue(QUEUE_MAINTENANCE, { connection }),
          connection,
        };
      },
    },
  ],
  exports: [QUEUES],
})
export class JobsModule implements OnApplicationShutdown {
  constructor(@Inject(QUEUES) private readonly queues: Queues) {}
  async onApplicationShutdown() {
    await Promise.all([this.queues.notifications.close(), this.queues.maintenance.close()]);
    await this.queues.connection.quit();
  }
}
