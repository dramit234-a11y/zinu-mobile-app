# ZINU — Complete Mobile App Master Specification

> Permanent master plan for the project, as provided by the product owner.
> Formatting has been converted to Markdown; requirements are unchanged.
> **Note:** the received text ends partway through §60 (Background Location). Further sections, if any, are to be appended.

Build a production-ready, modern, scalable ZINU mobile application for both Android and iPhone (iOS).

## 1. Product Vision
- App Name: **ZINU**
- Tagline: **Your Driver. Your Way.**
- Core promise: **Affordable for passengers. Fairer for drivers.**

ZINU is a smart local mobility platform connecting passengers with nearby verified drivers. Initially launch in Ranchi, Jharkhand, India, but build the architecture so ZINU can later expand across India.

Support: Electric Toto / E-Rickshaw · Auto Rickshaw · Bike Taxi · Cab · Shared Ride · Scheduled Ride · Regular Ride.

The app must be designed as a real working application, not only a UI prototype. Create one shared backend supporting Android, iOS, Web Admin and future web applications.

## 2. App Structure
One ZINU mobile app with two main user modes:
- **Passenger** — I Need a Ride
- **Driver** — I Want to Drive

A user may eventually have both roles under the same mobile number. Allow switching roles from Profile if the account has both approved roles.

## 3. Splash Screen
Premium splash screen. Center: ZINU logo. Below: “ZINU” / “Your Driver. Your Way.” Small text: “Move smarter. Earn better.” Clean animated entrance.

Automatically check: Internet connectivity · App version · Authentication status · Existing session · User role. Then continue to onboarding or dashboard.

## 4. Onboarding
3–4 swipeable screens:
1. **Ride Your Way** — Book nearby Toto, Auto, Bike or Cab easily.
2. **Transparent Pricing** — Know your estimated fare before you book.
3. **Better for Drivers** — Drivers get more freedom over routes, working hours and earnings.
4. **Smarter Local Mobility** — Shared rides, preferred drivers, scheduled rides and smarter route matching.

Buttons: Skip · Next · Get Started.

## 5. Language
On first launch ask “Choose Your Language”: English · हिन्दी. Build architecture for adding regional languages later. Language can be changed anytime from Settings.

## 6. Login
Extremely simple. Enter Mobile Number → Continue → Send OTP. OTP screen: Enter 6-digit OTP · Verify · Resend OTP. Secure OTP authentication. After verification, new users complete profile; existing users go directly to their dashboard.

## 7. Account Type
“How would you like to use ZINU?” Large cards: **Book a Ride** · **Drive & Earn**. Allow eligible users to activate both roles later.

## 8. Passenger Profile
Collect: Full Name · Mobile Number · Email (optional) · Profile Photo (optional) · Preferred Language · Emergency Contact. Do not ask for unnecessary information.

## 9. Location Permission
Explain before requesting OS permission: “Allow location to find nearby ZINU drivers and calculate your trip.” Options: Allow Location · Enter Location Manually. Follow Android and iOS permission requirements. Do not continuously track passengers outside necessary ride functionality without appropriate permission and disclosure.

## 10. Passenger Home Screen
Premium map-based home. Top: Current Location · Profile icon · Notification icon. Main search box: “Where to?”. Map shows nearby available vehicle indicators where appropriate. Quick locations: Home · Work · Recent · Saved Places. Vehicle/service cards: Bike · Toto · Auto · Cab · Shared · Schedule.

Bottom navigation: Home | Trips | **Book** | Wallet | Profile — Book is the prominent central action.

## 11. Destination Search
Show: Pickup location · Destination · Recent searches · Saved locations · Search suggestions · Map selection · Current location. Pin selection: “Choose on Map”. Address autocomplete through configured map/location provider.

## 12. Ride Options
After destination selection calculate route. Category cards:
- Bike — Fast & economical
- Toto — Affordable electric local ride
- Auto — Convenient everyday travel
- Cab — Comfortable private ride
- Shared — Share and save

For every category show: Estimated pickup time · Estimated trip duration · Estimated fare · Passenger capacity. Do not show fake availability.

