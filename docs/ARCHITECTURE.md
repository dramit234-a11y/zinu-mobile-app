# ZINU — Architecture & Delivery Plan

> Status: **APPROVED** (with the decisions below). Phase 1 delivered — see [`PHASE_1.md`](./PHASE_1.md). Phase 2 delivered — see [`PHASE_2.md`](./PHASE_2.md). Phase 3 delivered — see [`PHASE_3.md`](./PHASE_3.md).
> Source of truth for product scope: [`ZINU_MASTER_SPEC.md`](./ZINU_MASTER_SPEC.md).
> This document is the technical companion to that spec and is updated as decisions are made.

---

## A. Recommended technology stack

| Layer | Choice | Why |
|---|---|---|
| Mobile (Android + iOS) | **React Native + Expo (SDK, dev-client / prebuild), TypeScript** | One codebase for both platforms; native modules where needed (maps, background location, camera); EAS Build/Submit/Update for store pipelines; same language as backend and admin, so types and validation are shared. |
| Mobile state & data | TanStack Query (server state), Zustand (local UI state), Zod (validation), i18next (languages), React Navigation | Proven, small, testable. |
| Maps on device | `react-native-maps` (Google Maps provider on both platforms) | Mature; provider-swappable behind our own `MapView` wrapper. |
| Background location (driver) | `expo-location` + `expo-task-manager` with Android foreground service; option to upgrade to Transistorsoft `react-native-background-geolocation` (paid licence) if battery/accuracy needs it | Required for drivers online/on-trip. |
| Backend API | **Node.js 22 LTS + NestJS (TypeScript)** as a **modular monolith** | Clear module boundaries now, can split hot modules (dispatch, location) into separate services later without rewriting. |
| Database | **PostgreSQL 16 + PostGIS** | Relational integrity for money/trips; PostGIS for zones, geofences, distance queries. |
| ORM / SQL | Drizzle ORM (SQL-first, supports PostGIS custom types) + versioned SQL migrations | Prisma handles PostGIS poorly. |
| Hot data / realtime | **Redis 7** — GEO index of online drivers, dispatch locks, OTP/rate-limits, Socket.IO adapter, caching | Sub-millisecond nearest-driver lookups. |
| Background jobs | **BullMQ** (on Redis) — dispatch timeouts, scheduled/regular rides, reminders, document-expiry, payouts | Reliable delayed + repeatable jobs with retries. |
| Realtime transport | **Socket.IO** (WebSocket) with Redis adapter | Driver location stream, ride state updates, chat, admin live map. Push notifications when app is backgrounded. |
| Admin web | **Next.js (React, TypeScript)** + a component library (shadcn/ui or Ant Design) | Separate deployable, separate domain, staff-only auth. |
| Shared code | pnpm workspaces + Turborepo monorepo; `packages/shared` (types, Zod schemas, enums, ride state machine), generated API client from OpenAPI | One definition of “a ride”, used by all apps. |
| Cloud | **AWS ap-south-1 (Mumbai)**: ECS Fargate, RDS PostgreSQL, ElastiCache Redis, S3 (+KMS), CloudFront, Secrets Manager, SES | Indian data residency, low latency to Ranchi. (GCP Mumbai is an equivalent alternative.) |
| Infra as code | Terraform | Reproducible staging/production. |
| CI/CD | GitHub Actions (lint, typecheck, test, build, deploy) + EAS for mobile | |
| Observability | Sentry (mobile, admin, API), OpenTelemetry → Grafana/CloudWatch, structured JSON logs | |

**Alternative considered:** Flutter (excellent UI performance, but separate language from backend/admin → no shared types). Native Kotlin + Swift (best control, ~2× cost). React Native/Expo is the best fit for one team shipping passenger + driver + admin.

---

## B. Complete app architecture

```
zinu/ (monorepo)
├── apps/
│   ├── mobile/          Expo app — Passenger mode + Driver mode in one binary
│   ├── admin/           Next.js Admin Dashboard (separate domain, staff-only)
│   ├── api/             NestJS HTTP + WebSocket API
│   ├── worker/          Same NestJS codebase, job-processor entrypoint (BullMQ)
│   └── trip-share/      Tiny public web page for "Share Trip" links (Next.js route or static)
├── packages/
│   ├── shared/          Enums, Zod schemas, ride state machine, money utils, i18n keys
│   ├── api-client/      Typed client generated from the API's OpenAPI spec
│   └── config/          ESLint/TS/Prettier presets
├── infra/               Terraform (AWS), docker-compose for local dev
└── docs/                Spec, architecture, ADRs, runbooks
```

