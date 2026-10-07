import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';
import { DocumentExpiryService } from '../src/drivers/expiry.service.js';
import { startWorkers } from '../src/jobs/workers.js';
import { MemoryPushProvider } from '../src/notifications/push.provider.js';
import { adminCookie, call, login, setup, uploadFile, type TestContext } from './helpers.js';

let ctx: TestContext;
let stopWorkers: () => Promise<void>;
let db: pg.Client;
before(async () => {
  ctx = await setup();
  stopWorkers = await startWorkers(ctx.app);
  db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
});
after(async () => {
  await stopWorkers();
  await db.end();
  await ctx.close();
});

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000 + 6 * 3_600_000).toISOString().slice(0, 10);
let vehicleSeq = 1000;
const nextVehicle = () => `JH01ZA${vehicleSeq++}`;

/** A driver account with the driver role activated. */
async function newDriver() {
  const auth = await login(ctx.base);
  await call(ctx.base, 'POST', '/v1/me/roles', { token: auth.accessToken, body: { role: 'DRIVER' } });
  return auth;
}

async function uploadDoc(token: string, type: string, files: number, extra: Record<string, unknown> = {}) {
  const uploadIds = [];
  for (let i = 0; i < files; i++) uploadIds.push(await uploadFile(ctx.base, token));
  return call(ctx.base, 'PUT', `/v1/driver/documents/${type}`, { token, body: { uploadIds, ...extra } });
}