## 13. Fare Breakdown
Before booking show: Base Fare · Distance Charge · Time Charge (if applicable) · Platform Fee · Tax (if applicable) · Discount · Estimated Total. Button: **Confirm ZINU Ride**. All fare components configurable from Admin.

## 14. Driver Search
Animated screen: “Finding your ZINU driver…” with map. Search nearby eligible drivers by: Vehicle type · Distance · Availability · Service zone · Driver status · Route compatibility · Driver rating where appropriate · Dispatch rules. Expand search radius according to configurable backend rules if no driver accepts. Passenger may cancel search.

## 15. Driver Assigned
Show: Driver photo · Driver first name · Rating · Vehicle · Vehicle number · ETA · Live driver position. Buttons: Call · Chat · Share Trip · Safety · Cancel. Display ride verification OTP (e.g. “Your Ride OTP: 4821”). Do not start ride until OTP is verified.

## 16. Driver Arrival
Notification: “Your ZINU driver has arrived.” Show: Driver · Vehicle · Vehicle number · Pickup location · OTP. Allow: Call Driver · Chat · Safety.

## 17. Live Ride Screen
Show: Live map · Current route · Destination · Remaining distance · Estimated arrival time · Driver details · Vehicle details · Trip fare · Share Trip · SOS · Support. No unnecessary clutter while travelling.

## 18. Trip Completion
“You’ve arrived!” Display: Trip distance · Trip duration · Final fare · Payment method · Payment status. Then **Rate Your Ride** 1–5 stars. Feedback: Driving · Behaviour · Cleanliness · Safety · Navigation · Other. Optional comment.

## 19. Payment
Architecture for: UPI · Cash · ZINU Wallet · Credit/Debit Cards through approved gateway · Corporate account. Gateway securely integrated. Never store raw card credentials in the ZINU database.

## 20. ZINU Wallet
Balance · Add Money (where legally and technically supported) · Transaction History · Refunds · Offers · Ride Credits. Must follow applicable payment regulations and payment-provider requirements.

## 21. My Driver
After a successful ride passenger can tap **Save as My Driver**. Saved drivers appear under **My Drivers** with: Driver photo · Name · Vehicle · Rating · Trips completed with passenger. **Request This Driver**: if available and eligible nearby, offer the request to the preferred driver first. If unavailable: “Your preferred driver isn’t available right now. Find another nearby ZINU driver?”

## 22. Regular Rides
**REGULAR RIDE** — recurring transportation (Office, School, Hospital, Coaching, Daily commute). Options: Every Day · Weekdays · Selected Days · Custom. Set: Pickup · Destination · Time · Vehicle · Preferred Driver · Payment method. Easy pause or cancellation.

## 23. Schedule Ride
Select: Date · Time · Pickup · Destination · Vehicle type. Show fare estimate. Button: **Schedule Ride**. Send reminders before departure. Backend must manage scheduled dispatch reliably.

## 24. Family Ride
**BOOK FOR SOMEONE ELSE** — enter: Family member name · Mobile number · Pickup · Destination · Vehicle. Booking user can track the trip. Useful for parents, children, spouse, patients, family members. Provide trip-sharing and safety information appropriately.

## 25. Shared Ride
**ZINU SHARED** — passenger enters destination; show available shared routes with: Vehicle · Route · Pickup Point · Drop Point · Available Seats · Fare Per Seat · Expected Departure. Passenger selects number of seats → **Book Seat**. Update available seats in real time. Do not overbook vehicle capacity.

## 26. Driver Onboarding
“Drive with ZINU”. Collect: Full Name · Mobile Number · City · Address · Date of Birth (where legally necessary) · Vehicle Type · Vehicle Number · Driving Licence · Vehicle Registration / RC · Insurance · Pollution Certificate (where applicable) · Profile Photo · Vehicle Photos · Bank/UPI payout details · Emergency Contact. Documents support camera capture and secure upload.

## 27. Driver Verification
“Verification in Progress”. Statuses: Profile Submitted · Documents Under Review · Approved · Additional Information Required · Rejected · Suspended. Only approved drivers can go online and accept rides.

## 28. Driver Home
Top: Profile · Rating · Notifications. Large central switch: **GO ONLINE**. Offline: “You’re Offline”. Online: “You’re Online — Ready for Rides”. Show: Today’s Earnings · Today’s Trips · Online Time · Daily Goal · Acceptance statistics where permitted.

