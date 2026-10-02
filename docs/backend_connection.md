# Backend connection status

Updated 2 October 2026. The rollout is staged; the running app still selects the existing local backend through `EXPO_PUBLIC_BACKEND=local`. Switching that flag before the remaining feature adapters are connected would disable those features. No local accounts, messages, ID photos or orders have been migrated or removed.

| Component | Completed | Remaining before the app switch |
| --- | --- | --- |
| Firebase | Installed JS SDK; native login persistence; registration/login/logout/profile/password adapter; owner-only profiles; safe user directory; protected reviewer/verification records. Account rules deployed to `animarket-87354`. Server password policy enforces 8–21 characters with every required character type. | Connect persistent listings/orders, messaging and call signaling; complete private verification/media endpoints; device testing and deliberate migration of existing accounts. |
| Firebase costs | Cloud Billing API confirmed billing disabled and no linked account before and after rules deployment. Deployment command refuses linked billing. | Keep Spark. Free quotas can block requests; the app reports quota failures. No Firebase Storage, Cloud Functions, paid SMS or Analytics integration was added. |
| Supabase | Public client configured for `yvamvsbfbknnasfvqdto`; `animarket-ids` private bucket created; JPEG/PNG limited to 5 MB; owner-only read/upload; direct replacement/deletion denied. User confirmed Firebase Third-Party Auth integration. Trusted `animarket` Edge Function deployed for account storage-role provisioning. Real cross-provider test passed. | Connect submission/review/withdrawal and cleanup endpoints to the verification screens. Keep government IDs out of Cloudinary and public records. |
| Cloudinary | Cloud name `dnbmd5qhj` configured. | Add API credentials only to Supabase Edge Function Secrets; implement/test signed profile/listing photo uploads and cleanup. No unsigned upload preset is used. |
| Calls/push | Existing foreground WebRTC calls and local messaging server preserved. | Firestore signaling, trusted notifications, device push setup and a suitable free TURN provider still need connection/testing. A call screen alone does not guarantee calls across different networks. |

## Login and security

Firebase owns the sole account session. Native sign-in uses Firebase's AsyncStorage persistence and token refresh; it does not persist a duplicate API session. The existing local backend remains available while the adapters are staged. Email verification remains disabled. Firebase's existing email-enumeration protection may require verification to change an email through its client API; the trusted email-change endpoint needs completion before rollout.

Firestore clients cannot read another user's private profile, publish contact details in the directory, change avatar metadata, grant reviewer privileges, or mark an ID approved. Other collections are denied until their feature-specific adapters/rules are added and tested. Profile read failures show a retry/sign-in recovery state. Cancelled sign-ins cannot silently persist a different account; interrupted registrations can safely complete the missing profile with the same email and password.

The Supabase function validates Google's JWT signature, issuer, audience, expiry, issue/authentication times and Firebase account revocation/disable status. It checks the caller's owner-only Firestore profile before setting `role=authenticated`, then the app refreshes its Firebase token. That storage role does not grant ID approval or reviewer access. The function accepts no client-supplied UID or role.

The dedicated `animarket-edge` service account has a custom project role containing only `firebaseauth.users.get` and `firebaseauth.users.update`. The function currently uses those permissions for its storage-session bridge. It has no Firestore administrative, IAM or billing permissions. Its credential lives in Supabase Edge Function Secrets and ignored `.env.backend-secrets.local`; it is never an `EXPO_PUBLIC_` setting or a mobile asset. Do not commit, share or deploy that local file as website content. Rotate its key through Google IAM and update Supabase secrets when needed.

## Owner commands

```powershell
npm run firebase:check
npm run firebase:password-policy
npm run firebase:deploy
npm run check:firebase
npm run check:backend
npx supabase db query --linked --project-ref yvamvsbfbknnasfvqdto --file supabase/tests/private_identity_audit.sql --output json
npx supabase db query --linked --project-ref yvamvsbfbknnasfvqdto --file supabase/tests/private_identity_rls.sql --output json
```

`check:firebase` writes only to local demo Auth/Firestore emulators. It covers 29 rule access checks, actual SDK account flows, auth races and registration recovery. The live Supabase policy test inserts temporary metadata in a transaction and rolls it back; it uploads no ID photos or real user data.

`node scripts/check_backend_live.js --live` is an explicit production connectivity test. It first verifies Firebase's billing state, creates two isolated temporary accounts and one tiny test image, checks real trusted role provisioning/private storage/isolation, then removes those exact resources. Its ignored manifest enables cleanup recovery if a provider call fails. It never prints tokens or private credentials. Do not run it unnecessarily against quota-limited projects.

Lint, TypeScript, architecture/data/auth/input checks, Android Hermes export and web export must pass before rollout. The current exports verify bundling; physical-device behavior and the remaining cloud feature flows still need testing.

## Current checkpoint and next setup step

Passed: lint, TypeScript, backend JWT/authorization tests, demo Firebase rules/account tests, live private-storage isolation tests, and Android/web exports with the Firebase adapter enabled for those builds. All temporary live-test accounts and files were removed. The running app still uses the local backend until the remaining adapters are complete.

The Supabase secret-name check confirms Cloudinary credentials are still missing. In Cloudinary, open **Settings → API Keys** for cloud `dnbmd5qhj`. Add the following in **Supabase → Edge Functions → Secrets**:

| Secret name | Value |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | `dnbmd5qhj` |
| `CLOUDINARY_API_KEY` | The Cloudinary API key |
| `CLOUDINARY_API_SECRET` | The Cloudinary API secret |

Keep the API secret in Supabase; do not paste it into chat or an `EXPO_PUBLIC_` setting. No billing upgrade is part of this setup.

References: [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Expo Firebase JS SDK](https://docs.expo.dev/guides/using-firebase/), [Supabase Firebase integration](https://supabase.com/docs/guides/auth/third-party/firebase-auth), [Cloudinary server credentials](https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials).
