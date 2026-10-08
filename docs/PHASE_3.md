# Phase 3 — Maps, Location & Pricing

Status: **complete** (pending your review). Phase 1 and 2 behaviour is unchanged. All automated tests pass.

## What was built

### Maps behind a provider abstraction (spec §59)
- One `MapsProvider` interface with four operations: **autocomplete, place details, reverse geocoding, route**. Two
  implementations:
  - **Google Maps Platform**: Places API (New) with session tokens, Geocoding API, and Routes API
    (distance, ETA, route line). Its request and response handling is covered by contract tests built from Google's
    published formats, because no real key was available.
  - **Demo provider**, used only when no key is set: approximate demonstration data for Ranchi, **always labelled** in the
    app, and refused in production.
- All map calls go through the **ZINU API**, so the Google server key never ships in the app. Results are cached and
  each user is rate-limited.
- Service zones and geofencing stay in **PostGIS**, independent of the maps provider.

### Passenger app (spec §9–13)
- **Location permission** (§9): a ZINU explanation screen comes first ("Allow location to find nearby ZINU drivers and
  calculate your trip"), then the system prompt. Options are **Allow Location** or **Enter Location Manually**. Location is
  "while using the app" only, and passengers are never tracked in the background.
- **Home** (§10):
  - an interactive map with your position, the pickup pin and the service-area outline
  - the current address
  - **Where to?**
  - Home / Work / Recent / Saved Places shortcuts
  - the ride-type cards
  - a warning when you are outside the service area
- **Destination search** (§11):
  - pickup and destination fields with **autocomplete**, sorted by distance
  - **Use current location**, saved places and recent destinations
  - **Choose on Map**: move the map under a fixed pin, see the address, then confirm. Pins outside the service area are refused.
- **Ride options** (§12): Bike, Toto, Auto, Cab and Shared, each with description, seats, trip duration and the fare
  (Shared shows a per-seat fare). The route is drawn on the map with distance and time.
  - **No fake availability.** Pickup time says "appears when drivers are online" until live drivers exist (Phase 4).
- **Fare breakdown** (§13): base fare, distance charge, time charge, minimum-fare adjustment, night charge, platform fee,
  tax, discount, rounding and estimated total.
  - **Confirm ZINU Ride** explains that booking opens with live drivers in the next phase.
- **Saved Places**: set Home and Work, add other places, remove them. Available from Profile and the home shortcuts.
- **Map rendering:**
  - Android uses Google Maps.
  - iPhone uses **Apple Maps** by default, or Google Maps when an iOS key is supplied at build time.
  - The browser preview uses OpenStreetMap.

### Fares (spec §13, §57)
- **One fare engine** shared by the API, the admin simulator and the app. Amounts are whole paise, rounded to the rupee.
- Every component is configurable per **city × category**:
  - base fare and the distance it includes
  - per km and per minute
  - minimum fare
  - platform fee
  - tax %
  - night surcharge % and the night window (IST)
- **Versioned pricing**: publishing creates a new version and versions are never edited. Every quote records the version
  used, so price changes are auditable.
- **Quotes** are stored on the server with a 10-minute expiry. Phase 4 books against the quote ID, so the app cannot
  change the price.
- Pickup and destination must both be inside an active service zone of the same city. Very short trips are refused.

### Admin
- **Pricing**: current fares for every category in a city. The editor shows a **live fare simulator** (distance, minutes,
  hour of day) using the same calculation as the app, **publish new version** with a note, and the version history.
- **Ride Categories**: turn categories on or off per city and set their display order. A category is offered only when it
  is both enabled and priced.
- **Zone map editor**: on a city page, click **Draw a new zone**, click the corners on the map, name it, then create it.
  Existing zones are drawn on the map, and pasting GeoJSON still works.
- New permission `pricing.manage` (Super Admin, City Manager). Every change is audited.

### Seed data, clearly marked
- Ranchi offers all 5 categories with **sample fares labelled "Sample fare for development — replace before launch"**.
  They are not researched market rates; set real fares in Admin → Pricing. Tax is 0% until GST treatment is confirmed.
- The Ranchi service area is still the **approximate** development rectangle from Phase 1. Draw the real zones with the new editor.

### Tests
**68 automated tests pass** (13 shared + 55 API). New coverage:
- the fare engine maths, the IST night window and rounding, and polyline encoding (checked against Google's own test vector)
- Google request and response contracts, including errors
- the demo provider
- maps endpoints and service areas
- quotes, including fares matching the engine and out-of-area or too-short trips being refused
- saved and recent places
- admin pricing versions applying to new quotes, disabled categories disappearing, validation and permissions

I also drove the passenger flow in a browser (sign up, map home, search, options, fare breakdown, choose on map, set Home,
Home shortcut, permission screen) and the admin flow (edit fare with the simulator, publish, toggle categories, draw and
create a zone). Both passed with no errors.

## How to test
1. Start everything as in the README. Without a Google key you will see the demo-data banner. That is expected.
2. **Passenger**: open the app and allow location (or choose manual entry).
   - Search "station", "airport" or "morabadi".
   - Compare the 5 options and open **Fare details**.
   - Try **Choose on Map**, and try a pin outside Ranchi (refused).
   - Set **Home** and use the Home shortcut.
3. **Admin**: Pricing → Auto → change the per-km fare and watch the simulator → publish. Search the same trip in the app:
   the price changes. Ride Categories → untick Cab: Cab disappears from the app's options.
4. **Zones**: Cities → Ranchi → draw a real service area. Deactivate the approximate one only after the new one covers your
   pilot area, or bookings will be refused.