Bottom navigation: Home | Requests | Earnings | Trips | Profile.

## 29. New Ride Request
Large full-screen request card: Pickup distance · Pickup area · Destination area (where business rules permit) · Estimated trip distance · Estimated trip time · Estimated driver earning · Payment type · Countdown timer. Buttons: **ACCEPT** · **DECLINE**. Sound/vibration per user settings and OS rules. Never auto-accept without driver consent unless the driver explicitly enables a supported auto-accept option.

## 30. Driver Navigation
After acceptance: navigation to passenger. Display: Passenger first name · Pickup · Distance · ETA · Call · Chat · Navigate · Arrived. At pickup: **I’ve Arrived** → passenger notified.

## 31. Start Ride
Driver requests passenger OTP → enter Ride OTP → **Verify & Start Ride**. Only after valid verification: “Trip Started”; begin active trip tracking.

## 32. Driver Trip
Navigation to destination. Display: Destination · Remaining distance · ETA · Passenger · Trip ID · Fare · SOS · Support. At destination: **Complete Ride** with confirmation to prevent accidental completion.

## 33. Driver Earnings
After completion: Passenger Fare · ZINU Fee · Driver Earning · Tip (if supported) · Payment status · Driver Wallet/Balance. Earnings dashboard: Today · Yesterday · This Week · This Month · Custom Range, showing Trips · Gross Fare · ZINU Fees · Bonuses/Incentives · Net Earnings · Payouts.

## 34. Daily Earning Goal
**My Daily Goal** (e.g. ₹1,500). Progress: “₹950 / ₹1,500 — ₹550 remaining”. Do not guarantee earnings; encouraging but factual wording.

## 35. Earn My Way Home
Signature driver feature. “Where are you heading?” (e.g. Home — Harmu). Activate: “Find rides toward my destination”. Matching engine prioritises eligible requests travelling broadly toward the driver’s selected destination. Display: “Earn while heading home.” Do not guarantee a matching ride.

## 36. Find Return Ride
After a ride ending far from the driver’s preferred area: “Want a ride back toward your area?” → **Find Return Ride**. Prioritise compatible passengers travelling toward the driver’s preferred working/home zone. Goal: reduce empty kilometres.

## 37. Driver Preferred Area
Driver selects preferred work zones (initial Ranchi examples: Harmu, Morabadi, Kanke, Main Road, Airport, Railway Station, Doranda, Bariatu). Admin creates and modifies zones. Driver chooses: Preferred Areas · Preferred Route · Home Zone. Do not hard-code zones.

## 38. Driver Subscription
**ZINU DRIVER PLANS** — support both low-commission and subscription models. Example plans: Basic · Plus · Pro. Admin configures: Monthly Price · Commission % · Features · Priority rules · Ride limits · Benefits. Never hard-code plan pricing.

## 39. ZINU Vehicle Program
**DRIVE A ZINU VEHICLE** — drivers without a vehicle can apply. Categories: Electric Toto · Auto · Electric Car · Future vehicles. Show application status. Admin manages: Vehicle assignment · Rental · Deposit · Insurance · Maintenance · Charging · Battery · Documents · Payments · Driver assignment.

## 40. Driver-Owned Vehicle
Drivers with own vehicles register as **Independent ZINU Driver**. Ownership types: Driver Owned · ZINU Owned · Fleet/Partner Owned.

## 41. Driver Document Expiry
Track expiry for: Licence · Insurance · Registration · Pollution Certificate · Other permits. Notify before expiry. Admin can restrict online access if legally required documentation expires.

## 42. Safety Center
**ZINU SAFETY**, accessible during every active ride: SOS · Share Trip · Emergency Contact · Driver/Passenger Information · Ride Details · Report Safety Issue · Trip ID · Live Location during active trip.

## 43. SOS
Large red **SOS**. Confirmation mechanism to reduce accidental activation without making emergency access difficult. On activation capture: active location · Trip ID · Passenger · Driver · Vehicle · Timestamp; alert configured emergency/support systems. Provide emergency-service calling appropriate to country and OS. Do not falsely claim ZINU itself is an emergency service.

