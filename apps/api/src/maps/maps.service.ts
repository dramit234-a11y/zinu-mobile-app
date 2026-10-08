import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@zinu/shared';
import type { Redis } from 'ioredis';
import { ENV, type Env } from '../config/env.js';
import { AppError } from '../common/errors.js';
import { REDIS } from '../redis/redis.module.js';
import { MAPS_PROVIDER, type LatLng, type MapsProvider, type PlaceDetails, type RouteResult, type Suggestion } from './maps.provider.js';

// Short cache lifetimes keep within Google Maps Platform terms while absorbing repeated taps and typing.
const TTL = { autocomplete: 3600, place: 86_400, reverse: 86_400, route: 600 };
const round = (n: number, d = 4) => n.toFixed(d);

/** Caching, rate limiting and provider selection in front of the maps provider. */
@Injectable()
export class MapsService {
  constructor(
    @Inject(MAPS_PROVIDER) private readonly provider: MapsProvider,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
  ) {}

  get providerName() {
    return this.provider.name;
  }

  /** Each user gets a budget of map lookups per hour, protecting against runaway billing and abuse. */
  async charge(userId: string) {
    const key = `maps:rate:${userId}`;
    const [[, n]] = (await this.redis.multi().incr(key).expire(key, 3600, 'NX').exec()) as [[null, number], unknown];
    if (n > this.env.MAPS_MAX_REQUESTS_PER_HOUR)
      throw new AppError(ErrorCode.RATE_LIMITED, 'Too many map searches. Please wait a little and try again.', HttpStatus.TOO_MANY_REQUESTS);
  }

  private async cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const full = `maps:${this.provider.name}:${key}`;
    const hit = await this.redis.get(full);
    if (hit) return JSON.parse(hit) as T;
    const value = await load();
    if (value !== null && value !== undefined) await this.redis.set(full, JSON.stringify(value), 'EX', ttl);
    return value;
  }

  autocomplete(input: string, near: LatLng | undefined, sessionToken: string | undefined, language: string): Promise<Suggestion[]> {
    const bias = near ? `${round(near.lat, 2)},${round(near.lng, 2)}` : '-';
    return this.cached(`ac:${language}:${bias}:${input.trim().toLowerCase()}`, TTL.autocomplete, () =>
      this.provider.autocomplete(input.trim(), { near, sessionToken, language }),
    );
  }

  placeDetails(placeId: string, sessionToken: string | undefined, language: string): Promise<PlaceDetails | null> {
    return this.cached(`place:${language}:${placeId}`, TTL.place, () => this.provider.placeDetails(placeId, { sessionToken, language }));
  }

  reverseGeocode(at: LatLng, language: string) {
    return this.cached(`rev:${language}:${round(at.lat)},${round(at.lng)}`, TTL.reverse, () => this.provider.reverseGeocode(at, language));
  }

  route(from: LatLng, to: LatLng): Promise<RouteResult | null> {
    return this.cached(`route:${round(from.lat)},${round(from.lng)}:${round(to.lat)},${round(to.lng)}`, TTL.route, () => this.provider.route(from, to));
  }
}
