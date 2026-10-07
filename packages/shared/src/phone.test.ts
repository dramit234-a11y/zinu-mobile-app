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
