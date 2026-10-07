import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { uuidv7 } from '../common/ids.js';
import * as schema from '../db/schema.js';
import { RANCHI, SYSTEM_ROLES } from './seed-data.js';

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
  console.log('Seed complete: staff roles, Ranchi city + pilot area, app versions');
}
