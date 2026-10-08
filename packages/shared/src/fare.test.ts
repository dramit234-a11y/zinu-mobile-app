import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFare, decodePolyline, encodePolyline, formatRupees, haversineM, isNightIST, type PricingValues } from './fare.js';

const AUTO: PricingValues = {
  baseFarePaise: 3000,
  baseDistanceM: 1500,
  perKmPaise: 1200,
  perMinPaise: 100,
  minFarePaise: 3500,
  platformFeePaise: 500,
  taxBps: 500,
  nightSurchargeBps: 2500,
  nightStartHour: 22,
  nightEndHour: 6,
};
const DAY = new Date('2026-10-08T06:30:00Z'); // 12:00 IST
const NIGHT = new Date('2026-10-08T18:30:00Z'); // 00:00 IST

test('fare components add up and round to the rupee', () => {
  const f = calculateFare(AUTO, { distanceM: 6500, durationS: 1200, at: DAY });
  // base 30 + 5 km × 12 = 60 + 20 min × 1 = 20 → 110; +5 platform = 115; 5% tax = 5.75 → 120.75 → ₹121
  const get = (c: string) => f.lines.find((l) => l.code === c)?.amountPaise;
  assert.equal(get('BASE_FARE'), 3000);
  assert.equal(get('DISTANCE'), 6000);
  assert.equal(get('TIME'), 2000);
  assert.equal(get('PLATFORM_FEE'), 500);
  assert.equal(get('TAX'), 575);
  assert.equal(get('ROUNDING'), 25);
  assert.equal(f.totalPaise, 12100);
  assert.equal(f.lines.reduce((s, l) => s + l.amountPaise, 0), f.totalPaise);
});

test('minimum fare applies to short trips', () => {
  const f = calculateFare({ ...AUTO, taxBps: 0 }, { distanceM: 800, durationS: 120, at: DAY });
  assert.equal(f.lines.find((l) => l.code === 'MIN_FARE_ADJUSTMENT')?.amountPaise, 300);
  assert.equal(f.totalPaise, 4000);
});

test('night surcharge only inside the IST night window', () => {
  assert.equal(isNightIST(NIGHT, 22, 6), true);
  assert.equal(isNightIST(DAY, 22, 6), false);
  assert.equal(isNightIST(NIGHT, 0, 0), false);
  const f = calculateFare({ ...AUTO, taxBps: 0 }, { distanceM: 6500, durationS: 1200, at: NIGHT });
  assert.equal(f.lines.find((l) => l.code === 'NIGHT_SURCHARGE')?.amountPaise, 2750);
});

test('shared rides multiply per-seat fare; discount never makes it negative', () => {
  const one = calculateFare(AUTO, { distanceM: 6500, durationS: 1200, at: DAY });
  const two = calculateFare(AUTO, { distanceM: 6500, durationS: 1200, at: DAY, seats: 2 });
  assert.equal(two.totalPaise, Math.round((12075 * 2) / 100) * 100);
  assert.ok(two.totalPaise >= one.totalPaise * 2 - 100);
  assert.equal(calculateFare(AUTO, { distanceM: 1000, durationS: 60, at: DAY, discountPaise: 1e9 }).totalPaise, 0);
});

test('formatting and geometry helpers', () => {
  assert.equal(formatRupees(12100), '₹121');
  assert.equal(formatRupees(12345), '₹123.45');
  assert.equal(formatRupees(-500), '−₹5');
  const d = haversineM({ lat: 23.3441, lng: 85.3096 }, { lat: 23.3143, lng: 85.3216 });
  assert.ok(d > 3000 && d < 3700);
  const pts = [{ lat: 23.3441, lng: 85.3096 }, { lat: 23.35, lng: 85.32 }, { lat: 23.3143, lng: 85.3216 }];
  assert.deepEqual(decodePolyline(encodePolyline(pts)), pts);
  assert.equal(encodePolyline([{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }]), '_p~iF~ps|U_ulLnnqC_mqNvxq`@');
});
