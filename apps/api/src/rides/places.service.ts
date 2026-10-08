import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode, type PlaceDto, type SavedPlaceDto } from '@zinu/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import { AppError, notFound } from '../common/errors.js';
import { uuidv7 } from '../common/ids.js';
import { DB, type Db } from '../db/db.module.js';
import { recentPlaces, savedPlaces } from '../db/schema.js';

const MAX_SAVED = 20;
const MAX_RECENT = 15;

/** Spec §10–11: Home / Work / saved places and recent destinations. */
@Injectable()
export class PlacesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async listSaved(userId: string): Promise<SavedPlaceDto[]> {
    const rows = await this.db.select().from(savedPlaces).where(eq(savedPlaces.userId, userId)).orderBy(savedPlaces.label, savedPlaces.createdAt);
    return rows.map((r) => ({ id: r.id, label: r.label as SavedPlaceDto['label'], name: r.name ?? undefined, address: r.address, lat: r.lat, lng: r.lng, placeId: r.placeId ?? undefined }));
  }

  /** Home and Work are single slots (saving again replaces them); "Other" places accumulate. */
  async save(userId: string, p: PlaceDto & { label: 'HOME' | 'WORK' | 'OTHER' }) {
    const values = { name: p.name ?? null, address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId ?? null };
    if (p.label === 'OTHER') {
      const [{ n }] = (await this.db.select({ n: sql<number>`count(*)::int` }).from(savedPlaces).where(eq(savedPlaces.userId, userId))) as [{ n: number }];
      if (n >= MAX_SAVED) throw new AppError(ErrorCode.CONFLICT, 'You have saved the maximum number of places', HttpStatus.CONFLICT);
      await this.db.insert(savedPlaces).values({ id: uuidv7(), userId, label: 'OTHER', ...values });
    } else {
      await this.db.transaction(async (tx) => {
        await tx.delete(savedPlaces).where(and(eq(savedPlaces.userId, userId), eq(savedPlaces.label, p.label)));
        await tx.insert(savedPlaces).values({ id: uuidv7(), userId, label: p.label, ...values });
      });
    }
    return this.listSaved(userId);
  }

  async remove(userId: string, id: string) {
    const deleted = await this.db.delete(savedPlaces).where(and(eq(savedPlaces.userId, userId), eq(savedPlaces.id, id))).returning({ id: savedPlaces.id });
    if (!deleted.length) throw notFound('Place');
    return this.listSaved(userId);
  }

  async recent(userId: string): Promise<PlaceDto[]> {
    const rows = await this.db.select().from(recentPlaces).where(eq(recentPlaces.userId, userId)).orderBy(desc(recentPlaces.usedAt)).limit(MAX_RECENT);
    return rows.map((r) => ({ name: r.name ?? undefined, address: r.address, lat: r.lat, lng: r.lng, placeId: r.placeId ?? undefined }));
  }

  async remember(userId: string, p: PlaceDto) {
    await this.db
      .insert(recentPlaces)
      .values({ id: uuidv7(), userId, name: p.name ?? null, address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId ?? null })
      .onConflictDoUpdate({ target: [recentPlaces.userId, recentPlaces.address], set: { usedAt: new Date(), lat: p.lat, lng: p.lng } });
    // Keep the list short.
    await this.db.execute(
      sql`delete from recent_places where user_id = ${userId} and id not in (select id from recent_places where user_id = ${userId} order by used_at desc limit ${MAX_RECENT})`,
    );
  }
}
