# Data readiness

Firebase is **not connected**. No Firebase package, credentials, project configuration, initialization, or data migration was added.

The app can run with zero sample records. In development set `EXPO_PUBLIC_SAMPLE_DATA=false` before starting Expo; production builds already disable samples. The optional sample catalog and market references are loaded only in `src/data/app_repositories.ts`. Personal listings, orders, notifications, ratings, and unread badges no longer use invented account activity.

## Current behavior

| Feature | Current source | Behavior without samples |
| --- | --- | --- |
| Accounts, profile photos, ID submission/review | Existing authenticated HTTP/SQLite service | Uses registered accounts; asynchronous errors remain visible. No sample account is required. |
| Messages | Existing authenticated HTTP repository and live sync | Registered users can chat. Unread counts and notification destinations use actual conversations. |
| Public listings and My Listings | Replaceable listing repository; local storage for now | Empty catalog, owner-specific listings, full drafts, publish, price edits, pause/resume, delete. Private pickup pins stay outside public records. |
| Checkout and orders | Replaceable private order repository; local storage for now | Requires a real listing and connected seller ID. Keeps reviewed details, validates changed prices/dates, waits for acknowledgements, retries with the same request ID, prevents duplicate taps and self-orders. |
| Order status | Order subscription | Uses the actual order ID and received status. Supports accepted, scheduled, ready, in-transit, completed, declined, and cancelled updates. Missing IDs do not create example orders. |
| Notifications | Actual conversation/order state; replaceable read-state repository | Empty state works. Read state is isolated by account and failed writes are surfaced. No fabricated completed sales or ratings. |
| Market reference and calculator | Replaceable market repository | Empty references work. Estimates require a matching locality/category and per-kg prices. Per-head prices are never multiplied as if they were per-kg prices. Changed data invalidates old results. |
| Maps | Existing GPS, Photon geocoding and OpenStreetMap tiles | Works independently of catalog fixtures, with Davao del Norte pin validation and connection/permission recovery. |

Local marketplace repositories remain **session-only** until an authorized persistent backend adapter is installed. Local order requests are labelled `saved-locally`; they do not notify a seller, dispatch transport, or collect a payment. The app displays confirmed backend order states when a future adapter supplies them; it does not invent those confirmations. Ratings display an unknown value until a ratings source exists.

## Future adapter contract

After authorization, implement the contracts in `src/services/collection.ts` and `src/features/marketplace/domain/listing_repository.ts`, then replace providers in `src/data/app_repositories.ts`. Feature screens should continue using the same services. The existing account and message APIs need their own deliberate migration if Firebase Auth or Firestore replaces the current server; changing the catalog provider does not migrate authentication.

- `watch(scope, receive, fail)` must deliver an initial snapshot, including an empty array, report failures, and unsubscribe. Public listing feeds expose only active public records; owner feeds expose only that seller's records; order/read-state feeds expose only authorized account records. Deliver ordered authoritative snapshots and normalize backend timestamps to ISO strings.
- `save`, `remove`, and listing `publish` must resolve only after a confirmed write. Return the canonical saved record with its actual document ID. Reject authorization failures, deleted records, stale updates, and invalid status transitions. Opaque IDs are preserved through navigation.
- Enforce ownership, buyer/seller participation, identity-verification eligibility, price/availability checks, cancellation rules, and idempotency **on the backend**. Client guards supplement access rules; they do not replace them. Sellers/transporters must update fulfillment states through authorized workflows before those confirmations can appear.
- Publishing a saved draft must update the same document atomically. Preserve description, photos, vaccination metadata, address and exact pin. Listing deletion/pause/price changes must update both subscribed catalog and owner views.
- Upload picked photos/documents before confirming a persistent listing write. Device `file://`/temporary picker URIs are local-only; persist authorized durable media references instead. Keep government IDs and exact pickup coordinates private; do not include private ID blobs in public user documents.
- Persist order snapshots and the original destination/pickup coordinates separately from the current listing. Future transport fees should be authoritative quotes; the current delivery range remains explicitly an estimate. Never infer paid or dispatched status from order creation.
- Persist notification read events under the authorized account. A later message/order status gets a distinct event ID, so reading an older event does not hide a new update.
- Seller call buttons use only an explicitly public, valid listing phone number; personal account phone numbers are not exposed automatically. Missing numbers omit the call control. Actual dialer support still needs a physical-device check.

## Verification

`npm run check:data` exercises an entirely empty app bootstrap, arbitrary document IDs, owner isolation, draft preservation/publication, subscription failures, delayed acknowledgements, rejected writes, idempotent order retries, duplicate taps, stale account callbacks, order status updates, notification read state, market validation, calculator inputs and safe sign-in destinations.

Also run the existing message, verification, profile, location, navigation and order checks, plus `npx expo lint`, `npx tsc --noEmit`, and cross-platform exports. Once a backend is authorized, test its security rules and transactions with two independent devices/accounts, process restarts, offline reconnection and real media uploads. Firebase persistence, provider-specific security rules, physical-device rendering/GPS and delivery/payment operations cannot be verified before those integrations exist.
