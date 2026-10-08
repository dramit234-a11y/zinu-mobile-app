import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { quoteRequestSchema, savedPlaceSchema, type AutocompleteDto, type ServiceAreaDto } from '@zinu/shared';
import { eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { z } from 'zod';
import { GeoService } from '../admin/geo.service.js';
import { CurrentAuth, UserAuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/tokens.service.js';
import { notFound } from '../common/errors.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { MapsService } from '../maps/maps.service.js';
import { PlacesService } from './places.service.js';
import { QuotesService } from './quotes.service.js';

const coords = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });
const autocompleteQuery = z.object({
  q: z.string().trim().min(2).max(100),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  sessionToken: z.string().max(64).optional(),
});

/** Map lookups for the app. Keys stay on the server; results are cached and rate limited per user. */
@Controller('v1/maps')
@UseGuards(UserAuthGuard)
export class MapsController {
  constructor(
    private readonly maps: MapsService,
    @Inject(DB) private readonly db: Db,
  ) {}

  private async language(userId: string) {
    const u = await this.db.query.users.findFirst({ where: eq(users.id, userId), columns: { language: true } });
    return u?.language === 'hi' ? 'hi' : 'en';
  }

  @Get('autocomplete')
  async autocomplete(@CurrentAuth() auth: AccessClaims, @Query(new ZodPipe(autocompleteQuery)) q: z.output<typeof autocompleteQuery>): Promise<AutocompleteDto> {
    await this.maps.charge(auth.userId);
    const near = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined;
    return { provider: this.maps.providerName, suggestions: await this.maps.autocomplete(q.q, near, q.sessionToken, await this.language(auth.userId)) };
  }

  @Get('places/:placeId')
  async place(@CurrentAuth() auth: AccessClaims, @Param('placeId') placeId: string, @Query('sessionToken') sessionToken?: string) {
    await this.maps.charge(auth.userId);
    const p = await this.maps.placeDetails(placeId.slice(0, 300), sessionToken?.slice(0, 64), await this.language(auth.userId));
    if (!p) throw notFound('Place');
    return { provider: this.maps.providerName, place: { placeId: p.placeId, name: p.name, address: p.address, lat: p.lat, lng: p.lng } };
  }

  @Get('reverse')
  async reverse(@CurrentAuth() auth: AccessClaims, @Query(new ZodPipe(coords)) q: z.output<typeof coords>) {
    await this.maps.charge(auth.userId);
    const r = await this.maps.reverseGeocode(q, await this.language(auth.userId));
    return { provider: this.maps.providerName, place: { lat: q.lat, lng: q.lng, address: r?.address ?? `${q.lat.toFixed(5)}, ${q.lng.toFixed(5)}`, placeId: r?.placeId } };
  }
}

/** Service area checks and outlines (spec §57). */
@Controller('v1')
export class ServiceAreaController {
  constructor(private readonly geo: GeoService) {}

  @Get('service-area')
  serviceArea(@Query(new ZodPipe(coords)) q: z.output<typeof coords>): Promise<ServiceAreaDto> {
    return this.geo.serviceAreaAt(q.lat, q.lng);
  }

  @Get('cities/:id/service-zones')
  zones(@Param('id', ParseUUIDPipe) id: string) {
    return this.geo.serviceZones(id);
  }
}

@Controller('v1')
@UseGuards(UserAuthGuard)
export class RidesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly places: PlacesService,
  ) {}

  @Post('rides/quote')
  @HttpCode(200)
  quote(@CurrentAuth() auth: AccessClaims, @Body(new ZodPipe(quoteRequestSchema)) body: z.output<typeof quoteRequestSchema>) {
    return this.quotes.quote(auth.userId, body.pickup, body.dropoff);
  }

  @Get('me/places')
  saved(@CurrentAuth() auth: AccessClaims) {
    return this.places.listSaved(auth.userId);
  }

  @Post('me/places')
  @HttpCode(200)
  save(@CurrentAuth() auth: AccessClaims, @Body(new ZodPipe(savedPlaceSchema)) body: z.output<typeof savedPlaceSchema>) {
    return this.places.save(auth.userId, body);
  }

  @Delete('me/places/:id')
  remove(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    return this.places.remove(auth.userId, id);
  }

  @Get('me/recent-places')
  recent(@CurrentAuth() auth: AccessClaims) {
    return this.places.recent(auth.userId);
  }
}