### Mobile app internal structure

```
apps/mobile/src/
├── app/                 Navigation roots: Bootstrap → Auth → (PassengerTabs | DriverTabs)
├── features/
│   ├── bootstrap/       Splash: connectivity, min-version check, session restore, role routing
│   ├── onboarding/      Swipe screens, language picker
│   ├── auth/            Phone → OTP → account type
│   ├── passenger/       home, search, ride-options, booking, live-ride, trips, wallet, my-drivers…
│   ├── driver/          onboarding, verification, home/online, requests, navigation, earnings…
│   ├── safety/          SOS, share trip, emergency contacts (shared by both modes)
│   ├── chat/            Quick messages + text (shared)
│   └── profile/         Settings, language, role switch, delete account
├── services/
│   ├── api/             Typed API client, auth token refresh, retry
│   ├── realtime/        Socket connection manager (reconnect, backoff, auth)
│   ├── location/        Foreground + background location, permission flows
│   ├── maps/            MapView wrapper + map-provider-agnostic types
│   ├── push/            Push token registration, notification routing
│   └── storage/         Secure storage (tokens in Keychain/Keystore), MMKV cache
├── i18n/                en, hi (+ regional later); all strings externalised
└── ui/                  Design system: theme, typography, accessible components
```

**Role switching:** one account (one phone number) can hold `PASSENGER` and/or `DRIVER` roles. The app root renders the active mode; Profile → “Switch to Driver/Passenger” appears only when both roles are approved.

**Secrets rule:** the app contains only *public, restricted* identifiers (API base URL, Google Maps **SDK** key restricted to the app’s package name/SHA-1 and iOS bundle ID, Sentry DSN). All secret keys (OTP, payment, Places/Directions server key, masked calling, storage) live only on the backend in AWS Secrets Manager. Address search, routing and fare calculation go **through our API**, never directly from the phone to the provider.

---

## C. Database architecture (PostgreSQL + PostGIS)

Conventions: UUIDv7 primary keys · all money as **integer paise** (`BIGINT`) · `timestamptz` in UTC with per-city timezone · soft-delete where legally needed · `created_at/updated_at` everywhere · every config table scoped by `city_id` · optimistic locking (`version`) on rides.

### Identity & access
- `users` (id, phone_e164 UNIQUE, name, email, photo_key, language, status, deleted_at)
- `user_roles` (user_id, role: PASSENGER | DRIVER | CORPORATE_ADMIN, status)
- `auth_sessions` (user_id, device_id, refresh_token_hash, platform, push_token, last_seen, revoked_at)
- `emergency_contacts` (user_id, name, phone, relation)
- `staff_users`, `staff_roles`, `permissions`, `staff_role_permissions` (admin RBAC, TOTP secret encrypted)
- `audit_logs` (actor_type, actor_id, action, entity, entity_id, before, after, ip, at) — append-only

### Geography & configuration
- `cities` (name, state, timezone, currency, status, operating_hours, settings JSONB)
- `zones` (city_id, name, type: SERVICE | PREFERRED | AIRPORT | RESTRICTED, `geography(POLYGON)`)
- `vehicle_categories` (code: BIKE | TOTO | AUTO | CAB | …, capacity, icon) and `city_vehicle_categories` (enabled per city)
- `pricing_rules` (city_id, category_id, version, base_fare, per_km, per_min, min_fare, platform_fee, tax_pct, time-band/surge config, effective_from/to) — **versioned, never edited in place**
- `dispatch_configs` (city_id, radius steps, offer timeout, max offers, scoring weights)
- `app_versions` (platform, min_supported, latest), `feature_flags`

### Passengers
- `passenger_profiles`, `saved_places` (`geography(POINT)`), `recent_searches`
- `preferred_drivers` (passenger_id, driver_id, trips_together) — “My Driver”

