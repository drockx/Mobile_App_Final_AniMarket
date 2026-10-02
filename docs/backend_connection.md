# Backend connection

Updated 2 October 2026. The app selects its deployed cloud backend through `EXPO_PUBLIC_BACKEND=firebase`. Sample listings, seller records, conversations, market references and bundled sample livestock photos were removed from app source. Local repositories always start empty. The old local development database and its two accounts were deleted at the user's request; cloud accounts and the real admin login were preserved. Order test fixtures exist only under `scripts/fixtures`, outside the app and excluded from EAS. An empty marketplace is expected until a verified seller publishes livestock.

| Service | Connected behavior |
| --- | --- |
| Firebase `animarket-87354` | Email/password accounts, persistent profiles, livestock listings, orders, real-time messages, call signaling and verification status. Rules restrict private reads and deny direct client changes to trusted records. |
| Supabase `yvamvsbfbknnasfvqdto` | Trusted `animarket` Edge Function validates Firebase tokens and account revocation, enforces ownership and order transitions, signs uploads and processes private ID decisions. Private ID/document storage is restricted. |
| Cloudinary `dnbmd5qhj` | Signed public profile and livestock photos, with replacement/deletion cleanup. Government IDs and vaccination documents remain in private Supabase storage. |
| Account verification portal | Staff can sign in on the mobile app's normal login page to open `/admin`, or use [the browser portal](https://animarket-87354-admin.web.app). Both use the restricted reviewer queue, private ID preview, approval and rejection with feedback. The staff account can only review IDs. Its login is in ignored `admin-login.local.txt`. |
| Cleanup | An hourly Supabase job expires old pending IDs, removes unattached media and retries failed deletions. ID photos are removed after review or withdrawal; pending submissions expire after 30 days. |

## Account and data security

Passwords require 8–21 characters with uppercase, lowercase, number and symbol, enforced by the client and Firebase. Email verification remains disabled as requested. Email changes require the current password and a recent Firebase session; the trusted endpoint changes only the authenticated account.

Reviewers are assigned by the project owner; users cannot grant themselves access or approve their own IDs. A government-issued photo ID is sufficient for account verification; DTI documents are not required. Account-name changes invalidate prior verification. Approval changes the live profile and seller badges, and enables publishing.

The Edge Function checks Google's signature, issuer, audience, expiry and Firebase disable/revocation state. Its dedicated service account can read/update Auth users and application Firestore records; it has no IAM or billing permissions. Credentials stay in Supabase Secrets and ignored local server files. Public app configuration contains no service-role key, Cloudinary secret or service-account private key.

Listing publication validates photo ownership, category and a pickup pin inside Davao del Norte. Public listings omit precise pickup coordinates. Order creation rechecks the current price and listing availability; only participants can read an order. Seller acceptance reserves livestock, and buyer completion marks it sold. Failed/repeated requests retain their IDs to prevent duplicates.

Messaging uses private conversations and live Firestore subscriptions. Calls use participant-only signaling, busy locks, callee-only answer, microphone permissions and stale-call cleanup. Native audio still needs physical-device testing; TURN is not configured, so cross-network voice reliability is not established. Background incoming-call push is not configured. Payment and transport costs are arrangements/estimates, not automatic money transfers or a booked courier service.

## Cost boundary

The Cloud Billing API confirmed that Firebase billing is disabled with no linked account. Owner deployment scripts stop if a billing account is detected. No Firebase Storage, Cloud Functions, paid SMS or Analytics integration was added. The portal uses static Firebase Hosting on Spark. Free quotas may pause service; they do not create a paid Firebase billing account. Supabase and Cloudinary remain subject to their free-plan limits.

## Verification and owner commands

- `npm run check:app`: lint, TypeScript, architecture and feature regression checks passed.
- `npm run check:firebase`: 46 rules checks plus actual emulator SDK account flows, recovery and email changes passed.
- `node --test scripts/check_cloud.mjs`: nine cloud authorization/workflow checks passed, including staff-only access.
- `node scripts/check_cloud_live.mjs --live`: deployed photos, private ID approval, private documents, listing ownership, complete order flow, two-way messages and call signaling passed. Temporary test accounts, records and media were removed.
- `node scripts/check_admin_live.js`: hosted portal, real reviewer login, queue and denial of non-review actions passed without changing customer records.
- `node scripts/check_registration_live.js --live`: actual app registration, duplicate-email feedback, interrupted-profile recovery and staff login passed; disposable registration accounts were removed. Add `--admin-only` for the read-only app admin login/queue/scope probe. Navigation checks cover every declared screen, and emulator checks verify role revocation signs staff out.
- Live Supabase storage policy tests passed and rolled their temporary metadata back.

```powershell
npm run firebase:check
npm run firebase:password-policy
npm run firebase:deploy
npx supabase functions deploy animarket --project-ref yvamvsbfbknnasfvqdto
node scripts/setup_admin_portal.js
node scripts/grant_firebase_reviewer.js SELECTED_CUSTOMER_UID
```

The last command is only for an additional reviewer explicitly selected by the owner. Keep `admin-login.local.txt`, `.env.backend-secrets.local` and `.env.maintenance.local` private. They are excluded from Git and the mobile build. Hosting deploys only `admin_portal/`. Rotate the Cloudinary secret that was shared in chat and update Supabase Secrets.

References: [Firebase Spark plan](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Firebase Hosting](https://firebase.google.com/docs/hosting/quickstart), [Supabase Firebase authentication](https://supabase.com/docs/guides/auth/third-party/firebase-auth).
