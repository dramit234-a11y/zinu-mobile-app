# Phase 1 — Foundation & Identity

Status: **complete** (pending your review).

## What was built

### Backend API (`apps/api`)
- NestJS (TypeScript, ES modules) on **PostgreSQL 16 + PostGIS** and **Redis**, versioned SQL migrations (Drizzle).
- **OTP login**: 6-digit codes generated server-side and stored only as a salted hash in Redis. Codes expire in
  5 minutes, allow 5 attempts and work only once. There is a 30-second resend cooldown and rate limits per number and per IP.
  The SMS provider is pluggable: `console` for development, MSG91 ready for production.
- **Sessions**: 15-minute access tokens plus refresh tokens that rotate on every use and are bound to one device.
  If an old refresh token is replayed, the session is revoked (stolen-token detection). Logout and account deletion
  revoke sessions.
- **Accounts & roles**: one account per mobile number, holding the roles `PASSENGER` and/or `DRIVER`. The passenger
  role is active immediately. The driver role starts in `ONBOARDING` with verification `NOT_SUBMITTED` (spec §27), and
  only approved drivers will be able to go online.
- Profile completion (name, optional email, language, emergency contact), emergency-contact management, and in-app
  **account deletion**: personal data is erased and the number is freed (required by both app stores).
- **App config** endpoint drives the splash screen's "update required" gate.
- **Admin API**:
  - Separate staff accounts: password (Argon2id) + **mandatory authenticator code (TOTP)**, lockout after 5
    failures, httpOnly SameSite=Strict session cookie and CSRF header check.
  - Permission-based roles: Super Admin, City Manager, Support Agent, Analyst.
  - Cities and zones with PostGIS polygons and point-in-zone lookup, user search with block/unblock, staff list,
    app version settings.
  - Append-only **audit log** of staff actions and sensitive account events.
- Seed data: staff roles, **Ranchi** city with an *approximate* development service area, app versions.
- `staff:create` command to create admin users securely.
- **33 automated tests** (4 shared + 29 API) against real Postgres and Redis.
- Production Docker image (verified: boots, health check, migrations).

### Mobile app (`apps/mobile`) — Android & iOS from one codebase
- Expo SDK 57 + Expo Router, app id `in.zinu.app` on both platforms.
- **Splash** (spec §3): animated brand entrance. It checks connectivity, app version, stored session and role,
  shows friendly offline / server-down / update-required states, then routes the user.
- **Language** (spec §5): English / हिन्दी on first launch, changeable in Settings. The whole app is translated;
  more regional languages can be added as one file each.
- **Onboarding** (spec §4): 4 swipeable screens with Skip / Next / Get Started.
- **Login** (spec §6): mobile number with OTP, auto-submit, resend countdown and SMS autofill hints.
- **Account type** (spec §7), **passenger profile** (spec §8) and the **Drive with ZINU** entry (creates the driver role).
- **Passenger mode**: Home (spec §10 layout: location, “Where to?”, quick places, service cards), Trips
  (Upcoming / Completed / Cancelled), raised central **Book** tab, Wallet, and Profile with the full §53 menu.
- **Driver mode**: Home (spec §28: GO ONLINE switch locked until approved, verification status, today's
  earnings / trips / online time / daily goal), Requests, Earnings, Trips, and Profile with the full §54 menu.
- **Role switching** appears only when both roles are approved (spec §2). While a driver application is pending, the
  passenger menu shows its status.
- Working settings: personal details, emergency contacts (up to 5), language, logout, delete account.
- Security: the refresh token is kept in the iOS Keychain / Android Keystore and the access token in memory only. No
  secrets are in the app.
- Accessibility: 48dp touch targets, screen-reader labels and roles, text scaling, visible focus states, and status
  that never relies on colour alone.
- Placeholder ZINU icon and splash. Replace them with your final logo when you have it.

### Admin dashboard (`apps/admin`)
- Separate Next.js web app. The browser talks only to the admin domain, which proxies API calls, so the staff
  session cookie is never exposed to scripts.
- Pages: sign-in (password + authenticator code), dashboard, cities, city detail with zones (create, activate /
  deactivate, “which zones contain this point?”), passengers & drivers (search, block / unblock), staff & roles,
  audit logs, and app version settings.
- The sidebar lists **every** module from spec §55. Modules for later phases are shown with their phase number.

### Engineering
- pnpm monorepo, shared validation schemas used by the API, mobile app and admin, and GitHub Actions CI
  (typecheck, unit tests, API end-to-end tests with PostGIS + Redis, admin build, Docker build).

## Deliberately not in Phase 1 (placeholders are labelled “Soon” in the app)
Maps, location permission, booking, live rides, payments, wallet, notifications, document upload,
driver verification workflow, SOS / trip sharing, and the on-map zone editor all belong to later phases. No screen
shows fake drivers, fares or availability.

## How to test (checklist)

Follow the README to start everything, then:

**Mobile app**
1. Fresh install: splash animates and you choose a language (try हिन्दी), then onboarding (Skip and Next both work).
2. Enter an invalid number (e.g. `12345`): you see an inline error. Enter a valid one: the OTP screen shows
   “Development OTP”.
3. Type a wrong OTP: you see an error message. After 5 wrong attempts you are asked to request a new code.
   Resend unlocks after 30 seconds.
4. Correct OTP, then **Book a Ride**, then the profile form. Save without a name (error), then with a name and an
   emergency contact: you land on Passenger Home.
5. Check all 5 passenger tabs. “Soon” items show a coming-soon message.
6. Profile → Drive with ZINU → Continue as driver: you land on Driver Home. GO ONLINE explains that approval is needed.
7. Close and reopen the app: you go straight to the same mode without logging in again.
8. Profile → Language → switch: the whole app changes language.
9. Profile → Emergency Contacts: add and remove a contact.
10. Logout, then log in again with the same number: you skip profile setup.
11. Delete Account: you return to login, and the same number then registers as a new user.

**Admin dashboard** (http://localhost:3001)
1. Sign in with the email, password and authenticator code from `staff:create`. A wrong code is rejected.
2. The dashboard counts reflect the users you created on the phone.
3. Cities → Ranchi → add a zone (paste a polygon from geojson.io) → “Which zones contain this point?” shows it.
4. Passengers & Drivers: search your number, then **Block**. The app logs you out within 15 minutes and login is refused.
   **Unblock** restores access.
5. Audit Logs show your logins, the zone creation and the block / unblock.
6. Settings: set Android “Minimum supported” to `2.0.0` and reopen the app. It shows **Update required**.
   Set it back to `1.0.0`.

**Automated**
- `pnpm typecheck` and `pnpm test` should both pass.