### Drivers & vehicles
- `driver_profiles` (user_id, city_id, verification_status, dob, address, home_zone_id, daily_goal_paise, rating_avg, rating_count)
- `driver_documents` (driver_id, type, number, file_key, expires_at, status, reviewer_id, review_note)
- `driver_payout_accounts` (tokenised/encrypted bank/UPI reference — never raw where provider can hold it)
- `vehicles` (registration_no UNIQUE, category_id, ownership: DRIVER | ZINU | FLEET_PARTNER, fleet_partner_id, make/model/colour, photos)
- `vehicle_documents` (RC, insurance, PUC, permit, expires_at)
- `driver_vehicle_assignments` (driver_id, vehicle_id, from, to)
- `driver_preferred_zones`, `driver_destination_modes` (Earn My Way Home sessions)
- `driver_status_log` (online/offline intervals — online time & audits)

### Rides
- `fare_quotes` (rider, pickup, drop, category, route polyline, distance_m, duration_s, breakdown JSONB, pricing_rule_version, expires_at) — the booked ride must reference a valid quote, so prices can’t be tampered with client-side
- `rides` (passenger_id, booked_for_name/phone, driver_id, vehicle_id, city_id, category_id, type: NOW | SCHEDULED | REGULAR | SHARED, status, pickup/drop `geography(POINT)`, otp_hash, quote_id, final fare fields, payment_method, cancel reason/by, version)
- `ride_events` (ride_id, from_status, to_status, actor, payload, at) — append-only state history
- `ride_offers` (ride_id, driver_id, offered_at, responded_at, response, score) — dispatch audit
- `ride_location_points` (ride_id, driver_id, point, speed, heading, recorded_at) — **partitioned by month**, retention policy
- `ratings` (ride_id, from_user, to_user, stars, tags[], comment)
- `scheduled_rides`, `regular_ride_plans` (recurrence rule, pickup, drop, time, category, preferred_driver_id, payment_method, paused_until)

### Shared rides
- `shared_routes` (city_id, stops, schedule), `shared_trips` (route_id, vehicle_id, departure, capacity), `seat_bookings` (trip_id, ride_id, seats) with a **DB constraint/transaction that prevents overbooking**

### Money (double-entry ledger)
- `ledger_accounts` (owner type/id: PASSENGER_WALLET, DRIVER_BALANCE, ZINU_REVENUE, GATEWAY_CLEARING, TAX_PAYABLE…)
- `ledger_entries` (transaction_id, account_id, amount_paise ±) — balances are **derived**, entries are immutable, every transaction sums to zero
- `payments` (ride_id, method, gateway, gateway_order_id, status, amount), `refunds`, `payment_webhook_events` (idempotency)
- `payouts` (driver_id, amount, gateway_ref, status)
- `driver_plans` (city_id, name, monthly_price, commission_pct, features JSONB, priority, limits) and `driver_subscriptions`
- `promotions`, `promo_redemptions`, `referral_codes`, `referrals` (with abuse signals: device id, payment instrument fingerprint)

### Safety, support, communication
- `sos_incidents` (ride_id, raised_by, location, status, handled_by, timeline)
- `trip_shares` (ride_id, token_hash, expires_at, revoked_at)
- `chat_messages` (ride_id, sender, type: QUICK | TEXT, body, at) — retained per privacy policy
- `call_sessions` (ride_id, provider_ref, masked_number, duration)
- `support_tickets`, `complaints`, `notifications` (inbox), `notification_preferences`

### Fleet & business
- `zinu_vehicle_applications`, `fleet_partners`, `vehicle_rentals` (deposit, rent, schedule), `vehicle_maintenance`, `battery_swaps/charging_logs`
- `corporate_accounts`, `corporate_members`, `corporate_policies`, `corporate_invoices`

**Scaling notes:** read replica for reports/admin; location points partitioned + archived to S3; online-driver positions live in Redis (not Postgres) and only trip paths are persisted; all hot queries indexed by `city_id`; GiST indexes on all geography columns.

---

## D. Backend architecture

### Modules (NestJS, one deployable, strict boundaries)
`auth` · `users` · `passengers` · `drivers` · `driver-verification` · `vehicles` · `fleet` · `geo` (cities, zones, geofencing) · `maps` (provider abstraction) · `pricing` · `rides` (state machine) · `dispatch` (matching) · `shared-rides` · `scheduling` · `location` (ingestion) · `realtime` (gateway) · `payments` · `wallet/ledger` · `payouts` · `subscriptions` · `promotions` · `notifications` · `chat` · `calling` · `safety` · `ratings` · `support` · `corporate` · `admin` (RBAC) · `audit` · `reports` · `config`.

