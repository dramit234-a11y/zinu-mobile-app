# Phase 2 — Driver Onboarding & Verification

Status: **complete** (pending your review). Phase 1 functionality is unchanged and its tests still pass.

## What was built

### Driver registration in the app (spec §26)
- Step-by-step registration with a progress checklist:
  1. **Personal details**: full name, date of birth (must be 18+), full address, city (from active cities).
  2. **Vehicle**: type (Bike / Toto / Auto / Cab), fuel (a Toto is always electric), vehicle number (normalised, e.g.
     `JH 01 AB 1234` → `JH01AB1234`), ownership **I own it / ZINU vehicle / Fleet partner** (spec §40), make, model, colour.
  3. **Documents & photos**: profile photo (front camera), driving licence (front + back), RC, insurance, PUC
     (*only for non-electric vehicles*), optional permit, and vehicle photos. Document number and expiry date are asked
     only where needed. Photos come from the **camera or gallery**, are resized to 1600 px and compressed before upload.
  4. **Bank account or UPI** for payouts.
  5. **Emergency contact**.
- **Submit for verification** becomes available when every step is complete. The application then locks while it is
  under review.
- Clear status display for every §27 state: Not started, Profile Submitted, Documents Under Review,
  Approved, Additional Information Required (with the reviewer's message), Rejected (with reason), and Suspended.
- **Driver home**: shows status and next action, reasons the driver cannot go online, and warnings for documents
  expiring within 30 days. **GO ONLINE turns green only for approved, eligible drivers** (rides themselves arrive in Phase 4).
- **Renewals**: an approved driver uploads a renewed document. It is reviewed while the old version stays in force.
- **Notifications inbox** (bell with unread count), in English and Hindi.

### Secure file storage
- Storage abstraction over **S3** (AWS in production). Locally it runs on **RustFS**, a free S3-compatible server in Docker.
  MinIO stopped publishing free images, so I did not use it.
- Files never pass through the API:
  - The app gets a 10-minute **presigned upload**, and the storage server itself enforces the 10 MB limit and the file type.
  - The API then verifies the file exists before accepting it.
- The bucket is private. Files are viewed only through **5-minute signed links**: a driver can see only their own
  files, and staff need the `documents.view_files` permission. **Every staff view of a document photo is audited.**
- **Bank/UPI details are encrypted at rest** (AES-256-GCM). Only a masked form such as `A/c ••••9012 · SBIN0001234`
  is ever shown, to the driver or to staff.

### Admin: Driver Verification (spec §27, §55)
- **Queue** with counts per status, plus search by name, phone or vehicle number.
- **Review page**:
  - Personal details, vehicle, payout (masked), emergency contacts and an eligibility summary.
  - Every document with its number, expiry and photos, shown full-size on click.
  - Earlier versions of each document.
  - A full history of the driver's application.
- **Actions** (only those valid for the current status and the reviewer's permissions are shown):
  - Start review
  - Approve or reject each document
  - Approve the driver (refused unless every required document is approved and valid)
  - Request more information: a message to the driver, optionally marking documents to re-upload
  - Reject the application
  - Suspend or reinstate the driver
  - Verify or reject payout details
- Every action is **audited** and the driver is **notified**. Two reviewers can't apply conflicting decisions; the
  second gets "updated by someone else".
- New staff role **Verification Officer** (review and approve, but not suspend). **City Manager** can suspend and
  reinstate.

### Document expiry (spec §41)
- A background **worker** runs a daily scan at **06:00 IST**:
  - It sends reminders on configurable days before expiry (default 30, 15, 7 and 1), exactly once per threshold.
  - It marks documents expired after their last valid day and notifies the driver.
  - Vehicle-document reminders go to whoever currently drives that vehicle.
- **Admin → Document Rules**: per document type, choose whether it is required, whether **expiry blocks going online**
  (the configurable restriction), and the reminder days. There is also a **Run expiry check now** button.

### Push notification infrastructure
- Each device registers its push token on its login session. Tokens are dropped on logout. If a phone is reused, its
  token moves to the new account. When a push service reports an app as uninstalled, its token is removed.
- **Provider abstraction**:
  - `console` for development
  - `expo` (Expo Push → FCM/APNs) for production
  - `memory` for tests
- Delivery runs as a retried background job, so a slow push service never slows down the API.
- See [`PUSH_SETUP.md`](./PUSH_SETUP.md).

### Tests
**52 automated tests** pass (8 shared + 44 API). Phase 2 tests run against real Postgres, Redis and S3-compatible storage. They cover:
- direct uploads, including storage rejecting files that are too large, and access to other users' files
- registration rules, the PUC exemption for electric vehicles, and duplicate vehicles
- payout encryption
- the full review flow and request-more-info
- suspend, reinstate and reject, and permissions per staff role
- reminders sent once, expiry blocking going online, renewal restoring it, and the admin switch for the restriction
- push token handling

I also tested the whole flow in a browser: a new driver registers in the app with real photo uploads, an admin reviews
and approves, and the driver sees approval and notifications.

## How to test

Start everything as in the README. Phase 2 adds **storage** to Docker Compose and a **worker** process (`pnpm dev:worker`).
On a phone, set `S3_PUBLIC_ENDPOINT=http://<your computer's LAN IP>:9000` in `apps/api/.env`, otherwise photo uploads
from the phone cannot reach storage.

**In the app (Expo Go)**
1. Sign up with a new number → **Drive & Earn** → **Continue registration**.
2. Personal details: try an under-18 date of birth (refused), then a valid one.
3. Vehicle: choose Toto. Fuel locks to Electric, and PUC disappears from Documents.
4. Documents: take photos with the camera (allow permission) and from the gallery. Try a past expiry date (refused).
5. Payout: try a wrong IFSC (refused), then use UPI or a bank account.
6. Add an emergency contact → all 5 steps show **Done** → **Submit for verification**.
7. Try editing personal details: they are locked while under review.

**In the admin** (http://localhost:3001)
8. **Driver Verification** → your driver → **Start review** → **View photos** on each document.
9. **Request more info**, tick one document → the app shows your message; re-upload that document and resubmit.
10. Approve each document → **Mark verified** on payout → **Approve driver**. The app's GO ONLINE turns green and the
    bell shows "You are approved…".
11. **Audit Logs** show every decision and each photo view.
12. **Document Rules**: untick "Required" for vehicle photos, or change reminder days. **Run expiry check now** reports its counts.
13. Sign in as a staff member with the **Support Agent** role: Driver Verification is view-only, with no photos and no
    actions. Create one with `pnpm --filter @zinu/api staff:create --email … --name … --role "Support Agent"`.

**Expiry (optional, uses the database directly)**: set an approved insurance document's `expires_on` to yesterday
and press **Run expiry check now**. The driver can no longer go online, and the home screen explains why.

## Known limits (by design for this phase)
- Bank details are checked by a person ("Mark verified"). Automatic penny-drop verification needs the payment provider (Phase 5).
- Document checks are manual. Automatic DL/RC lookups (DigiLocker / Vahan / Sarathi via a KYC provider) can be added later.
- Upload records that are never used are not yet cleaned up automatically. A cleanup job is planned for hardening (Phase 7).
- Lock-screen push needs the setup in `PUSH_SETUP.md` and a development build. The in-app inbox works now.
