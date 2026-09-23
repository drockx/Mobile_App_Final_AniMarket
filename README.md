# AniMarket mobile app

Expo SDK 57 and Expo Router power the Android, iOS, and web app.

## Project structure

```text
assets/images/branding/         Splash background and AniMarket logo
assets/images/auth/             Login and registration background
src/app/                        Expo Router entry points and navigation layout
src/features/onboarding/presentation/
                                Splash screen UI
src/features/auth/presentation/  Login, registration, and shared form UI
src/features/auth/domain/        Form validation
src/components/                 Shared UI
src/hooks/                      Shared hooks
src/constants/                  Shared design values
```

Route files stay small. The `/` route renders `SplashScreen` and supplies its `onContinue` action, which navigates to `/login`. The `/login` route renders `LoginScreen`, and Signup opens `/register`. As features grow, add UI in `presentation`, business operations in `domain`, and API or storage code in `data` under the same feature. Keep images in `assets/` so screens and native configuration can use them.

The launch screen configured in `app.json` displays the AniMarket logo before React Native loads. The interactive splash page is `src/features/onboarding/presentation/SplashScreen.tsx`.

## Run and check

```bash
npm install
npx expo start
npx expo lint
npx tsc --noEmit
```

Login and registration validate input locally. Authentication and account creation need a future data service before the forms can submit real credentials.
