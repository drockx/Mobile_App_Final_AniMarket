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
```

The catalog is sample data. Login currently validates required fields and opens the marketplace; registration validates locally. Neither form is connected to an authentication service yet.
