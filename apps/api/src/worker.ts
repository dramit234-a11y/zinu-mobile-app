import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { startWorkers } from './jobs/workers.js';

// Background worker process: push delivery and scheduled jobs. Scale independently of the API.
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
app.enableShutdownHooks();
const stop = await startWorkers(app, { schedule: true });
new Logger('Worker').log('ZINU worker started');
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    await stop();
    await app.close();
    process.exit(0);
  });
