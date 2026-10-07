# OTP SMS setup (MSG91 + TRAI DLT)

Development works without any SMS provider: the API runs with `OTP_PROVIDER=console`, prints each code in its log
and (only in development) returns it to the app, which shows it as “Development OTP”.

Before real users can log in, SMS must be delivered by a provider. India requires every business that sends
SMS to be registered on a **DLT (Distributed Ledger Technology) platform** under TRAI's TCCCPR regulations.
Unregistered messages are blocked by the mobile networks.

## 1. Register ZINU on a DLT portal (you)

Use one operator's portal (any one is enough, registrations are shared across networks), for example
Jio TrueConnect, Airtel DLT, Vodafone Idea (Vi) DLT or BSNL DLT.

1. **Principal Entity registration.** You will typically need the business PAN, GST certificate (or other proof
   of business), the authorised signatory's ID and a Letter of Authorisation. The portal charges a fee, which
   varies by portal. Approval usually takes a few working days.
2. **Header (Sender ID).** Register a 6-letter header for service messages, e.g. `ZINUIN`.
3. **Content template.** Register an OTP template in the *Service Implicit* category, for example:

   ```
   {#var#} is your ZINU verification code. It is valid for 5 minutes. Do not share it with anyone. - ZINU
   ```
4. Note the **Entity ID**, **Header** and **Template ID** the portal gives you.

## 2. Configure MSG91 (you)

1. Create an account at msg91.com and complete their KYC.
2. Add your DLT Entity ID and Header in MSG91.
3. Create an **OTP template** in MSG91 using the DLT template text, with MSG91's OTP variable (`##OTP##`) in place
   of `{#var#}`, and link it to the DLT Template ID.
4. Copy the MSG91 **Auth Key** and the MSG91 **OTP template ID**.

## 3. Switch the API to MSG91 (with me)

Set these in the API's environment (production: AWS Secrets Manager, never in the mobile app):

```
OTP_PROVIDER=msg91
MSG91_AUTH_KEY=<auth key>
MSG91_OTP_TEMPLATE_ID=<MSG91 OTP template id>
OTP_DEV_ECHO=false
```

The API generates the 6-digit code itself, stores only a salted hash of it, and asks MSG91 to deliver it
(MSG91 v5 OTP API). Expiry (5 min), attempt limits (5), resend cooldown (30 s) and rate limits are enforced by
ZINU, not by the provider, so switching providers later (e.g. Twilio, Gupshup) only needs a new `OtpSender`.

> The MSG91 sender is implemented against MSG91's documented v5 OTP endpoint but has not yet been exercised with
> a live account. When your account is ready we will test it with your own number before launch.

## Optional: automatic OTP reading on Android

The OTP field already supports the platform's one-time-code autofill on iOS and Android. Fully automatic reading
with Android's SMS Retriever API needs an 11-character app hash appended to the template; we can add that once the
production signing key exists (Phase 7).
