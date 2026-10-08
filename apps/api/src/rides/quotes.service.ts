import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode, calculateFare, haversineM, type PlaceDto, type QuoteDto } from '@zinu/shared';
import { GeoService } from '../admin/geo.service.js';
import { ENV, type Env } from '../config/env.js';
import { AppError } from '../common/errors.js';
import { uuidv7 } from '../common/ids.js';
import { DB, type Db } from '../db/db.module.js';
import { fareQuotes } from '../db/schema.js';
import { MapsService } from '../maps/maps.service.js';
import { PlacesService } from './places.service.js';
import { PricingService, valuesOf } from './pricing.service.js';

const MIN_TRIP_M = 200;

/** Spec §12–13: route + priced options for every bookable category. Quotes are stored so booking (Phase 4) uses the server's price. */
@Injectable()
export class QuotesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly geo: GeoService,
    private readonly maps: MapsService,
    private readonly pricing: PricingService,
    private readonly places: PlacesService,
  ) {}

  async quote(userId: string, pickup: PlaceDto, dropoff: PlaceDto, now = new Date()): Promise<QuoteDto> {
    const [from, to] = await Promise.all([this.geo.serviceAreaAt(pickup.lat, pickup.lng), this.geo.serviceAreaAt(dropoff.lat, dropoff.lng)]);
    if (!from.inService || !from.city)
      throw new AppError(ErrorCode.OUT_OF_SERVICE_AREA, 'ZINU is not available at this pickup location yet.', HttpStatus.UNPROCESSABLE_ENTITY, { which: 'pickup' });
    if (!to.inService || to.city?.id !== from.city.id)
      throw new AppError(ErrorCode.OUT_OF_SERVICE_AREA, 'This destination is outside the ZINU service area.', HttpStatus.UNPROCESSABLE_ENTITY, { which: 'dropoff' });
    if (haversineM(pickup, dropoff) < MIN_TRIP_M)
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Pickup and destination are too close together.');

    await this.maps.charge(userId);
    const route = await this.maps.route(pickup, dropoff);
    if (!route) throw new AppError(ErrorCode.QUOTE_UNAVAILABLE, 'No route found between these places.', HttpStatus.UNPROCESSABLE_ENTITY);

    const categories = await this.pricing.bookable(from.city.id);
    if (!categories.length) throw new AppError(ErrorCode.QUOTE_UNAVAILABLE, 'No ride types are available here right now.', HttpStatus.UNPROCESSABLE_ENTITY);

    const groupId = uuidv7();
    const expiresAt = new Date(now.getTime() + this.env.QUOTE_TTL_SEC * 1000);
    const options = categories.map((c) => {
      const fare = calculateFare(valuesOf(c.pricing!), { distanceM: route.distanceM, durationS: route.durationS, at: now, seats: 1 });
      return { quoteId: uuidv7(), c, fare };
    });
    await this.db.insert(fareQuotes).values(
      options.map(({ quoteId, c, fare }) => ({
        id: quoteId,
        groupId,
        userId,
        cityId: from.city!.id,
        categoryCode: c.code,
        pricingRuleId: c.pricing!.id,
        pickup,
        dropoff,
        distanceM: route.distanceM,
        durationS: route.durationS,
        polyline: route.polyline,
        breakdown: fare,
        totalPaise: fare.totalPaise,
        mapsProvider: this.maps.providerName,
        expiresAt,
      })),
    );
    await this.places.remember(userId, dropoff);

    return {
      quoteGroupId: groupId,
      expiresAt: expiresAt.toISOString(),
      provider: this.maps.providerName,
      city: from.city,
      route,
      options: options.map(({ quoteId, c, fare }) => ({
        quoteId,
        category: c.code,
        name: c.name,
        description: c.description,
        capacity: c.capacity,
        perSeat: c.perSeat,
        durationS: route.durationS,
        fare,
        pickupEtaS: null,
      })),
    };
  }
}
