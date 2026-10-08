import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { uuidv7 } from '../common/ids.js';
import * as schema from '../db/schema.js';
import { DOCUMENT_TYPES, RANCHI, RIDE_CATEGORY_SEED, SAMPLE_PRICING, SYSTEM_ROLES } from './seed-data.js';

/** Idempotent: safe to run on every deploy. */
export async function seed(databaseUrl: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool, { schema });
  try {
    for (const role of SYSTEM_ROLES) {
      await db
        .insert(schema.staffRoles)
        .values({ id: uuidv7(), ...role, isSystem: true })
        .onConflictDoUpdate({ target: schema.staffRoles.name, set: { permissions: role.permissions, description: role.description } });
    }

    let city = await db.query.cities.findFirst({ where: eq(schema.cities.code, RANCHI.code) });
    if (!city) {
      const id = uuidv7();
      await db.insert(schema.cities).values({
        id,
        code: RANCHI.code,
        name: RANCHI.name,
        state: RANCHI.state,
        timezone: RANCHI.timezone,
        status: 'ACTIVE',
        center: sql`ST_SetSRID(ST_MakePoint(${RANCHI.centerLng}, ${RANCHI.centerLat}), 4326)::geography` as unknown as string,
      });
      await db.insert(schema.zones).values({
        id: uuidv7(),
        cityId: id,
        name: RANCHI.pilotArea.name,
        type: 'SERVICE',
        boundary: sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(RANCHI.pilotArea.boundary)}), 4326)::geography` as unknown as string,
      });
      city = await db.query.cities.findFirst({ where: eq(schema.cities.id, id) });
    }

    for (const t of DOCUMENT_TYPES) {
      // Insert-only: never overwrite rules an admin has changed.
      await db.insert(schema.documentTypes).values(t).onConflictDoNothing();
    }

    for (const c of RIDE_CATEGORY_SEED) await db.insert(schema.rideCategories).values(c).onConflictDoNothing();
    // Ranchi offers every category; sample fares only when the city has none yet (admin edits are never overwritten).
    for (const c of RIDE_CATEGORY_SEED) {
      await db.insert(schema.cityRideCategories).values({ cityId: city!.id, categoryCode: c.code, enabled: true, sortOrder: c.sortOrder }).onConflictDoNothing();
      const existing = await db.query.pricingRules.findFirst({ where: (r, { and, eq }) => and(eq(r.cityId, city!.id), eq(r.categoryCode, c.code)) });
      if (!existing) await db.insert(schema.pricingRules).values({ id: uuidv7(), cityId: city!.id, categoryCode: c.code, version: 1, ...(SAMPLE_PRICING[c.code] as object) } as typeof schema.pricingRules.$inferInsert);
    }

    for (const platform of ['android', 'ios']) {
      await db.insert(schema.appVersions).values({ platform, minSupported: '1.0.0', latest: '1.0.0' }).onConflictDoNothing();
    }
    return { cityId: city!.id };
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  await seed(url);
  console.log('Seed complete: staff roles, Ranchi city + pilot area, document rules, ride categories + sample fares, app versions');
}
