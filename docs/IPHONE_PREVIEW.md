# Preview ZINU on your iPhone (no installs on your Mac)

Everything runs in **GitHub Codespaces**, a computer in the cloud that opens in your web browser.
Your Mac only needs a browser. Your iPhone only needs the free **Expo Go** app.

```
 iPhone (Expo Go) ──https──▶ GitHub Codespace (cloud computer)
                              ├─ Expo dev server  (sends the app's code to the phone)
                              ├─ ZINU API :4000   (the backend)
                              ├─ Worker           (background jobs)
                              └─ Docker: PostgreSQL + PostGIS, Redis, file storage (RustFS)
```

Development settings only. Nothing here is published to the App Store or Play Store.

| What | In this preview |
|---|---|
| Login OTP | **Not sent by SMS.** Shown on the OTP screen as "Development OTP". |
| Maps, search, routes | **DEMONSTRATION data** for Ranchi, with a yellow banner in the app. No Google key is used. |
| Database | Fresh, empty test database inside the Codespace. It is deleted with the Codespace. |
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
4. makes the API reachable from your phone
5. starts Expo and shows a **QR code**

If a box asks to allow **ngrok** or to install a package, type `y` and press Enter.

## Step 4: Open the app on your iPhone

1. Open the iPhone **Camera** and point it at the QR code in the terminal.
2. Tap the **Open in Expo Go** banner.
3. The first load takes about 1 minute while the app is sent to your phone.

If the QR code is too small, use the browser's zoom (⌘ +) or drag the terminal panel taller.

## Step 5: What to test

| Screen | How to get there | What to check |
|---|---|---|
| **Splash** | Opens automatically | ZINU logo, then it moves on. Shake the phone → **Reload** to see it again. |
| **Language and intro** | First launch | Choose English or हिन्दी. Swipe through the intro. |
| **Login** | Enter any 10-digit Indian mobile number, e.g. `9876543210` | The OTP screen shows **"Development OTP: 123456"**. Type that code. |
| **Passenger dashboard** | Choose **Passenger** and fill in your name | The home map of Ranchi has a yellow **demonstration data** banner. |
| **Map and search** | Tap **Where to?** | Try search suggestions, **Choose on map**, and the route with fares for Bike/Toto/Auto/Cab/Shared. All of it is demo data. |
| **Location** | First time on the map | iPhone asks for location permission. Allow it, or skip it and the map still works. |
| **Driver dashboard** | Profile → **Drive with ZINU** (or log in with a new number and choose Driver) | Driver home, verification status, the registration steps and camera capture for documents. |

To reload after changes: shake the phone and tap **Reload**.

## Step 6: Stop when you're done (saves your free hours)

In the terminal press **Ctrl + C**. Then go to **https://github.com/codespaces**, click **⋯** next to your Codespace and choose **Stop codespace**.
GitHub also stops an idle Codespace after 30 minutes.

Next time, open https://github.com/codespaces, click your Codespace, and run `pnpm phone` again. Step 1 doesn't need repeating.

---

## If something goes wrong

| Problem | Fix |
|---|---|
| `tunnel took too long to connect` / ngrok error | Press **Ctrl + C**, then run `pnpm phone proxy`. This mode uses the Codespace's own address instead of a tunnel. |
| App says **"Can't reach ZINU"** | Open the **PORTS** tab (next to TERMINAL). Right-click port **4000**, choose **Port Visibility**, then **Public**. Do the same for **9000**, and for **8081** if you use proxy mode. Then shake the phone and tap **Reload**. |
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

## Getting changes made by Claude

Claude pushes to the same branch. To get the newest version, run this in the Codespace terminal:

```
git pull && pnpm install
```

Then run `pnpm phone` again.
