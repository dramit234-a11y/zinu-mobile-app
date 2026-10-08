# Google Maps Platform setup

Without a key, the API runs with `MAPS_PROVIDER=demo`: built-in **demonstration data** for Ranchi (about 14 well-known
places with *approximate* coordinates, straight-line routes with a road factor and an assumed 20 km/h average speed).
The app shows a yellow **"Demonstration map data"** banner whenever demo data is in use. Production refuses to start
with demo data.

## 1. Create the project (you)
1. Sign in at console.cloud.google.com with the Google account that will own ZINU's billing.
2. Create a project, e.g. **zinu-prod** (later also **zinu-staging**).
3. **Billing** → link a billing account. A card is required; Google charges per use (see costs below).
4. **APIs & Services → Library**, then enable:

| API | Used for | Called from |
|---|---|---|
| **Places API (New)** | Address autocomplete (§11), place details | ZINU API server |
| **Geocoding API** | Reverse geocoding: the address under the pin / current location | ZINU API server |
| **Routes API** | Route, distance, ETA and route line (§12) | ZINU API server |
| **Maps SDK for Android** | Drawing the map in the Android app | Android app |
| **Maps SDK for iOS** | Optional: Google maps on iPhone instead of Apple Maps | iOS app |

The older "Places API", "Directions API" and "Distance Matrix API" are **not** needed.

## 2. Create three restricted keys (you)
**APIs & Services → Credentials → Create credentials → API key.** Restrict every key:

| Key | Application restriction | API restriction | Where it goes |
|---|---|---|---|
| **Server key** | IP addresses of the ZINU API servers (add later for AWS; none for local testing) | Places API (New), Geocoding API, Routes API | API env `GOOGLE_MAPS_SERVER_KEY` (AWS Secrets Manager in production) |
| **Android key** | Android apps: package `in.zinu.app` + the SHA-1 of the signing certificate (EAS shows it: `eas credentials`) | Maps SDK for Android | EAS environment variable `GOOGLE_MAPS_ANDROID_API_KEY` |
| **iOS key** (optional) | iOS apps: bundle ID `in.zinu.app` | Maps SDK for iOS | EAS environment variable `GOOGLE_MAPS_IOS_API_KEY` |

Never paste keys into code or chat. The mobile keys are build-time settings (`apps/mobile/app.config.ts` reads them from the
environment). The server key is used only by the API, and the app never sees it.

## 3. Switch the API to Google (with me)
```
MAPS_PROVIDER=google
GOOGLE_MAPS_SERVER_KEY=<server key>
```

## 4. Protect your spend (you, 5 minutes)
- **Billing → Budgets & alerts**: a monthly budget with email alerts at 50%, 90% and 100%.
- **APIs & Services → each API → Quotas**: cap requests per day (e.g. Places Autocomplete) so a bug or abuse cannot
  run up a large bill.
- ZINU's own protections:
  - each user can make at most `MAPS_MAX_REQUESTS_PER_HOUR` (default 300) map lookups per hour
  - results are cached (autocomplete for 1 hour, addresses for 1 day, routes for 10 minutes)
  - autocomplete uses **session tokens**, so typing plus selecting is billed as one session

## Costs: what to expect
Google charges **per request, per API ("SKU")**, with a **monthly free usage allowance per SKU**, and India has its own
(lower) price list. Prices change, so check the current numbers on Google's pricing page for India before launch. I
have not quoted rupee amounts here because they would go out of date.

What one passenger fare check uses today:
- **1 autocomplete session** (several keystrokes, billed as a session when it ends with place details)
- **1 place details** call
- **about 1–2 reverse geocodes** (the address of the current location or map pin; cached)
- **1 route** (Routes API). Routes are requested *traffic-aware*, which is billed at a higher tier than basic routing. If
  cost matters more than live-traffic ETAs during the pilot, I can switch to traffic-unaware routing.

**Drawing the map** in the Android and iOS apps (Maps SDK) does not cost per map load the way the web APIs above do.
Confirm this on the pricing page for your account. On iPhone, ZINU uses **Apple Maps** for map display unless you add an
iOS Google key, which avoids that cost entirely.

During the Ranchi pilot (tens of drivers, hundreds of passengers) usage is likely to stay within or near the monthly free
allowances. Watch the **Billing → Reports** page in the first weeks and set the budget alerts above.

## Admin map
The admin dashboard's zone editor uses **OpenStreetMap** tiles through Leaflet, which need no key and cost nothing.
OpenStreetMap's tile servers are meant for light use. That is fine for a few staff editing zones; heavy use would need a
paid tile provider.
