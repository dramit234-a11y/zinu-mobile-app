/**
 * ZINU fare engine (spec §13). Pure and shared by API, admin simulator and app so every surface
 * shows exactly the same numbers. All money is integer paise; every component is admin-configurable.
 */

export const RideCategory = {
  BIKE: 'BIKE',
  TOTO: 'TOTO',
  AUTO: 'AUTO',
  CAB: 'CAB',
  SHARED: 'SHARED',
} as const;
export type RideCategory = (typeof RideCategory)[keyof typeof RideCategory];
export const RIDE_CATEGORIES = Object.values(RideCategory);

export interface PricingValues {
  baseFarePaise: number;
  /** Distance included in the base fare, in metres (e.g. first 1.5 km). */
  baseDistanceM: number;
  perKmPaise: number;
  perMinPaise: number;
  minFarePaise: number;
  platformFeePaise: number;
  /** Tax in basis points (500 = 5%) applied to fare + surcharge + platform fee. 0 when not applicable. */
  taxBps: number;
  /** Night surcharge in basis points of the fare (2500 = 25%). */
  nightSurchargeBps: number;
  /** Night window in IST hours, e.g. 22 → 6. Equal values disable the night window. */
  nightStartHour: number;
  nightEndHour: number;
}

export type FareLineCode =
  | 'BASE_FARE'
  | 'DISTANCE'
  | 'TIME'
  | 'MIN_FARE_ADJUSTMENT'
  | 'NIGHT_SURCHARGE'
  | 'PLATFORM_FEE'
  | 'TAX'
  | 'DISCOUNT'
  | 'ROUNDING';

export interface FareLine {
  code: FareLineCode;
  amountPaise: number;
}

export interface FareBreakdown {
  lines: FareLine[];
  totalPaise: number;
  /** Shared rides are priced per seat; total = per-seat × seats. */
  seats: number;
}

/** Hour of day (0–23) in India for a timestamp. */
export function istHour(at: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(at));
}

export function isNightIST(at: Date, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  const h = istHour(at);
  return startHour < endHour ? h >= startHour && h < endHour : h >= startHour || h < endHour;
}

export function calculateFare(
  rule: PricingValues,
  trip: { distanceM: number; durationS: number; at?: Date; seats?: number; discountPaise?: number },
): FareBreakdown {
  const seats = Math.max(1, Math.floor(trip.seats ?? 1));
  const chargeableKm = Math.max(0, trip.distanceM - rule.baseDistanceM) / 1000;
  const base = rule.baseFarePaise;
  const distance = Math.round(rule.perKmPaise * chargeableKm);
  const time = Math.round((rule.perMinPaise * Math.max(0, trip.durationS)) / 60);
  const rideFare = base + distance + time;
  const minAdjustment = Math.max(0, rule.minFarePaise - rideFare);
  const fare = rideFare + minAdjustment;
  const night = isNightIST(trip.at ?? new Date(), rule.nightStartHour, rule.nightEndHour) ? Math.round((fare * rule.nightSurchargeBps) / 10_000) : 0;
  const platform = rule.platformFeePaise;
  const tax = Math.round(((fare + night + platform) * rule.taxBps) / 10_000);
  const perSeat = fare + night + platform + tax;
  const discount = Math.min(perSeat * seats, Math.max(0, trip.discountPaise ?? 0));
  const beforeRounding = perSeat * seats - discount;
  // Round to the nearest rupee so cash and UPI amounts are simple.
  const total = Math.round(beforeRounding / 100) * 100;

  const lines: FareLine[] = [
    { code: 'BASE_FARE', amountPaise: base * seats },
    { code: 'DISTANCE', amountPaise: distance * seats },
    { code: 'TIME', amountPaise: time * seats },
  ];
  if (minAdjustment) lines.push({ code: 'MIN_FARE_ADJUSTMENT', amountPaise: minAdjustment * seats });
  if (night) lines.push({ code: 'NIGHT_SURCHARGE', amountPaise: night * seats });
  lines.push({ code: 'PLATFORM_FEE', amountPaise: platform * seats });
  if (rule.taxBps) lines.push({ code: 'TAX', amountPaise: tax * seats });
  lines.push({ code: 'DISCOUNT', amountPaise: -discount });
  if (total !== beforeRounding) lines.push({ code: 'ROUNDING', amountPaise: total - beforeRounding });
  return { lines, totalPaise: total, seats };
}

/** 12345 → "₹123.45"; whole rupees drop the decimals ("₹120"). */
export function formatRupees(paise: number): string {
  const sign = paise < 0 ? '−' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${sign}₹${rupees.toLocaleString('en-IN')}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

/** Great-circle distance in metres. */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Google encoded polyline format (precision 5). */
export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export function encodePolyline(points: { lat: number; lng: number }[]): string {
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    out += enc(lat - prevLat) + enc(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}
