# ZINU

**Your Driver. Your Way.** — Affordable for passengers. Fairer for drivers.

One mobile app for Android and iOS (Passenger + Driver modes), one backend API, and a separate web Admin Dashboard.

| Path | What it is |
|---|---|
| `apps/mobile` | Expo (React Native) app — Android & iOS, app id `in.zinu.app` |
| `apps/api` | NestJS API on PostgreSQL + PostGIS and Redis |
| `apps/admin` | Next.js Admin Dashboard (staff only) |
| `packages/shared` | Types, validation schemas and enums shared by all apps |
| `infra/` | Local Postgres/PostGIS + Redis via Docker Compose |
| `docs/` | [Master spec](docs/ZINU_MASTER_SPEC.md) · [Architecture](docs/ARCHITECTURE.md) · [Phase 1 report](docs/PHASE_1.md) · [OTP / MSG91 setup](docs/OTP_SETUP.md) |

## Run everything locally

Prerequisites: **Node.js 22+**, **pnpm** (`corepack enable`), **Docker Desktop**, and the **Expo Go** app on your phone.

```bash
pnpm install                                         # installs all apps, builds the shared package
docker compose -f infra/docker-compose.yml up -d     # Postgres + PostGIS and Redis
cp apps/api/.env.example apps/api/.env               # development settings (no real secrets needed)
pnpm db:migrate                                      # create tables
pnpm db:seed                                         # staff roles, Ranchi city + pilot area, app versions

# Create your admin login (prints a password and an authenticator secret — shown once)
pnpm --filter @zinu/api staff:create --email you@example.com --name "Your Name"

pnpm dev:api      # API on http://localhost:4000   (health: /health)
pnpm dev:admin    # Admin on http://localhost:3001
pnpm dev:mobile   # Expo dev server — scan the QR code with Expo Go
```

### Preview the mobile app

- **On your phone (Expo Go):** phone and computer on the same Wi-Fi. Create `apps/mobile/.env` with
  `EXPO_PUBLIC_API_URL=http://<your computer's LAN IP>:4000`, run `pnpm dev:mobile`, scan the QR code
  (Android: in Expo Go; iPhone: with the Camera app). If your network blocks it, run `pnpm --filter @zinu/mobile start --tunnel`.
- **Android emulator:** `pnpm dev:mobile` then press `a` (the app reaches the API via `10.0.2.2` automatically).
- **iOS simulator (macOS only):** press `i`.
- **In a browser (quick look):** press `w`. Useful for layout checks; phone-only features need a device.

In development the OTP is **not sent by SMS**: it is printed in the API terminal and shown on the OTP screen as “Development OTP”.

## Tests

```bash
pnpm typecheck    # all apps
pnpm test         # shared unit tests + API end-to-end tests (needs the Docker services)
```

## Security rules

- Never commit `.env` files or real keys. The mobile app only ever contains public, restricted values (`EXPO_PUBLIC_*`).
- Secrets live in the API's environment (AWS Secrets Manager in production).
- Production refuses to start with the development OTP provider or with `OTP_DEV_ECHO` enabled.