Modules talk through service interfaces + an internal **domain event bus** (e.g. `ride.completed` → payments, ratings prompt, earnings, notifications). This lets us extract `dispatch` and `location` as separate services later without changing callers.

### Ride state machine (shared package, enforced server-side)
```
REQUESTED → SEARCHING → DRIVER_ASSIGNED → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED
               │               │                 │               (OTP verified)
               ├→ NO_DRIVER_FOUND                ├→ CANCELLED_BY_PASSENGER / CANCELLED_BY_DRIVER / NO_SHOW
               └→ CANCELLED_BY_PASSENGER
```
Every transition is one DB transaction: check current state + `version`, write `rides`, append `ride_events`, emit domain event. Illegal transitions are rejected. Ride OTP is stored hashed; start-ride requires correct OTP with attempt limits.

### Dispatch / matching engine
1. Online drivers publish location (~every 4–5 s on trip, ~10 s idle) over WebSocket → stored in Redis `GEO` keyed `drivers:{city}:{category}` + driver state hash.
2. On request: `GEOSEARCH` within radius step 1 → filter eligibility (approved, documents valid, online, not busy, vehicle category, service zone, plan limits).
3. Score candidates using configurable weights: pickup ETA, rating, acceptance, **preferred driver (My Driver) first**, **Earn My Way Home / Return Ride heading compatibility** (angle + corridor distance toward driver’s destination), subscription priority.
4. Offer to the best driver(s) with countdown (configurable timeout); acceptance is atomic (`SET NX` lock on ride) so a ride can never be double-assigned.
5. No acceptance → next candidates → expand radius per `dispatch_configs` → `NO_DRIVER_FOUND`.
6. All offers logged in `ride_offers` for fairness audits.

Dispatch runs as BullMQ jobs, sharded by city, so adding cities/drivers scales horizontally.

### Maps service layer
`MapsProvider` interface: `autocomplete`, `placeDetails`, `geocode`, `reverseGeocode`, `route`, `distanceMatrix`, `snapToRoad`. Implementations: Google Maps Platform (default), Ola Maps / Mappls (MapmyIndia) as alternatives. Responses cached in Redis to cut cost. Geofencing done locally in PostGIS (no provider dependency).

### Auth & security
- OTP: 6 digits, hashed in Redis, 5-min TTL, max attempts, resend cooldown, per-phone/IP/device rate limits, provider-agnostic `OtpSender` (MSG91/Twilio).
- Tokens: short-lived JWT access (≈15 min) + rotating refresh tokens stored hashed per device; revoke on logout/delete account.
- Admin: separate auth realm — email + password (Argon2id) + **mandatory TOTP 2FA**, httpOnly secure cookies, RBAC per permission, every write audited, optional IP allow-list.
- Files: S3 private bucket, KMS encryption, upload/download via short-lived presigned URLs only; documents never publicly readable.
- Payments: gateway-hosted checkout; we store only gateway tokens/references (PCI-DSS scope minimised); webhooks verified by signature and processed idempotently.
- Later: Play Integrity / App Attest to block tampered apps; WAF on public endpoints.

### API style
REST (`/v1/...`) with OpenAPI spec for request/response; WebSocket for realtime; idempotency keys on booking and payment endpoints; cursor pagination; consistent error codes mapped to localised messages in the app.

---

## E. Passenger / Driver / Admin structure

| Area | Passenger mode | Driver mode | Admin dashboard |
|---|---|---|---|
| Entry | “I Need a Ride” | “I Want to Drive” | Separate web domain, staff login + 2FA |
| Home | Map, Where to?, quick places, service cards | GO ONLINE switch, today’s earnings/trips/time, daily goal | Live ops: drivers online, active rides, pending, SOS, demand map |
| Bottom nav | Home · Trips · **Book** · Wallet · Profile | Home · Requests · Earnings · Trips · Profile | Sidebar modules (see spec §55) |
| Core flow | Search → options → fare → confirm → finding → assigned → arrived → live → complete → rate | Request card → accept → navigate → arrived → OTP → trip → complete → earnings | Monitor, intervene, configure |
| Signature features | My Driver, Regular Ride, Schedule, Book for Someone, Shared | Earn My Way Home, Find Return Ride, Preferred Areas, Plans, ZINU Vehicle | Pricing, zones, plans, promotions per city |
| Safety | SOS, share trip, emergency contacts | SOS, support | SOS incident queue with live location |

