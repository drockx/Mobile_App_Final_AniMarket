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

The catalog and orders still use sample/session data. Accounts and text messaging use the included shared server and persistent SQLite database. Registration creates a real account; login checks its email and password. Message history, unread counts and read receipts are shared between authenticated users.

## Accounts and live messaging

Use Node.js 24 LTS or newer. After `npm install`, run `npm run server` in one terminal and `npm start` in another. The server prints its local and LAN addresses and saves private data under `server/data/` (ignored by Git). Keep that directory on persistent storage and back it up when hosting.

In development, the app automatically connects to its Expo LAN host on port 3001. For a phone, connect the phone and PC to the same Wi-Fi. If using an Expo tunnel, emulator, another server host, or a release build, set `EXPO_PUBLIC_API_URL` in `.env.local` to an address reachable from the device, then restart Expo. For example, use `http://YOUR-PC-LAN-IP:3001` for local phone testing, or your hosted server's HTTPS URL for release builds. `localhost` on a physical phone means the phone itself. Windows Firewall must allow the Node server on your private network.

Create two accounts on two devices or separate browser profiles/private windows. Open **Messages → New message**, search the other person's name or full email, and select that user. Both participants receive text messages immediately while the app is active. The server holds an authenticated `/sync` request until data changes, responds immediately, and the client subscribes again (long polling). The app reconnects with backoff, resyncs after returning from the background, preserves unsuccessful drafts for retry, and uses message IDs to prevent duplicate sends. Older history is paginated. This does not provide background push notifications, calls, file uploads, or negotiated price offers.

Passwords are salted and hashed with Node's asynchronous scrypt. Session tokens are random, stored hashed on the server, expire after 30 days and are revoked on logout; changing a password revokes the user's other sessions. The native app persists sign-in using Expo SecureStore; the web app uses browser local storage. The API authorizes every conversation operation by participant ID. User search returns display name, locality and ID, not private contact details. Sample sellers have no account IDs and are never silently linked to a real user with the same name. New local listings record the signed-in seller's ID, but sharing listings and orders between devices remains separate work.

For internet use, host `server/server.js` behind HTTPS with Node 24+, persistent storage and `NODE_ENV=production`. Set `ANIMARKET_ALLOWED_ORIGINS` to the exact web app origin(s), separated by commas. Optional server settings: `ANIMARKET_PORT` (default `3001`) and `ANIMARKET_DATABASE` (default `server/data/animarket.sqlite`). The current server runs as a single process; use a shared database and event broker before scaling to multiple instances. The app's public API URL contains no server secret. Reload Expo Go after installing SecureStore; rebuild an existing development/standalone app when adding its native configuration.

Run `npm run check:messages` for real HTTP tests covering two-way live delivery, authorization, account lookup, retries, read receipts, pagination, password changes, account switching and persistence after a server restart.

## Location selection and maps

Listings and delivery checkout use the same location picker: search a street, barangay, city or landmark; use foreground GPS; tap or move the map under the fixed pin; then confirm. Cancelling keeps the previous selection. Nearby address fields fill when available, and the user completes house/purok, barangay and landmark details. A reverse-geocoding failure leaves manual pin selection available. City/province changes require a matching confirmed pin. Delivery checkout validates the point and carries it unchanged to review and status, including cancelled requests. Published listing pickup coordinates are stored outside the public catalog and become available on the placed order. Sample listings without coordinates show an honest missing-pin message.

All map features use a light street map with roads, place names and a green pin. Leaflet 1.9.4 is bundled locally, inside `react-native-webview` on Android/iOS and an iframe on web; map tiles come from OpenStreetMap over HTTPS. A Google Maps key is not required. Missing tiles produce a connection error and retry action. The map is constrained to Davao del Norte: surrounding areas are masked, and address search, GPS and confirmed pins are checked against the bundled province polygon, including Samal. The [boundary source and license](src/constants/davao_del_norte_boundary.LICENSE.md) describe the simplified 2020 dataset; it is not a cadastral boundary. Old saved pins outside the province are labeled and must be replaced rather than moved silently.

Map attribution is visible, native tile requests identify AniMarket in the user agent, web requests retain their referrer, and the WebView/browser cache is enabled. Only visible tiles and a small viewport buffer are requested; there is no offline download or bulk prefetch. The public tile service has no availability guarantee. Follow the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/) and use an appropriate hosted tile service or your own tile infrastructure for production volume. To reproduce the bundled Leaflet source/CSS, run `node scripts/fetch_map_assets.js`; its [BSD license](src/features/location/presentation/vendor/leaflet_license.txt) is also embedded in each map document.

Address search and reverse lookup use the [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md). Search is explicit and restricted to the province bounding box, with polygon validation of results. Reverse lookup is debounced and cached, requests time out and obsolete selections are discarded. The public Photon demo supports moderate development use without an availability guarantee. For production volume, set `EXPO_PUBLIC_GEOCODER_URL` to a hosted Photon-compatible endpoint with appropriate web CORS. Search text and selected coordinates are sent to that provider. Receiver names, phones, landmarks and transport notes are not included in geocoder requests. The provider base URL is public app configuration; do not put a secret key there.

[Expo SDK 57 WebView](https://docs.expo.dev/versions/v57.0.0/sdk/webview/) is included in Expo Go. Reload Expo Go after installing dependencies; rebuild an existing development/standalone app after adding WebView or changing native location configuration. Browser GPS requires HTTPS (localhost also works); location permission is requested only when the user taps Use my current location. Background tracking is not used.

This app still uses session-based listing and order repositories. Production storage must persist both address and coordinates, and authorize access to exact seller pickup coordinates on the server. Location selection is connected to real GPS, map tiles and geocoding; it does not add seller notifications, transport dispatch or server persistence.

`npm run check:location -- --live` additionally checks a visible Tagum street-map tile and the configured geocoder against a Tagum search and reverse lookup, including web CORS. Physical-device map rendering, gestures and GPS permissions still need device testing.
