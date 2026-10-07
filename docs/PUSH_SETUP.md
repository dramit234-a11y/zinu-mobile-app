# Push notifications setup (Expo Push → FCM + APNs)

Every notification is always stored in the user's **in-app inbox** (bell icon), so ZINU works without push.
Push delivery to the phone's lock screen needs the steps below. Until then the API uses `PUSH_PROVIDER=console`
(logs pushes instead of sending).

ZINU sends push through **Expo Push Service**, which forwards to Firebase Cloud Messaging (Android) and Apple Push
Notification service (iOS). The provider sits behind an interface (`apps/api/src/notifications/push.provider.ts`), so
direct FCM/APNs can replace it later without touching the rest of the system.

## 1. Expo account and EAS project (free) — you
1. Create an account at expo.dev (an organisation account such as "zinu" is recommended).
2. Tell me the account/organisation name. I will run `eas init` in `apps/mobile`, which writes the project ID into
   `app.json` (`extra.eas.projectId`). The app only registers for push once this exists.

## 2. Android: Firebase project (free) — you
1. Create a Firebase project (console.firebase.google.com), e.g. "ZINU".
2. Add an Android app with package name **`in.zinu.app`** and download `google-services.json` (give it to me; it is not secret but belongs in the build config).
3. In Project settings → Service accounts, generate a private key (JSON). **This is a secret**: upload it yourself
   to Expo (expo.dev → project → Credentials → Android → FCM V1 service account key). Do not send it over chat.

## 3. iOS: Apple Push key — you (needs the Apple Developer account)
1. Apple Developer → Certificates, IDs & Profiles → Keys → create a key with **Apple Push Notifications service**.
2. Upload it to Expo when running `eas credentials` (or let `eas build` create it).

## 4. Switch the API (with me)
```
PUSH_PROVIDER=expo
EXPO_ACCESS_TOKEN=   # only if you enable "enhanced push security" on the Expo project
```

## Testing on a phone
Remote push does **not** work in Expo Go on Android (an Expo platform limitation since SDK 53). Push testing needs a
**development build**: `npx eas-cli build --profile development --platform android`, installed on your phone.
Everything else in Phase 2 (registration, camera, uploads, inbox) works in Expo Go.
