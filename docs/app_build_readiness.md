# App build readiness

Updated 2 October 2026, Expo SDK 57. The project is configured for an Android APK build with its deployed backend. The user will start the build when ready. The preparatory cloud builds were cancelled; no completed native-build or physical-device result is claimed.

## Prepared

- Expo/EAS owner: `drokcx`. Project: `68c6337e-1568-4ecc-9129-831cef15e79c`.
- Android identifier: `com.example.animarket_final`, version `1.0.0`, version code `1`.
- Android signing keystore is managed by EAS. Private signing material was not downloaded or committed.
- `eas.json` includes an `apk` profile with internal distribution and `android.buildType=apk`. It includes only public Firebase/Supabase/Cloudinary configuration and selects the Firebase backend. Production builds use AAB.
- Default listings are disabled. Live accounts, verification, photos, listings, orders, messages and foreground call signaling are connected. See [backend connection](backend_connection.md).
- [The account verification portal](https://animarket-87354-admin.web.app) is deployed separately and excluded from the APK. Its private login is saved in ignored `admin-login.local.txt`.
- Mobile typography, icons, touch targets, narrow layouts, keyboard visibility, navigation/error recovery and duplicate-submit protection were polished. Screens handle loading, empty data, failures and account switching.
- Secrets, local server data, generated native folders, build output and backend/admin deployment code are excluded from the EAS archive. Firebase remains Spark with billing disabled.

## Checked

The final `npm run check:app` passed all 15 checks, including lint, TypeScript, architecture and nine cloud workflow checks. Firebase emulator rules/account flows and deployed cloud workflows passed. The portal's real login and restricted scope passed, and its login layout fits a 320 px viewport without horizontal overflow. Android/iOS Hermes and web exports succeeded. The Firebase-enabled Android Hermes export succeeded in `dist/firebase-ready`; Expo's package compatibility check reports all dependencies up to date. Native config introspection resolved the Android manifest and intended EAS project without generating native directories or building an APK.

Expo Doctor passed 20 of 21 checks. Its existing warning concerns `react-native-webrtc` and `react-native-incall-manager`: React Native Directory lists them as untested on the New Architecture. Bundling and mocked call tests do not establish actual Android audio compatibility. Dependency audit also reports advisories in inherited tooling/transitive packages; no forced SDK downgrade was performed.

## Build when ready

```powershell
npm run check:app
npx eas-cli@latest build --platform android --profile apk
```

This submits a signed installable APK to EAS. Keep the EAS project and managed signing credentials; future Android updates need the same package and signing key. A Play Store release normally uses the `production` AAB profile.

## Before a public release

Install a build on physical Android devices and verify registration/login persistence, private ID submission and review, profile/livestock photos, GPS/address pins, keyboard behavior, buyer/seller orders, reconnection and two-account messages. Test microphone, speaker, incoming calls and hangup on two phones across different networks. TURN and background call notifications still need a separate decision/setup if those capabilities are required. No billing upgrade is needed for the prepared Firebase setup.

A successful JavaScript export is not a signed APK or a guarantee of error-free behavior. The native build and device acceptance checks remain the next verification steps when the user chooses to build.
