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

App-owned source files, folders, and image basenames use snake_case. Expo Router's required `_layout.tsx` convention, platform and image scale suffixes such as `.web.tsx` and `@2x`, Expo's generated `expo-env.d.ts`, and tool-defined files such as `package.json` keep their required names.

## Run and check

```bash
npm install
npx expo start
npx expo lint
npx tsc --noEmit
npm run check:architecture
```

The catalog is sample data. Login currently validates required fields and opens the marketplace; registration validates locally. Neither form is connected to an authentication service yet.
