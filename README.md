# AniMarket mobile app

Expo SDK 57 and Expo Router power the Android, iOS, and web app.

## Architecture

```text
src/app/                                  Expo Router routes, URL adapters, dependency wiring
src/features/onboarding/presentation/     Splash UI
src/features/auth/domain/                 Pure form validation
src/features/auth/presentation/           Login and registration UI
src/features/marketplace/domain/          Listing model, filtering rules, repository contract
src/features/marketplace/application/     Marketplace operations using the repository contract
src/features/marketplace/data/            In-memory catalog and repository implementation
src/features/marketplace/presentation/    Screens, image mapping, URL parameter conversion
src/components/, src/hooks/, src/constants/ Shared UI and design helpers
assets/images/                             Bundled images
```

Dependencies point inward: presentation uses application operations, application depends on domain contracts, and data implements those contracts. `marketplace_dependencies.ts` connects the current in-memory repository to the marketplace service. Routes own navigation and URL parameters; screens receive callbacks and typed data. A different synchronous catalog can implement `ListingRepository` without changing filtering or screens. A remote API will also need asynchronous loading and error states.

`npm run check:architecture` checks feature import direction and keeps Expo Router navigation in route adapters.

Routes are small adapters. `/` opens the interactive splash screen; `/login` and `/register` display the auth forms; `/home`, `/search_filter`, and `/listings/id?id=simmental-cow` display marketplace screens. `src/app/search_filter/index.tsx` and `src/app/listings/id.tsx` use ordinary filenames. `src/app/_layout.tsx` configures the root Stack and hides its headers.

The order flow opens `/order_checkout?id=<listing-id>`, then `/order_review?id=<listing-id>` after validation, and `/order_placed?orderId=<order-id>` when the request is saved. Confirmation opens the selected `/order_status?orderId=<order-id>` or `/my_orders`. My Orders is also available from Profile, with a live order count, search, and All/Active/Cancelled filters. Each request opens its own status page, and cancellations update the history immediately. Completing checkout clears its navigation history so native back returns to My Orders instead of submitting another request. Review uses the saved pickup or delivery details, payment arrangement, listing records, and estimated totals. Edit actions return to checkout with the form preserved. Opening `/order_review` or `/order_status` directly shows a labeled example; examples do not appear in My Orders. Missing order IDs show a recovery page. Status displays the original request, the pickup or delivery timeline, document readiness, seller contact controls, and a cancellation confirmation. Requests and cancellation history remain available in the running session even when checkout is edited; seller notifications, server persistence, and payment processing are not connected. Local requests are labeled as saved locally. The review agreement is required, outdated details must be corrected, and repeated saves return the same request.

Main navigation reuses its destination instead of adding duplicate pages. Detail pages have safe back destinations when opened directly. Notification actions open their matching conversation, order, or draft; unavailable sample orders lead to My Orders. Seller chat opens a local conversation for that listing, starting empty when there is no existing conversation. Login and logout clear the previous navigation stack.

App-owned source files, folders, and image basenames use snake_case. Expo Router's required `_layout.tsx` convention, platform and image scale suffixes such as `.web.tsx` and `@2x`, Expo's generated `expo-env.d.ts`, and tool-defined files such as `package.json` keep their required names.

## Run and check

```bash
npm install
npx expo start
npx expo lint
npx tsc --noEmit
npm run check:architecture
npm run check:orders
npm run check:navigation
npm run check:location
```

The catalog is sample data. Login currently validates required fields and opens the marketplace; registration validates locally. Neither form is connected to an authentication service yet.

## Location selection and maps

Listings and delivery checkout use the same location picker: search a street, barangay, city or landmark; use foreground GPS; tap or move the map under the fixed pin; then confirm. Cancelling keeps the previous selection. Nearby address fields fill when available, and the user completes house/purok, barangay and landmark details. A reverse-geocoding failure leaves manual pin selection available. City/province changes require a matching confirmed pin. Delivery checkout validates the point and carries it unchanged to review and status, including cancelled requests. Published listing pickup coordinates are stored outside the public catalog and become available on the placed order. Sample listings without coordinates show an honest missing-pin message.

Native maps use the installed `react-native-maps` library (Apple Maps on iOS, Google Maps on Android); web maps use MapLibre and OpenFreeMap. Address search and reverse lookup use the [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md). Search is explicit, reverse lookup is debounced and cached, requests time out and obsolete selections are discarded. The public Photon demo supports moderate development use without an availability guarantee. For production volume, set `EXPO_PUBLIC_GEOCODER_URL` to a hosted Photon-compatible endpoint with appropriate web CORS. Search text and selected coordinates are sent to that provider. Receiver names, phones, landmarks and transport notes are not included in geocoder requests. The provider base URL is public app configuration; do not put a secret key there.

Expo Go already includes native map setup. For a standalone Android build, copy `.env.example` to `.env.local`, set `GOOGLE_MAPS_ANDROID_API_KEY`, and configure the same variable in the EAS build environment. Enable Maps SDK for Android and restrict the key to the app's Android package and signing SHA-1. [Expo SDK 57 map setup](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/) describes the configuration. `app.config.ts` injects the key through the map plugin and refuses an EAS Android build without it. No key is committed. Rebuild the native app after changing native configuration. Browser GPS requires HTTPS (localhost also works); location permission is requested only when the user taps Use my current location. Background tracking is not used.

This app still uses session-based listing and order repositories. Production storage must persist both address and coordinates, and authorize access to exact seller pickup coordinates on the server. Location selection is connected to real GPS, map tiles and geocoding; it does not add seller notifications, transport dispatch or server persistence.

`npm run check:location -- --live` additionally checks the configured geocoder against a public Tagum search and reverse lookup, including web CORS. Device GPS permissions, real map gestures and Android key restrictions still need device testing.