All three use the **same API and database**. Roles and permissions are checked server-side on every request; the mobile UI only reflects them.

Admin RBAC roles (initial): Super Admin, City Manager, Verification Officer, Support Agent, Safety Officer, Finance, Fleet Manager, Read-only Analyst — each a set of granular permissions, scoped to one or more cities.

---

## F. Development phases

Each phase ends with something testable on real devices against the real backend.

| # | Phase | Contents |
|---|---|---|
| 1 | **Foundation & Identity** | Monorepo, CI, local Docker dev (Postgres/PostGIS, Redis), staging infra plan; API skeleton (config, logging, errors, health, OpenAPI); DB migrations for identity + cities/zones; OTP auth with refresh tokens; mobile: splash (connectivity, version, session, role), language (EN/HI), onboarding, login/OTP, account type, passenger profile, emergency contact, driver “apply” entry stub, profile/settings, logout, delete account; Admin: staff login + TOTP, RBAC, Cities & Zones (map polygon editor), passenger list, audit log. |
| 2 | Driver Onboarding & Verification | Driver registration form, vehicle, camera document capture, S3 presigned upload, statuses (§27), admin verification queue, document expiry tracking + reminders, push notification infrastructure (FCM/APNs). |
| 3 | Maps, Location & Pricing | Maps provider layer, location permission flow, passenger home map, destination search/autocomplete/choose-on-map, saved places, route & ETA, ride category cards, fare breakdown from admin-configured pricing, signed fare quotes; admin Pricing & Ride Categories. |
| 4 | **Core Ride Lifecycle (realtime)** | Driver go online/offline + background location, Redis geo index, dispatch engine, request card with countdown, accept/decline, assignment, live tracking, arrival, OTP start, live trip, completion with confirmation, cancellations, ratings, trip history, cash payment; admin Live Trips + live map. |
| 5 | Payments, Wallet & Earnings | Razorpay (UPI, cards), double-entry ledger, ZINU Wallet (closed-loop), refunds, receipts (PDF/share), driver earnings dashboard, commission, payouts, admin Payments/Payouts. |
| 6 | Safety & Communication | Safety Center, SOS with confirmation + emergency call (112), trip-share public page, chat with quick messages, masked calling, support tickets/complaints, admin SOS & Support. |
| 7 | **Pilot Hardening & Store Release** | Load/soak tests, security review, accessibility pass, crash/analytics, privacy policy & data-safety forms, TestFlight + Play closed testing, Ranchi pilot launch runbook. |
| 8 | Scheduled, Regular, Family & My Driver | Schedule ride, recurring Regular Ride plans, reminders, reliable scheduled dispatch, Book for Someone Else (+ tracking), Save/Request My Driver. |
| 9 | Driver Growth Features | Preferred areas/home zone, Earn My Way Home, Find Return Ride, daily goal, driver plans & subscriptions (commission vs subscription). |
| 10 | ZINU Shared | Shared routes, seat inventory, real-time seat updates, no-overbooking guarantee, per-seat fares, pooled dispatch. |
| 11 | ZINU Vehicle Program & Fleet | Vehicle applications, ownership types, assignments, rental/deposit, maintenance, charging/battery, fleet partners. |
| 12 | Promotions, Referrals & ZINU Business | Promo codes, referrals with abuse prevention, campaigns, corporate accounts, policies, monthly billing. |
| 13 | Scale & Expansion | Reports/analytics, regional languages, multi-city rollout tooling, extraction of dispatch/location services if load requires, cost optimisation. |

---

## G. Estimated complexity