/** Completes every registration step; fuel decides whether PUC applies. */
async function completeRegistration(token: string, fuelType = 'CNG', vehicleType = 'AUTO') {
  const cities = await call(ctx.base, 'GET', '/v1/cities');
  const ranchi = cities.body.find((c: { name: string }) => c.name === 'Ranchi');
  let r = await call(ctx.base, 'PUT', '/v1/driver/registration/personal', {
    token,
    body: { fullName: 'Raju Mahto', dateOfBirth: '1990-05-14', address: 'House 12, Harmu Housing Colony, Ranchi', cityId: ranchi.id },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await call(ctx.base, 'PUT', '/v1/driver/registration/vehicle', {
    token,
    body: { vehicleType, fuelType, registrationNumber: nextVehicle(), ownershipType: 'DRIVER_OWNED', make: 'Bajaj', model: 'RE', colour: 'Green' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await uploadDoc(token, 'PROFILE_PHOTO', 1);
  await uploadDoc(token, 'DRIVING_LICENCE', 2, { documentNumber: 'JH0120190012345', expiresOn: inDays(800) });
  await uploadDoc(token, 'VEHICLE_RC', 1, { documentNumber: 'RC123456', expiresOn: inDays(3000) });
  await uploadDoc(token, 'INSURANCE', 1, { documentNumber: 'POL-99881', expiresOn: inDays(200) });
  if (fuelType !== 'ELECTRIC') await uploadDoc(token, 'PUC', 1, { expiresOn: inDays(150) });
  await uploadDoc(token, 'VEHICLE_PHOTOS', 2);
  await call(ctx.base, 'PUT', '/v1/driver/payout', { token, body: { method: 'BANK', holderName: 'Raju Mahto', accountNumber: '123456789012', ifsc: 'sbin0001234' } });
  r = await call(ctx.base, 'PUT', '/v1/me/emergency-contacts', { token, body: { contacts: [{ name: 'Sita Devi', phone: '9123456780', relation: 'Wife' }] } });
  return (await call(ctx.base, 'GET', '/v1/driver/registration', { token })).body;
}

async function approveAll(cookie: string, driverId: string) {
  const detail = await call(ctx.base, 'GET', `/v1/admin/drivers/${driverId}`, { cookie });
  for (const d of detail.body.documents) {
    if (d.current?.status === 'PENDING') {
      const r = await call(ctx.base, 'POST', `/v1/admin/documents/${d.current.id}/approve`, { cookie, admin: true });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
  }
}

async function waitFor<T>(fn: () => Promise<T | undefined>, ms = 5000): Promise<T> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('timed out waiting');
}

describe('uploads', () => {
  test('presigned upload goes straight to storage and is confirmed', async () => {
    const d = await newDriver();
    const id = await uploadFile(ctx.base, d.accessToken);
    const url = await call(ctx.base, 'GET', `/v1/uploads/${id}/url`, { token: d.accessToken });
    assert.equal((await fetch(url.body.url)).status, 200);
    // Another user cannot get a link to it.
    const other = await newDriver();
    assert.equal((await call(ctx.base, 'GET', `/v1/uploads/${id}/url`, { token: other.accessToken })).status, 404);
  });

  test('confirm fails when nothing was uploaded; unsupported types are refused', async () => {
    const d = await newDriver();
    const pre = await call(ctx.base, 'POST', '/v1/uploads/presign', { token: d.accessToken, body: { purpose: 'DRIVER_DOCUMENT', contentType: 'image/jpeg', sizeBytes: 100 } });
    const confirm = await call(ctx.base, 'POST', `/v1/uploads/${pre.body.uploadId}/confirm`, { token: d.accessToken });
    assert.equal(confirm.body.error.code, 'UPLOAD_INVALID');
    const exe = await call(ctx.base, 'POST', '/v1/uploads/presign', { token: d.accessToken, body: { purpose: 'DRIVER_DOCUMENT', contentType: 'application/x-msdownload', sizeBytes: 100 } });
    assert.equal(exe.status, 400);
  });

  test('storage itself rejects a file larger than the signed limit', async () => {
    const d = await newDriver();
    const pre = await call(ctx.base, 'POST', '/v1/uploads/presign', { token: d.accessToken, body: { purpose: 'DRIVER_DOCUMENT', contentType: 'image/jpeg', sizeBytes: 100 } });
    const form = new FormData();
    for (const [k, v] of Object.entries(pre.body.fields as Record<string, string>)) form.append(k, v);
    form.append('file', new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/jpeg' }), 'big.jpg');
    const res = await fetch(pre.body.url, { method: 'POST', body: form });
    assert.ok(res.status >= 400);
  });
});

describe('driver registration', () => {
  test('checklist, PUC only for fuel vehicles, submit, and lock while under review', async () => {
    const d = await newDriver();
    const empty = await call(ctx.base, 'GET', '/v1/driver/registration', { token: d.accessToken });
    assert.equal(empty.body.status, 'NOT_SUBMITTED');
    assert.equal(empty.body.canSubmit, false);
    assert.equal((await call(ctx.base, 'POST', '/v1/driver/registration/submit', { token: d.accessToken })).body.error.code, 'REGISTRATION_INCOMPLETE');

    const reg = await completeRegistration(d.accessToken, 'ELECTRIC', 'TOTO');
    assert.ok(!reg.documents.some((x: { type: { code: string } }) => x.type.code === 'PUC'), 'electric vehicles need no PUC');
    assert.deepEqual(reg.checklist, { personal: true, vehicle: true, documents: true, payout: true, emergencyContact: true });
    assert.equal(reg.canSubmit, true);
    assert.equal(reg.payout.maskedLabel, 'A/c ••••9012 · SBIN0001234');
    assert.equal(reg.eligibility.canGoOnline, false);

    const submitted = await call(ctx.base, 'POST', '/v1/driver/registration/submit', { token: d.accessToken });
    assert.equal(submitted.body.status, 'PROFILE_SUBMITTED');
    const edit = await call(ctx.base, 'PUT', '/v1/driver/registration/personal', { token: d.accessToken, body: { ...reg.personal, address: 'Somewhere else in Ranchi' } });
    assert.equal(edit.body.error.code, 'REGISTRATION_LOCKED');
  });

  test('document rules: number, expiry, file count, already-expired, foreign uploads', async () => {
    const d = await newDriver();
    await completeRegistration(d.accessToken);
    const one = await uploadFile(ctx.base, d.accessToken);
    assert.match((await call(ctx.base, 'PUT', '/v1/driver/documents/DRIVING_LICENCE', { token: d.accessToken, body: { uploadIds: [one], expiresOn: inDays(10), documentNumber: 'DL1' } })).body.error.message, /needs 2 photo/);
    const two = await uploadFile(ctx.base, d.accessToken);
    assert.match((await call(ctx.base, 'PUT', '/v1/driver/documents/DRIVING_LICENCE', { token: d.accessToken, body: { uploadIds: [one, two], expiresOn: inDays(-1), documentNumber: 'DL12' } })).body.error.message, /already expired/);
    assert.match((await call(ctx.base, 'PUT', '/v1/driver/documents/DRIVING_LICENCE', { token: d.accessToken, body: { uploadIds: [one, two] } })).body.error.message, /number/);
    const stranger = await newDriver();
    const theirs = await uploadFile(ctx.base, stranger.accessToken);
    assert.equal((await call(ctx.base, 'PUT', '/v1/driver/documents/PROFILE_PHOTO', { token: d.accessToken, body: { uploadIds: [theirs] } })).body.error.code, 'UPLOAD_INVALID');
  });

  test('a driver-owned vehicle cannot be registered by a second driver', async () => {
    const a = await newDriver();
    const reg = await completeRegistration(a.accessToken);
    const b = await newDriver();
    await call(ctx.base, 'PUT', '/v1/driver/registration/personal', { token: b.accessToken, body: { ...reg.personal, fullName: 'Other Driver' } });
    const r = await call(ctx.base, 'PUT', '/v1/driver/registration/vehicle', {
      token: b.accessToken,
      body: { vehicleType: 'AUTO', fuelType: 'CNG', registrationNumber: reg.vehicle.registrationNumber.replace(/(\d+)$/, ' $1'), ownershipType: 'DRIVER_OWNED' },
    });
    assert.equal(r.body.error.code, 'VEHICLE_ALREADY_REGISTERED');
  });

  test('payout details are encrypted at rest', async () => {
    const d = await newDriver();
    await call(ctx.base, 'PUT', '/v1/driver/payout', { token: d.accessToken, body: { method: 'UPI', holderName: 'Raju', upiId: 'rajumahto@okaxis' } });
    const { rows } = await db.query('select details_enc, masked_label from payout_accounts where driver_id = $1 and active', [d.user.id]);
    assert.ok(!rows[0].details_enc.includes('rajumahto'));
    assert.equal(rows[0].masked_label, 'ra••••@okaxis');
  });
});

describe('admin verification', () => {
  test('full review: start, approve documents, approve driver, role becomes active, driver notified', async () => {
    const cookie = await adminCookie(ctx, 'Verification Officer');
    const d = await newDriver();
    await completeRegistration(d.accessToken);
    await call(ctx.base, 'PUT', '/v1/me/push-token', { token: d.accessToken, body: { token: 'ExponentPushToken[test-device-1]', provider: 'expo' } });
    await call(ctx.base, 'POST', '/v1/driver/registration/submit', { token: d.accessToken });

    const queue = await call(ctx.base, 'GET', '/v1/admin/drivers?status=PROFILE_SUBMITTED', { cookie });
    assert.ok(queue.body.items.some((x: { id: string }) => x.id === d.user.id));
    assert.ok(queue.body.counts.PROFILE_SUBMITTED >= 1);

    assert.equal((await call(ctx.base, 'POST', `/v1/admin/drivers/${d.user.id}/approve`, { cookie, admin: true })).body.error.code, 'REGISTRATION_INCOMPLETE');
    assert.equal((await call(ctx.base, 'POST', `/v1/admin/drivers/${d.user.id}/start-review`, { cookie, admin: true })).body.status, 'DOCUMENTS_UNDER_REVIEW');

    const detail = await call(ctx.base, 'GET', `/v1/admin/drivers/${d.user.id}`, { cookie });
    const fileId = detail.body.documents.find((x: { type: { code: string } }) => x.type.code === 'DRIVING_LICENCE').current.fileIds[0];
    const file = await call(ctx.base, 'GET', `/v1/admin/uploads/${fileId}/url`, { cookie });
    assert.equal((await fetch(file.body.url)).status, 200);

    await approveAll(cookie, d.user.id);
    const approved = await call(ctx.base, 'POST', `/v1/admin/drivers/${d.user.id}/approve`, { cookie, admin: true });
    assert.equal(approved.body.status, 'APPROVED');
    assert.equal(approved.body.eligibility.canGoOnline, true);

    const me = await call(ctx.base, 'GET', '/v1/me', { token: d.accessToken });
    assert.deepEqual(me.body.roles.find((r: { role: string }) => r.role === 'DRIVER'), { role: 'DRIVER', status: 'ACTIVE' });

    const inbox = await call(ctx.base, 'GET', '/v1/me/notifications', { token: d.accessToken });
    assert.deepEqual(inbox.body.slice(0, 2).map((n: { type: string }) => n.type), ['driver.approved', 'driver.application_received']);
    await waitFor(async () => MemoryPushProvider.outbox.find((m) => m.to === 'ExponentPushToken[test-device-1]' && m.title.includes('approved')));

    const history = detail.body.history.map((h: { action: string }) => h.action);
    assert.ok(history.includes('driver.submitted'));
    const logs = (await call(ctx.base, 'GET', `/v1/admin/drivers/${d.user.id}`, { cookie })).body.history.map((h: { action: string }) => h.action);
    for (const a of ['driver.review_started', 'document.approved', 'driver.approved', 'document.file_viewed']) assert.ok(logs.includes(a), a);
  });

  test('request more info: rejected documents are re-uploaded and the driver resubmits', async () => {
    const cookie = await adminCookie(ctx, 'Verification Officer');
    const d = await newDriver();
    const reg = await completeRegistration(d.accessToken);
    await call(ctx.base, 'POST', '/v1/driver/registration/submit', { token: d.accessToken });
    const insurance = reg.documents.find((x: { type: { code: string } }) => x.type.code === 'INSURANCE').current;
    const r = await call(ctx.base, 'POST', `/v1/admin/drivers/${d.user.id}/request-info`, {
      cookie,
      admin: true,
      body: { message: 'Insurance photo is blurry, please retake it.', documentIds: [insurance.id] },
    });
    assert.equal(r.body.status, 'ADDITIONAL_INFO_REQUIRED');

    const mine = await call(ctx.base, 'GET', '/v1/driver/registration', { token: d.accessToken });
    assert.equal(mine.body.statusReason, 'Insurance photo is blurry, please retake it.');
    assert.equal(mine.body.checklist.documents, false);
    await uploadDoc(d.accessToken, 'INSURANCE', 1, { documentNumber: 'POL-99881', expiresOn: inDays(200) });
    const again = await call(ctx.base, 'POST', '/v1/driver/registration/submit', { token: d.accessToken });
    assert.equal(again.body.status, 'PROFILE_SUBMITTED');
  });

  test('suspend and reinstate; reject; staff without permission are refused', async () => {
    const officer = await adminCookie(ctx, 'Verification Officer');
    const manager = await adminCookie(ctx, 'City Manager');
    const support = await adminCookie(ctx, 'Support Agent');
    const d = await newDriver();
    await completeRegistration(d.accessToken);
    await call(ctx.base, 'POST', '/v1/driver/registration/submit', { token: d.accessToken });
    assert.equal((await call(ctx.base, 'POST', `/v1/admin/drivers/${d.user.id}/start-review`, { cookie: support, admin: true })).status, 403);
    assert.equal((await call(ctx.base, 'GET', `/v1/admin/uploads/00000000-0000-7000-8000-000000000000/url`, { cookie: support })).status, 403);
    await approveAll(officer, d.user.id);
    await call(ctx.base, 'POST', `/v1/admin/drivers/${d.user.id}/approve`, { cookie: officer, admin: true });

    assert.equal((await call(ctx.base, 'POST', `/v1/admin/drivers/${d.user.id}/suspend`, { cookie: officer, admin: true, body: { reason: 'Safety complaint under investigation' } })).status, 403);
    const s = await call(ctx.base, 'POST', `/v1/admin/drivers/${d.user.id}/suspend`, { cookie: manager, admin: true, body: { reason: 'Safety complaint under investigation' } });
    assert.equal(s.body.status, 'SUSPENDED');
    assert.equal(s.body.eligibility.reasons[0].code, 'SUSPENDED');
    assert.equal((await call(ctx.base, 'POST', `/v1/admin/drivers/${d.user.id}/reinstate`, { cookie: manager, admin: true })).body.status, 'APPROVED');

    const e = await newDriver();
    await completeRegistration(e.accessToken);
    await call(ctx.base, 'POST', '/v1/driver/registration/submit', { token: e.accessToken });
    assert.equal((await call(ctx.base, 'POST', `/v1/admin/drivers/${e.user.id}/reject`, { cookie: officer, admin: true, body: { reason: 'Licence does not match the applicant' } })).body.status, 'REJECTED');
    assert.equal((await call(ctx.base, 'POST', `/v1/admin/drivers/${e.user.id}/approve`, { cookie: officer, admin: true })).status, 409);
  });
});

describe('document expiry (spec §41)', () => {
  async function approvedDriver() {
    const cookie = await adminCookie(ctx);
    const d = await newDriver();
    await completeRegistration(d.accessToken);
    await call(ctx.base, 'POST', '/v1/driver/registration/submit', { token: d.accessToken });
    await approveAll(cookie, d.user.id);
    await call(ctx.base, 'POST', `/v1/admin/drivers/${d.user.id}/approve`, { cookie, admin: true });
    return { d, cookie };
  }

  test('reminders are sent once per threshold; expiry blocks going online; renewal restores it', async () => {
    const { d, cookie } = await approvedDriver();
    const expiry = ctx.app.get(DocumentExpiryService);
    // Insurance now valid for 6 more days -> the 7-day reminder is due.
    await db.query(`update driver_documents set expires_on = $2 where doc_type = 'INSURANCE' and status = 'APPROVED' and vehicle_id in (select vehicle_id from driver_vehicles where driver_id = $1)`, [d.user.id, inDays(6)]);
    await expiry.run();
    await expiry.run();
    let inbox = (await call(ctx.base, 'GET', '/v1/me/notifications', { token: d.accessToken })).body.filter((n: { type: string }) => n.type === 'document.expiring');
    assert.equal(inbox.length, 1);
    assert.match(inbox[0].title, /Vehicle insurance expires in 6 days/);

    await db.query(`update driver_documents set expires_on = $2 where doc_type = 'INSURANCE' and status = 'APPROVED' and vehicle_id in (select vehicle_id from driver_vehicles where driver_id = $1)`, [d.user.id, inDays(-1)]);
    const result = await expiry.run();
    assert.ok(result.expired >= 1);
    let reg = (await call(ctx.base, 'GET', '/v1/driver/registration', { token: d.accessToken })).body;
    assert.equal(reg.eligibility.canGoOnline, false);
    assert.deepEqual(reg.eligibility.reasons.map((r: { code: string; docType: string }) => `${r.code}:${r.docType}`), ['DOCUMENT_EXPIRED:INSURANCE']);

    // Renewal while approved: new version is reviewed and replaces the expired one.
    const renewed = await uploadDoc(d.accessToken, 'INSURANCE', 1, { documentNumber: 'POL-2027', expiresOn: inDays(365) });
    assert.equal(renewed.status, 200, JSON.stringify(renewed.body));
    const pending = renewed.body.documents.find((x: { type: { code: string } }) => x.type.code === 'INSURANCE');
    assert.equal(pending.current.status, 'PENDING');
    assert.equal(pending.inForce.status, 'EXPIRED');
    await call(ctx.base, 'POST', `/v1/admin/documents/${pending.current.id}/approve`, { cookie, admin: true });
    reg = (await call(ctx.base, 'GET', '/v1/driver/registration', { token: d.accessToken })).body;
    assert.equal(reg.eligibility.canGoOnline, true);
  });

  test('admins can turn off the online restriction for a document type', async () => {
    const { d, cookie } = await approvedDriver();
    await db.query(`update driver_documents set expires_on = $2 where doc_type = 'VEHICLE_RC' and status = 'APPROVED' and vehicle_id in (select vehicle_id from driver_vehicles where driver_id = $1)`, [d.user.id, inDays(-2)]);
    await ctx.app.get(DocumentExpiryService).run();
    assert.equal((await call(ctx.base, 'GET', '/v1/driver/registration', { token: d.accessToken })).body.eligibility.canGoOnline, false);
    const patch = await call(ctx.base, 'PATCH', '/v1/admin/document-types/VEHICLE_RC', { cookie, admin: true, body: { blockOnlineWhenExpired: false, reminderDays: [60, 7, 30] } });
    assert.deepEqual(patch.body.reminderDays, [60, 30, 7]);
    assert.equal((await call(ctx.base, 'GET', '/v1/driver/registration', { token: d.accessToken })).body.eligibility.canGoOnline, true);
    await call(ctx.base, 'PATCH', '/v1/admin/document-types/VEHICLE_RC', { cookie, admin: true, body: { blockOnlineWhenExpired: true } });
  });
});

describe('push notifications', () => {
  test('uninstalled devices are forgotten; tokens move with the device', async () => {
    const d = await newDriver();
    await call(ctx.base, 'PUT', '/v1/me/push-token', { token: d.accessToken, body: { token: 'ExponentPushToken[unregistered-1]', provider: 'expo' } });
    await completeRegistration(d.accessToken);
    await call(ctx.base, 'POST', '/v1/driver/registration/submit', { token: d.accessToken });
    await waitFor(async () => {
      const { rows } = await db.query('select push_token from auth_sessions where user_id = $1 and revoked_at is null', [d.user.id]);
      return rows[0].push_token === null || undefined;
    });

    const other = await newDriver();
    await call(ctx.base, 'PUT', '/v1/me/push-token', { token: other.accessToken, body: { token: 'ExponentPushToken[shared-device]', provider: 'expo' } });
    await call(ctx.base, 'PUT', '/v1/me/push-token', { token: d.accessToken, body: { token: 'ExponentPushToken[shared-device]', provider: 'expo' } });
    const { rows } = await db.query(`select user_id from auth_sessions where push_token = 'ExponentPushToken[shared-device]'`);
    assert.deepEqual(rows.map((r) => r.user_id), [d.user.id]);
  });
});
