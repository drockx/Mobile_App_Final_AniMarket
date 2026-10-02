# App build readiness

Checked 2 October 2026 with Expo SDK 57.

The app passes the checks below and can proceed to a development build. It is not yet ready for a public production release: the cloud feature rollout is staged, and native voice calls have not been tested on physical devices.

## Completed polish

- Unified readable form typography, navigation icons, and touch targets. Narrow marketplace screens use one listing column; calculator fields stack so complete values remain visible.
- Added livestock image fallbacks, themed route/error recovery, and account error recovery after the navigator mounts.
- Fixed the web crash when a focused input called a native-only keyboard API. Kept keyboard scrolling and the visible listing description field.
- Guarded authentication against duplicate submissions and invalid search price ranges. Seller information opens in a scrollable dialog across platforms.
- Configured AniMarket branding, a light appearance, keyboard resizing, development/preview APKs, and production Android App Bundles.
- Added `npm run check:app` and an EAS ignore file that excludes server data, local secrets, and backend deployment files from the mobile build archive.
- Removed the stale, empty Git index lock after confirming no Git process was active. No files or commits were removed.

## Verification

| Check | Result |
| --- | --- |
| `npm run check:app` | All 14 checks passed, including lint, TypeScript, architecture, and 127 tests. |
| Browser smoke test | Sign-in, filter validation/reset, account and marketplace routes, two-way live messages, and missing-route recovery passed. 18 captures across 320, 360, 430, and 768 px widths; no page runtime errors or document width overflow. |
| `npx expo export --platform all --output-dir dist/build-check` | Android and iOS Hermes bundles and web static output exported successfully. |
| `npx expo install --check` | Installed Expo package versions are compatible. |
| Expo Doctor | 20 of 21 checks passed. React Native Directory reports `react-native-incall-manager` and `react-native-webrtc` as untested on the New Architecture. |
| Git whitespace / lock | Diff check passed; index lock absent. |

The browser used a separate, temporary in-memory backend and disposable test accounts. It did not change Firebase, Supabase, billing, or real user data. Native call tests mock the audio modules; passing them does not verify microphone/audio behavior on a phone. JavaScript export does not compile or sign an APK, AAB, or IPA.

## Remaining before release

1. Finish the persistent Firebase listing/order repositories, messaging and call signaling, and their access rules. The running app still uses `EXPO_PUBLIC_BACKEND=local`; marketplace records and orders are session-only. Production disables sample catalog data. See [backend connection status](backend_connection.md).
2. Supply Cloudinary API credentials only through Supabase secrets, then finish signed public photo uploads and private ID submission/review/cleanup endpoints. Migrate existing accounts deliberately before switching the app backend.
3. Configure the actual release backend and public environment values in EAS. A phone release cannot use the temporary browser test server or a development computer's loopback address. Keep Firebase on Spark and Supabase/Cloudinary on their free plans.
4. Build an Android development client and test installation, login, keyboard visibility, camera/photos, GPS pins, offline recovery, and two-account messaging/calls on physical devices. Test calls across separate networks and configure/test TURN if direct audio connections fail. The app's custom voice modules require a development build.
5. Link the intended Expo/EAS project and signing credentials. An iOS build also needs the intended bundle identifier. No cloud native build or app-store submission was performed during this audit.

Run the local checks again after any backend or native configuration changes:

```powershell
npm run check:app
npx expo-doctor
npx expo export --platform all --output-dir dist/build-check
```

Once the Expo project and development environment are configured, the Android device test build command is:

```powershell
npx eas-cli@latest build --platform android --profile development
```
