import { Controller, Get, Inject, Query } from '@nestjs/common';
import { LANGUAGES, type AppConfigDto } from '@zinu/shared';
import { eq } from 'drizzle-orm';
import { ENV, type Env } from '../config/env.js';
import { DB, type Db } from '../db/db.module.js';
import { appVersions } from '../db/schema.js';

/** Compares dotted versions numerically: "1.10.0" > "1.9.3". */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

/** Public bootstrap config used by the splash screen (version gate, languages). */
@Controller('v1/app')
export class AppConfigController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('config')
  async config(@Query('platform') platform = 'android', @Query('version') version = '0.0.0'): Promise<AppConfigDto> {
    const row = await this.db.query.appVersions.findFirst({ where: eq(appVersions.platform, platform) });
    const min = row?.minSupported ?? '0.0.0';
    const latest = row?.latest ?? version;
    return {
      minSupportedVersion: min,
      latestVersion: latest,
      updateRequired: compareVersions(version, min) < 0,
      updateAvailable: compareVersions(version, latest) < 0,
      supportedLanguages: LANGUAGES,
      supportEmail: this.env.SUPPORT_EMAIL,
    };
  }
}