| Phase | Complexity | Main risk |
|---|---|---|
| 1 Foundation & Identity | **Medium–High** | Getting conventions right (everything later builds on it); OTP provider/DLT setup |
| 2 Driver Onboarding | Medium | Camera/upload reliability on low-end Android |
| 3 Maps & Pricing | Medium–High | Map API cost, address quality in Ranchi |
| 4 Core Ride Lifecycle | **Very High** | Realtime correctness, background location on Android OEMs, dispatch race conditions |
| 5 Payments & Earnings | High | Ledger correctness, gateway onboarding/KYC, reconciliation |
| 6 Safety & Communication | Medium–High | Masked-calling provider onboarding, SOS reliability |
| 7 Hardening & Release | Medium | Store review (background location justification) |
| 8 Scheduled/Regular/Family | High | Reliable time-based dispatch, edge cases (no driver at schedule time) |
| 9 Driver Growth | Medium–High | Matching heuristics quality |
| 10 Shared Rides | **Very High** | Pooling algorithm, seat concurrency, fairness |
| 11 Fleet Program | Medium | Mostly admin CRUD + finance rules |
| 12 Promotions & Business | Medium–High | Abuse prevention, corporate billing |
| 13 Scale & Expansion | Ongoing | — |

The **Ranchi pilot MVP = Phases 1–7.**

---

## H. External services / accounts required

| Need | Recommended | Alternatives | When needed | Notes |
|---|---|---|---|---|
| Apple Developer Program | Organisation account (US$99/yr) | — | Phase 1 (for device builds), essential by Phase 7 | Organisation enrolment needs a **D-U-N-S number** |
| Google Play Console | Organisation account (US$25 one-time) | — | Phase 1/7 | New *personal* accounts must run a 12-tester/14-day closed test before production — an organisation account avoids this |
| Expo / EAS | EAS account (free tier to start, paid for more builds) | Local builds | Phase 1 | |
| Cloud | AWS (Mumbai) | GCP Mumbai | Phase 1 (local Docker first, staging by end of Phase 1/2) | |
| SMS OTP | **MSG91** | Twilio Verify, Gupshup, Firebase Phone Auth | Phase 1 | India requires **TRAI DLT registration** (entity + sender ID + template) — start early, can take days |
| Push | Firebase Cloud Messaging + Apple APNs key | — | Phase 2 | Firebase project + APNs auth key from Apple account |
| Maps | **Google Maps Platform** (Maps SDK, Places, Routes, Geocoding) | Ola Maps, Mappls (MapmyIndia) | Phase 3 | Billing account required; separate restricted mobile SDK keys and server key |
| Payments | **Razorpay** (UPI, cards, RazorpayX/Route payouts) | Cashfree, PayU | Phase 5 | Business KYC, bank account, GST; current account for payouts |
| Masked calling | **Exotel** | Knowlarity, Plivo | Phase 6 | Virtual numbers + KYC |
| Error monitoring | Sentry | Firebase Crashlytics | Phase 1 | |
| Email (admin, receipts) | AWS SES | Postmark | Phase 1/5 | Domain verification |
| Domain & DNS | zinu domain (e.g. for API, admin, trip-share links) | — | Phase 1 | |
| Document verification (optional) | DL/RC verification API (e.g. Surepass, IDfy, DigiLocker partner) | Manual review | Phase 2+ | Manual admin review works for pilot |

**Legal/regulatory (consult a lawyer — not legal advice):** MoRTH Motor Vehicle Aggregator Guidelines and Jharkhand state aggregator licensing/rules (incl. bike-taxi permissibility); Digital Personal Data Protection Act 2023 and its Rules (consent, data retention, deletion); RBI rules for wallets (keep ZINU Wallet a **closed-system** prepaid instrument: usable only for ZINU services, no cash withdrawal); GST on rides and platform fees; driver insurance requirements.

---

## I. Android & iOS deployment architecture

```
GitHub ──► GitHub Actions ──► EAS Build ──► EAS Submit ──► Play Console (internal → closed → production)
                                                     └──► App Store Connect (TestFlight → App Review → production)
                 └──► EAS Update (OTA JS-only fixes, per channel)
```