## 44. Trip Sharing
Share active trip status through supported channels. Shared page contains only necessary information. Trusted contact sees appropriate live trip information until completion. Sharing stops automatically after the ride ends.

## 45. Chat
In-app passenger–driver chat. Quick messages: “I’m here.” · “Coming in 2 minutes.” · “Please come to the gate.” · “I can’t find you.” · “Please call me.” Text messaging if enabled. Protect personal phone numbers wherever technically possible.

## 46. Calling
Passenger–driver calling through privacy-preserving communication integration when available. Avoid exposing personal numbers.

## 47. Notifications
Push for Android and iOS.
- Passenger: Ride accepted · Driver arriving · Driver arrived · Trip started · Trip completed · Payment · Scheduled ride reminder · Driver cancellation · Offers (where consented).
- Driver: New ride · Passenger cancellation · Payment · Payout · Scheduled ride · Document expiry · Subscription expiry · Support update.

## 48. Trip History
Passenger: Upcoming · Completed · Cancelled. Driver: Today · Completed · Cancelled · Scheduled. Trip details: Trip ID · Date · Time · Pickup · Destination · Driver/Passenger info · Vehicle · Fare · Payment · Rating · Support · Receipt.

## 49. Receipts
Digital receipt: ZINU · Trip ID · Date · Pickup · Destination · Distance · Fare components · Taxes · Payment · Driver · Vehicle. Download/Share Receipt.

## 50. Offers & Referrals
Configurable Promo Codes · Referral Codes · Ride Credits · Campaigns. Admin activates/deactivates, defines eligibility and limits. Prevent referral abuse.

## 51. Business / Corporate Rides
**ZINU BUSINESS** for hospitals, schools, offices, hotels, companies. Requests: Employee transport · Patient transport · Regular routes · Bulk rides · Monthly billing (where approved). Corporate administrators manage authorised users and ride policies.

## 52. Accessibility
Large touch targets · Readable typography · Screen-reader labels · Sufficient contrast · Logical focus order · Scalable text · Clear status indicators. Never communicate critical information using colour alone.

## 53. Passenger Profile Menu
Personal Details · Saved Places · My Drivers · Emergency Contacts · Wallet · Payment Methods · Offers · Notifications · Language · Safety · Help · Privacy · Terms · Logout · Delete Account.

## 54. Driver Profile Menu
Personal Details · Vehicle · Documents · Bank/Payout · Ratings · Preferred Areas · My Daily Goal · Subscription · ZINU Vehicle · Safety · Help · Language · Privacy · Terms · Logout · Delete Account.

## 55. Admin Platform
Separate secure responsive **ZINU Admin Web Dashboard** on the same backend. Modules: Dashboard · Live Trips · Passengers · Drivers · Driver Verification · Vehicles · ZINU Vehicles · Cities · Zones · Pricing · Ride Categories · Trips · Payments · Driver Payouts · Subscriptions · Shared Routes · Scheduled Rides · Complaints · Support · SOS Incidents · Promotions · Corporate Accounts · Notifications · Reports · Staff · Permissions · Settings · Audit Logs.

## 56. Live Operations
Show: Drivers Online · Active Rides · Pending Requests · Scheduled Rides · SOS Incidents · Cancelled Rides · Current demand · Available drivers. Live operational map where technically permitted.

## 57. Multi-City Architecture
Initial city Ranchi, multi-city from day one. Admin can add per city: City · Service Zone · Vehicle Categories · Pricing · Shared Routes · Driver Plans · Operating Hours · Service Availability. Each city can have different settings.

## 58. Initial Ranchi Pilot
Pilot approx.: 10 ZINU-operated/leased electric autos · 40–50 independent drivers · selected Ranchi zones. Then scale to 100 → 1,000 → 10,000+ drivers and multiple cities. Do not build architecture limited to pilot numbers.

## 59. Maps
Mapping platform for Android and iOS supporting: Current Location · Address Search · Autocomplete · Route · Distance · ETA · Navigation · Geocoding · Reverse Geocoding · Driver Tracking · Geofencing/service zones. Keep the map provider behind a service layer so the platform is not locked into one provider.

## 60. Background Location
Driver app functionality requires location while online and during trips.

*(Specification text received ends here.)*
