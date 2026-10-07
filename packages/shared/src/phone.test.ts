import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIndianMobile, formatIndianMobile } from './phone.js';
import { otpVerifySchema } from './schemas.js';

test('normalises common Indian mobile formats', () => {
  for (const input of ['9876543210', '09876543210', '919876543210', '+91 98765-43210']) {
    assert.equal(normalizeIndianMobile(input), '+919876543210');
  }
});

test('rejects invalid numbers', () => {
  for (const input of ['5876543210', '98765', '+1 9876543210', 'abcdefghij', '']) {
    assert.equal(normalizeIndianMobile(input), null);
  }
});

test('formats E.164 for display', () => {
  assert.equal(formatIndianMobile('+919876543210'), '+91 98765 43210');
});

test('otp verify schema normalises phone and validates code', () => {
  const ok = otpVerifySchema.safeParse({
    phone: '98765 43210',
    code: '123456',
    device: { deviceId: 'device-123', platform: 'android' },
  });
  assert.ok(ok.success);
  assert.equal(ok.data.phone, '+919876543210');
  assert.equal(otpVerifySchema.safeParse({ phone: '9876543210', code: '12a456', device: { deviceId: 'device-123', platform: 'ios' } }).success, false);
});

import { ageOn, driverVehicleSchema, normalizeVehicleNumber, payoutSchema } from './schemas.js';

test('vehicle numbers normalise and validate', () => {
  assert.equal(normalizeVehicleNumber('jh 01 ab 1234'), 'JH01AB1234');
  assert.equal(normalizeVehicleNumber('JH-01-1234'), 'JH011234');
  assert.equal(normalizeVehicleNumber('22 BH 1234 AA'), '22BH1234AA');
  assert.equal(normalizeVehicleNumber('hello'), null);
  assert.equal(normalizeVehicleNumber('1234'), null);
});

test('toto must be electric; fleet partner needs a name', () => {
  const base = { vehicleType: 'TOTO', fuelType: 'PETROL', registrationNumber: 'JH01AB1234', ownershipType: 'DRIVER_OWNED' };
  assert.equal(driverVehicleSchema.safeParse(base).success, false);
  assert.equal(driverVehicleSchema.safeParse({ ...base, fuelType: 'ELECTRIC' }).success, true);
  assert.equal(driverVehicleSchema.safeParse({ ...base, fuelType: 'ELECTRIC', ownershipType: 'FLEET_PARTNER' }).success, false);
});

test('age calculation respects birthdays', () => {
  const today = new Date(Date.UTC(2026, 9, 7));
  assert.equal(ageOn('2008-10-07', today), 18);
  assert.equal(ageOn('2008-10-08', today), 17);
});

test('payout validation', () => {
  assert.equal(payoutSchema.safeParse({ method: 'BANK', holderName: 'Raju', accountNumber: '123456789012', ifsc: 'sbin0001234' }).success, true);
  assert.equal(payoutSchema.safeParse({ method: 'BANK', holderName: 'Raju', accountNumber: '12', ifsc: 'SBIN0001234' }).success, false);
  assert.equal(payoutSchema.safeParse({ method: 'UPI', holderName: 'Raju', upiId: 'raju@okaxis' }).success, true);
  assert.equal(payoutSchema.safeParse({ method: 'UPI', holderName: 'Raju', upiId: 'not-upi' }).success, false);
});