- **Environments:** `development` (local API), `staging` (staging API, internal testers), `production`. Separate bundle IDs for staging (`in.zinu.app.staging`) so both can be installed side by side; production `in.zinu.app` (final IDs to be confirmed by you).
- **Versioning:** semantic app version + auto-increment build numbers; backend `app_versions` table drives the splash-screen “update required” check.
- **OTA policy:** EAS Update only for JS/asset fixes that don’t change native behaviour (store-policy compliant); native changes go through store review.
- **Signing:** managed by EAS (Android upload keystore + Play App Signing; iOS distribution certs/profiles) — credentials never committed.
- **Android specifics:** driver online mode uses a **foreground service of type `location`** with a persistent notification (Android 14+ requirement); this avoids needing `ACCESS_BACKGROUND_LOCATION` in most flows. Play Console **location permission declaration + demo video** will be needed. Battery-optimisation guidance screen for aggressive OEMs (Xiaomi, Vivo, Oppo, Realme).
- **iOS specifics:** “When In Use” location + `location` background mode (blue status indicator while driver is online); clear `NSLocationWhenInUseUsageDescription` text; App Review notes with a demo driver account; Sign in with Apple **not** required since we use phone OTP only.
- **Passenger privacy:** passenger mode never requests background location; location used only during search/booking/active ride.
- **Store compliance:** in-app account deletion (both stores require it), privacy policy URL, Play Data Safety form, App Store privacy labels.
- **Backend deployment:** Docker images → ECR → ECS Fargate (api, worker as separate services, autoscaled), RDS PostgreSQL Multi-AZ, ElastiCache Redis, S3 + CloudFront, ALB with WebSocket support, blue/green deploys, automated DB migrations, daily backups + point-in-time recovery.
- **Admin deployment:** Next.js container on ECS (or Vercel in India region) behind its own domain, WAF, staff-only.

---

## Recorded decisions

| # | Decision |
|---|---|
| 1 | Stack approved: React Native/Expo, NestJS, PostgreSQL/PostGIS, Next.js admin. |
| 2 | Production backend on **AWS Mumbai (ap-south-1)**. |
| 3 | **Google Maps** for the MVP, behind the maps provider abstraction. |
| 4 | **MSG91** for OTP. DLT registration not yet started; the provider stays configurable (`OTP_PROVIDER`). See [`OTP_SETUP.md`](./OTP_SETUP.md). |
| 5 | App identifiers: Android `in.zinu.app`, iOS `in.zinu.app`. |
| 6 | Apple/Google developer accounts are arranged before store publishing; development continues without them. |
| 7 | Scope is spec §1–§60, built phase by phase. |

## Implementation notes (Phase 1)

- The API is an ES-module NestJS 12 app. SQL migrations are generated by Drizzle from `apps/api/src/db/schema.ts`.
  PostGIS column types are hand-checked in each migration, because Drizzle quotes custom type names.
- Mobile routes use real path segments (`/passenger/...`, `/driver/...`) rather than route groups, so deep links and
  reloads are never ambiguous between modes.
- Driver mode is reachable while the driver role is `ONBOARDING`, so applicants can see their verification status.
  Switching modes from Profile is offered only when both roles are active (spec §2).
- Request validation uses the shared Zod schemas. A generated OpenAPI document and typed client
  (`packages/api-client`) are planned once the API surface grows (Phase 2–3).

## Implementation notes (Phase 2)

- Local S3-compatible storage is **RustFS** (Apache-2.0). MinIO no longer publishes free community images.
- Uploads use presigned **POST** policies, so the storage server enforces size and content type; the API confirms with HEAD.
- Documents are versioned rows (`driver_documents`). "Current" is the latest non-superseded version and "in force" the latest
  approved/expired one, so renewals are reviewed without interrupting a driver.
- Background jobs use BullMQ on Redis in a separate worker process (`dist/worker.js`, same Docker image with a different command).
- Online eligibility lives in `DriverRegistrationService.eligibility` and is the single check Phase 4 uses for GO ONLINE.

## Implementation notes (Phase 3)

- Maps: `MapsProvider` (Google: Places API (New), Geocoding, Routes API; demo provider without a key) behind `MapsService`
  (Redis cache, per-user rate limit). The mobile app never calls Google web services directly.
- Map rendering: `ZinuMap` component. Native = react-native-maps (Google on Android; Apple Maps on iOS unless built with an
  iOS key); web preview = Leaflet + OpenStreetMap. Keys are injected at build time via `app.config.ts` from the environment.
- Fare engine `calculateFare` lives in `@zinu/shared` (integer paise) and is the single source of truth for API, admin and app.
- Pricing rules are append-only versions; `fare_quotes` store the rule id, route and breakdown, and expire after 10 minutes.
