import { Logger, type INestApplicationContext } from '@nestjs/common';
import { Worker } from 'bullmq';
import { ENV, type Env } from '../config/env.js';
import { DocumentExpiryService } from '../drivers/expiry.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { JOB_DOCUMENT_EXPIRY_SCAN, JOB_PUSH, QUEUES, QUEUE_MAINTENANCE, QUEUE_NOTIFICATIONS, bullConnection, type Queues } from './jobs.module.js';

const logger = new Logger('Workers');

/**
 * Starts background job processing. Runs in the dedicated worker process (src/worker.ts) in production,
 * and in-process during tests. Jobs are retried with backoff; the expiry scan is scheduled daily at 06:00 IST.
 */
export async function startWorkers(app: INestApplicationContext, opts: { schedule?: boolean } = {}) {
  const env = app.get<Env>(ENV);
  const notifications = app.get(NotificationsService);
  const expiry = app.get(DocumentExpiryService);
  const queues = app.get<Queues>(QUEUES);

  const connections = [bullConnection(env), bullConnection(env)];
  const workers = [
    new Worker(
      QUEUE_NOTIFICATIONS,
      async (job) => {
        if (job.name === JOB_PUSH) await notifications.deliver(job.data.notificationId);
      },
      { connection: connections[0]!, concurrency: 10 },
    ),
    new Worker(
      QUEUE_MAINTENANCE,
      async (job) => {
        if (job.name === JOB_DOCUMENT_EXPIRY_SCAN) return expiry.run();
      },
      { connection: connections[1]!, concurrency: 1 },
    ),
  ];
  for (const w of workers) w.on('failed', (job, err) => logger.error(`${w.name}/${job?.name} failed (attempt ${job?.attemptsMade}): ${err.message}`));

  if (opts.schedule) {
    await queues.maintenance.upsertJobScheduler('document-expiry-daily', { pattern: '0 6 * * *', tz: 'Asia/Kolkata' }, { name: JOB_DOCUMENT_EXPIRY_SCAN });
    logger.log('Scheduled daily document expiry scan at 06:00 IST');
  }
  return async () => {
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all(connections.map((c) => c.quit()));
  };
}
