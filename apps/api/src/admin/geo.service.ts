import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { notFound } from '../common/errors.js';
import { uuidv7 } from '../common/ids.js';
import { DB, type Db } from '../db/db.module.js';
import { cities, zones } from '../db/schema.js';

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

const cityColumns = {
  id: cities.id,
  code: cities.code,
  name: cities.name,
  state: cities.state,
  timezone: cities.timezone,
  status: cities.status,
  centerLat: sql<number>`ST_Y(${cities.center}::geometry)`.as('center_lat'),
  centerLng: sql<number>`ST_X(${cities.center}::geometry)`.as('center_lng'),
  createdAt: cities.createdAt,
  updatedAt: cities.updatedAt,
};

const zoneColumns = {
  id: zones.id,
  cityId: zones.cityId,
  name: zones.name,
  type: zones.type,
  active: zones.active,
  boundary: sql<GeoJsonPolygon>`ST_AsGeoJSON(${zones.boundary})::json`.as('boundary'),
  areaSqKm: sql<number>`round((ST_Area(${zones.boundary}) / 1e6)::numeric, 2)::float`.as('area_sq_km'),
  createdAt: zones.createdAt,
  updatedAt: zones.updatedAt,
};

const point = (lat: number, lng: number) => sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
// Closes the ring if needed and validates/repairs it, so self-intersecting drawings don't corrupt geofencing.
const polygon = (g: GeoJsonPolygon) =>
  sql`ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(closeRings(g))}), 4326))::geography`;

function closeRings(g: GeoJsonPolygon): GeoJsonPolygon {
  return {
    type: 'Polygon',
    coordinates: g.coordinates.map((ring) => {
      const [first, last] = [ring[0]!, ring[ring.length - 1]!];
      return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
    }),
  };
}

/** Cities and service zones. Nothing city-specific is hard-coded: every city is data (spec §57). */
@Injectable()
export class GeoService {
  constructor(@Inject(DB) private readonly db: Db) {}

  listCities() {
    return this.db.select(cityColumns).from(cities).orderBy(cities.name);
  }

  async getCity(id: string) {
    const [city] = await this.db.select(cityColumns).from(cities).where(eq(cities.id, id));
    if (!city) throw notFound('City');
    return city;
  }

  async createCity(input: { code: string; name: string; state: string; timezone: string; status: string; centerLat: number; centerLng: number }) {
    const id = uuidv7();
    await this.db.insert(cities).values({
      id,
      code: input.code,
      name: input.name,
      state: input.state,
      timezone: input.timezone,
      status: input.status,
      center: point(input.centerLat, input.centerLng) as unknown as string,
    });
    return this.getCity(id);
  }

  async updateCity(id: string, input: Partial<{ code: string; name: string; state: string; timezone: string; status: string; centerLat: number; centerLng: number }>) {
    const before = await this.getCity(id);
    const { centerLat, centerLng, ...rest } = input;
    const lat = centerLat ?? before.centerLat;
    const lng = centerLng ?? before.centerLng;
    await this.db
      .update(cities)
      .set({ ...rest, center: point(lat, lng) as unknown as string, updatedAt: new Date() })
      .where(eq(cities.id, id));
    return { before, after: await this.getCity(id) };
  }

  async listZones(cityId: string) {
    await this.getCity(cityId);
    return this.db.select(zoneColumns).from(zones).where(eq(zones.cityId, cityId)).orderBy(zones.name);
  }

  async getZone(id: string) {
    const [zone] = await this.db.select(zoneColumns).from(zones).where(eq(zones.id, id));
    if (!zone) throw notFound('Zone');
    return zone;
  }

  async createZone(cityId: string, input: { name: string; type: string; active: boolean; boundary: GeoJsonPolygon }) {
    await this.getCity(cityId);
    const id = uuidv7();
    await this.db.insert(zones).values({
      id,
      cityId,
      name: input.name,
      type: input.type,
      active: input.active,
      boundary: polygon(input.boundary) as unknown as string,
    });
    return this.getZone(id);
  }

  async updateZone(id: string, input: Partial<{ name: string; type: string; active: boolean; boundary: GeoJsonPolygon }>) {
    const before = await this.getZone(id);
    const { boundary, ...rest } = input;
    await this.db
      .update(zones)
      .set({ ...rest, ...(boundary ? { boundary: polygon(boundary) as unknown as string } : {}), updatedAt: new Date() })
      .where(eq(zones.id, id));
    return { before, after: await this.getZone(id) };
  }

  /** Zones of a city containing a point — the geofencing primitive later phases build on. */
  zonesAt(cityId: string, lat: number, lng: number) {
    return this.db
      .select({ id: zones.id, name: zones.name, type: zones.type })
      .from(zones)
      .where(and(eq(zones.cityId, cityId), eq(zones.active, true), sql`ST_Covers(${zones.boundary}, ${point(lat, lng)})`))
      .orderBy(desc(zones.type));
  }
}
