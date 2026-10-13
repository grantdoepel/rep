# Shipping uvu to the App Store

The iOS app is a native shell (Capacitor 8) around the live web app at `https://rep-xi-five.vercel.app`.
Every Vercel deploy reaches the phone without a new App Store build. You only rebuild in Xcode when
native pieces change: plugins, permissions, the icon, or the app version.

Native features in the shell: Apple Health (workouts and weight, read-only), camera (meal photos),
push notifications, haptics.

## One-time setup (about an hour)

1. **Mac tools.** Install Xcode from the Mac App Store, open it once to finish setup, then in Terminal:
   `xcode-select --install`. Install Node 20+ (`brew install node`).
2. **Get the code.**
   ```bash
   git clone https://github.com/grantdoepel/rep && cd rep && npm ci
   npm run ios          # syncs the native project and opens it in Xcode
   ```
3. **Register the app ID.** In [developer.apple.com](https://developer.apple.com/account) → Certificates,
   IDs & Profiles → Identifiers → +, App ID, bundle ID `app.uvu.ios`. Turn on **HealthKit**,
   **Push Notifications** and **Sign in with Apple**.
4. **Sign the project.** In Xcode select the `App` target → Signing & Capabilities: tick
   *Automatically manage signing*, pick your team. The HealthKit, Push and Sign in with Apple
   capabilities are already declared in `App/App.entitlements`; Xcode shows them once a team is set.
5. **Create the app record.** In [App Store Connect](https://appstoreconnect.apple.com) → Apps → +:
   name **uvu**, bundle ID `app.uvu.ios`, SKU `uvu-ios`.

## Test on your phone

Plug in your iPhone, choose it as the run destination in Xcode, press Run. First run: on the phone,
Settings → General → VPN & Device Management → trust your developer certificate.

Check: sign-in works, Fuel → Snap a meal opens the camera, Settings → Apple Health asks for access.

To point a dev build at a preview deploy or your laptop:
`UVU_APP_URL=http://192.168.1.20:3000 npx cap sync ios`, then Run. Sync again without it before archiving.

## Submit a build

1. In Xcode: bump the version (target → General → Version, e.g. 1.0.0; Build 1, 2, 3…).
2. Choose **Any iOS Device (arm64)** → Product → **Archive** → Distribute App → App Store Connect → Upload.
3. In App Store Connect the build appears under TestFlight in ~15 minutes. Add yourself as an internal
   tester and install it from the TestFlight app before submitting.
4. Fill in the listing: screenshots (6.9" and 6.5" iPhone), description, keywords, support URL,
   **privacy policy URL** (required), age rating, and App Privacy answers (below). Submit for review.

### App Privacy answers
- Health & Fitness: workouts and weight, read from Apple Health, linked to the user, used for app functionality. Not used for tracking or ads.
- Photos: meal photos are sent for analysis and **not stored**; only the estimated totals are kept.
- Contact info: email (sign-in). Identifiers: user ID. Usage data: product interaction (analytics).

### Review notes (paste into "Notes for Review")
> uvu is a daily movement habit app with a fasting and meal planner. Apple Health is read-only:
> workouts of 20+ minutes keep the user's streak, and weight feeds the fasting plan's weekly check-in.
> The camera is used only when the user taps "Snap a meal". Demo account: [ADD A TEST LOGIN].

Apple rejects apps that are "just a website", so keep the native features visible in the build you
submit: Health connection in Settings, the camera flow in Fuel, and push reminders.

## Before the first submission
- [ ] A privacy policy page (can be a page in this app, e.g. `/privacy`)
- [ ] A demo account for the reviewer
- [ ] Push: create an APNs key (developer portal → Keys), and switch `aps-environment` to `production`
      in `App/App.entitlements` for the release build
- [ ] Supabase Auth → URL configuration: add `uvu://` and the production URL to the redirect allow-list
- [ ] Optional: a custom domain (e.g. `app.uvu.fit`). Update `capacitor.config.ts` and `allowNavigation` if you add one.
