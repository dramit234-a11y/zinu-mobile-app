import { Inject, Injectable } from '@nestjs/common';
import type { PricingValues } from '@zinu/shared';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { notFound } from '../common/errors.js';
import { uuidv7 } from '../common/ids.js';
import { DB, type Db } from '../db/db.module.js';
import { cities, cityRideCategories, pricingRules, rideCategories } from '../db/schema.js';

/** Picks exactly the fare fields out of a stored rule. */
export const valuesOf = (r: PricingValues): PricingValues => ({
  baseFarePaise: r.baseFarePaise,
  baseDistanceM: r.baseDistanceM,
  perKmPaise: r.perKmPaise,
  perMinPaise: r.perMinPaise,
  minFarePaise: r.minFarePaise,
  platformFeePaise: r.platformFeePaise,
  taxBps: r.taxBps,
  nightSurchargeBps: r.nightSurchargeBps,
  nightStartHour: r.nightStartHour,
  nightEndHour: r.nightEndHour,
});

/** Ride categories per city and versioned pricing (spec §12–13, §57). */
@Injectable()
export class PricingService {
  constructor(@Inject(DB) private readonly db: Db) {}

  catalogue() {
    return this.db.select().from(rideCategories).orderBy(asc(rideCategories.sortOrder));
  }

  /** Latest version per category for a city (the one in force). */
  private async currentRules(cityId: string) {
    return this.db
      .selectDistinctOn([pricingRules.categoryCode])
      .from(pricingRules)
      .where(eq(pricingRules.cityId, cityId))
      .orderBy(pricingRules.categoryCode, desc(pricingRules.version));
  }

  /** Every catalogue category with this city's settings and current fare (admin view). */
  async cityCategories(cityId: string) {
    const city = await this.db.query.cities.findFirst({ where: eq(cities.id, cityId) });
    if (!city) throw notFound('City');
    const [catalogue, settings, rules] = await Promise.all([
      this.catalogue(),
      this.db.select().from(cityRideCategories).where(eq(cityRideCategories.cityId, cityId)),
      this.currentRules(cityId),
    ]);
    return catalogue.map((c) => {
      const s = settings.find((x) => x.categoryCode === c.code);
      const rule = rules.find((r) => r.categoryCode === c.code);
      return {
        ...c,
        enabled: s?.enabled ?? false,
        citySortOrder: s?.sortOrder ?? c.sortOrder,
        pricing: rule ? { id: rule.id, version: rule.version, ...valuesOf(rule), note: rule.note, createdAt: rule.createdAt } : null,
      };
    });
  }

  /** Categories a passenger can be quoted in a city: enabled and priced. */
  async bookable(cityId: string) {
    const all = await this.cityCategories(cityId);
    return all.filter((c) => c.enabled && c.pricing).sort((a, b) => a.citySortOrder - b.citySortOrder);
  }

  async setCityCategory(cityId: string, code: string, patch: { enabled?: boolean; sortOrder?: number }) {
    const cat = await this.db.query.rideCategories.findFirst({ where: eq(rideCategories.code, code) });
    if (!cat) throw notFound('Ride category');
    await this.db
      .insert(cityRideCategories)
      .values({ cityId, categoryCode: code, enabled: patch.enabled ?? false, sortOrder: patch.sortOrder ?? cat.sortOrder })
      .onConflictDoUpdate({
        target: [cityRideCategories.cityId, cityRideCategories.categoryCode],
        set: { ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}), ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}), updatedAt: new Date() },
      });
    return (await this.cityCategories(cityId)).find((c) => c.code === code)!;
  }

  history(cityId: string, code: string) {
    return this.db
      .select()
      .from(pricingRules)
      .where(and(eq(pricingRules.cityId, cityId), eq(pricingRules.categoryCode, code)))
      .orderBy(desc(pricingRules.version));
  }

  /** Adds a new version; the version number is assigned atomically so concurrent edits can't collide. */
  async addVersion(cityId: string, code: string, values: PricingValues & { note?: string }, staffId: string | null) {
    const city = await this.db.query.cities.findFirst({ where: eq(cities.id, cityId) });
    if (!city) throw notFound('City');
    const cat = await this.db.query.rideCategories.findFirst({ where: eq(rideCategories.code, code) });
    if (!cat) throw notFound('Ride category');
    const [row] = await this.db
      .insert(pricingRules)
      .values({
        id: uuidv7(),
        cityId,
        categoryCode: code,
        version: sql`(select coalesce(max(version), 0) + 1 from pricing_rules where city_id = ${cityId} and category_code = ${code})`,
        ...values,
        note: values.note ?? null,
        createdBy: staffId,
      })
      .returning();
    return row!;
  }

  ruleById(id: string) {
    return this.db.query.pricingRules.findFirst({ where: eq(pricingRules.id, id) });
  }
}
