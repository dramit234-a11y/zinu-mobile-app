# Preview ZINU on your iPhone (no installs on your Mac)

Everything runs in **GitHub Codespaces**, a computer in the cloud that opens in your web browser.
Your Mac only needs a browser. Your iPhone only needs the free **Expo Go** app.

```
 iPhone (Expo Go)
     │  https://<random-words>.trycloudflare.com   (temporary, closes when you press Ctrl+C)
     ▼
 GitHub Codespace (cloud computer)
   cloudflared ─▶ preview gateway (passes only what the app needs)
                    ├─ Expo dev server :8081  (sends the app's code to the phone)
                    ├─ ZINU API :4000         (app routes only; /v1/admin is refused)
                    └─ file storage :9000     (signed uploads/downloads only)
   private, never reachable from outside: PostgreSQL + PostGIS, Redis, worker, admin API
```

Development settings only. Nothing here is published to the App Store or Play Store.

| What | In this preview |
|---|---|
| Login OTP | **Not sent by SMS** and not sent to the phone. It appears in the **Codespace terminal** as "🔑 Login code". |
| Maps, search, routes | **DEMONSTRATION data** for Ranchi, with a yellow banner in the app. No Google key is used. |
| Database | Fresh, empty test database inside the Codespace. It is deleted with the Codespace. |
| Public address | A free **Cloudflare quick tunnel** (no account, no key). Temporary and for testing only. |
| Cost | Free within GitHub's monthly Codespaces allowance (personal accounts: 120 core-hours, about 30 hours on the 4-core machine). |

---

## Step 1: Create the Codespace (once)

1. On your Mac, open **https://github.com/dramit234-a11y/zinu-mobile-app** and sign in.
2. Click the green **Code** button, then the **Codespaces** tab.
3. Click **⋯** (three dots), then **New with options…**.
4. Choose:
   - **Branch:** `claude/zinu-mobile-architecture-h6llla`
   - **Machine type:** **4-core**
   - Leave everything else as it is.
5. Click **Create codespace**.

A VS Code editor opens in your browser. The first setup takes about **5–10 minutes**.
It is finished when the terminal at the bottom says:

```
ZINU is installed. To preview on your iPhone, run:  pnpm phone
```

## Step 2: Install Expo Go on your iPhone

From the App Store, install **Expo Go** (by Expo). You don't need to create an account.

## Step 3: Start ZINU

In the Codespace terminal, type the following and press Enter:

```
pnpm phone
```

This command:

1. starts the database, Redis and file storage (the first time takes 2–4 minutes)
2. creates the database tables and sample data (Ranchi, ride categories, fares)
3. starts the API and the worker
4. opens a temporary public address (`https://…trycloudflare.com`) and checks it from the internet side
5. starts Expo and, once the app is reachable, shows a **QR code**

Wait for the line **"ZINU is ready for your iPhone"**. If a ✗ line appears instead, press Ctrl + C and run `pnpm phone` again.

## Step 4: Open the app on your iPhone

1. **Check the address first.** On the iPhone, open **Safari** and go to the `…/status` address printed in the terminal.
   It must show `packager-status:running`. If it does, your phone can reach the Codespace.
2. Open the iPhone **Camera** and point it at the QR code in the terminal. Tap **Open in Expo Go**.
   Or, in Expo Go, tap **Enter URL manually** and type the `exps://…` address printed in the terminal.
3. The first load takes about 1 minute while the app is sent to your phone.

If the QR code is too small, use the browser's zoom (⌘ +) or drag the terminal panel taller.

## Step 5: What to test

| Screen | How to get there | What to check |
|---|---|---|
| **Splash** | Opens automatically | ZINU logo, then it moves on. Shake the phone → **Reload** to see it again. |
| **Language and intro** | First launch | Choose English or हिन्दी. Swipe through the intro. |
| **Login** | Enter any 10-digit Indian mobile number, e.g. `9876543210` | Look at the Codespace terminal: it shows **"🔑 Login code — OTP for +91…: 123456"**. Type that code. |
| **Passenger dashboard** | Choose **Passenger** and fill in your name | The home map of Ranchi has a yellow **demonstration data** banner. |
| **Map and search** | Tap **Where to?** | Try search suggestions, **Choose on map**, and the route with fares for Bike/Toto/Auto/Cab/Shared. All of it is demo data. |
| **Location** | First time on the map | iPhone asks for location permission. Allow it, or skip it and the map still works. |
| **Driver dashboard** | Profile → **Drive with ZINU** (or log in with a new number and choose Driver) | Driver home, verification status, the registration steps and camera capture for documents. |

To reload after changes: shake the phone and tap **Reload**.

## Step 6: Stop when you're done (saves your free hours)

In the terminal press **Ctrl + C**. This closes the public address. Then go to **https://github.com/codespaces**, click **⋯** next to your Codespace and choose **Stop codespace**.
GitHub also stops an idle Codespace after 30 minutes.

Next time, open https://github.com/codespaces, click your Codespace, and run `pnpm phone` again. Step 1 doesn't need repeating.

---

## If something goes wrong

| Problem | Fix |
|---|---|
| Safari on the iPhone says **"server cannot be found"** for the `…/status` address | Your Wi-Fi's DNS is not resolving the address. Turn Wi-Fi off and use mobile data, **or** iPhone Settings → Wi-Fi → (i) next to your network → Configure DNS → Manual → add `1.1.1.1`. Then try again. |
| ✗ `Cloudflare did not give a tunnel address` | Press **Ctrl + C** and run `pnpm phone` again (each run gets a new address and a new QR code). |
| App says **"Can't reach ZINU"** | The address changes every time `pnpm phone` starts. Scan the **new** QR code. |
| An old `*.app.github.dev` address won't open | That was the previous method. Run `pnpm phone:diagnose` to see whether GitHub or your network's DNS is the cause. You don't need it any more. |
| `Docker is not running` | Press F1, type **Codespaces: Rebuild Container**, and press Enter. Then run `pnpm phone` again. |
| Expo Go says the project needs a newer/older SDK | Update Expo Go from the App Store. |
| Anything else | Copy the last 20 lines of the terminal, or of `/tmp/zinu/api.log`, and send them to Claude. |

## Optional: Admin dashboard in the browser

In a **second** terminal (click **+** in the terminal panel):

```
pnpm --filter @zinu/api staff:create --email you@example.com --name "Your Name"
pnpm dev:admin
```

The first command prints a password and a TOTP secret. Add the secret to an authenticator app such as Google Authenticator.
When **port 3001** pops up, open it to sign in. From there you can approve the driver you registered on the phone.

## Why a Cloudflare tunnel

- **Expo's built-in tunnel (`--tunnel`)** uses Expo's shared ngrok service. It failed with "remote gone away" / "session closed", which is outside your project and outside the Codespace.
- **Codespaces forwarded ports (`*.app.github.dev`)** didn't resolve on your network (DNS_PROBE_FINISHED_NXDOMAIN in Chrome, "hostname could not be found" in Expo Go). They also needed ports 4000 and 9000 made fully public.
  Expo also wrote that address as `exp://…:443`, which makes Expo Go speak plain http to an https port.
- **`pnpm phone`** uses one Cloudflare quick tunnel to a small gateway (`scripts/codespace/gateway.mjs`). It passes only the app's API routes, signed storage requests and the Expo bundler. It prints an `exps://` (https) QR code, and the script checks it from the internet side before showing the QR code.

## Getting changes made by Claude

Claude pushes to the same branch. To get the newest version, run this in the Codespace terminal:

```
git pull && pnpm install
```

Then run `pnpm phone` again.
