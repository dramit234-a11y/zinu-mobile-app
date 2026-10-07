import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import { DB, type Db } from '../db/db.module.js';
import { REDIS } from '../redis/redis.module.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check(@Res() res: Response) {
    const [db, redis] = await Promise.all([
      this.db.execute(sql`select 1`).then(() => 'ok', () => 'down'),
      this.redis.ping().then(() => 'ok', () => 'down'),
    ]);
    const ok = db === 'ok' && redis === 'ok';
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({ status: ok ? 'ok' : 'degraded', db, redis });
  }
}
