import 'reflect-metadata';
import { Logger, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { ENV, type Env } from './config/env.js';

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  const env = app.get<Env>(ENV);
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length) app.enableCors({ origin: origins, credentials: true });
  app.enableShutdownHooks();
  return app;
}

export async function startServer() {
  const app = await createApp();
  const env = app.get<Env>(ENV);
  await app.listen(env.PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`ZINU API listening on :${env.PORT} (${env.NODE_ENV}, OTP provider: ${env.OTP_PROVIDER})`);
}
