# Davao del Norte livestock references

Researched on October 2, 2026. These are real **PSA provincial weighted household/establishment farmgate averages in PHP/kg live weight**, not retail meat prices, breed quotes, or October spot prices.

The latest published observation available for these commodities is **June 2026**. The PSA table was updated August 4, 2026; July–October cells are unavailable. Q2 2026 is preliminary; the next scheduled table release is November 6, 2026.

| App category / variant | June 2026 average |
| --- | ---: |
| Cow (cattle for slaughter) | 235.11 |
| Pig (hog for slaughter) | 189.50 |
| Goat (for slaughter) | 280.01 |
| Chicken (broiler) | 120.00 |
| Chicken (native/improved) | 190.02 |

Source: [PSA OpenSTAT: Livestock and Poultry (Average), farmgate prices by commodity, province, region and month, 2025–2026](https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2M__NFG/0032M4AFN12.px/). Query evidence and original cells are in `psa_query.json`; normalized records are in `davao_del_norte.json`. January–June history retains real values and sources. Month-end dates identify the reported month, not a one-day spot quote. No values were filled into unpublished months and no sample count, min/max spread, or median was invented.

`node scripts/fetch_market_references.mjs` repeats the public query; inspect the period, publication metadata and notes before publishing a later release. `node scripts/publish_market_references.js` publishes the initial record using the existing owner's Firebase CLI credentials, checks billing is disabled, and preserves any existing record. It does not refresh or overwrite admin edits.

`node scripts/confirm_market_publication.js --confirm-initial-publication` confirms the initial Pig source through the deployed admin endpoint and verifies persisted read-back. It keeps the researched amount/date/source, records the source confirmation in the audit, and refuses to replace any later revision. It is not part of recurring checks.

Admins sign in normally, then choose **Admin Portal → Market Prices** in the app, or **Market Prices** in the [hosted portal](https://animarket-87354-admin.web.app/). Select a reference, enter a reported average or range, observation date, source name, public HTTPS link and accurate notes, confirm source checking, then publish. Sources must describe Davao del Norte live-weight prices. Newer verified local reports may be used; do not relabel them as PSA data. The app's calculator and listing guide receive saved changes through the existing Firestore subscription.

Editing requires the existing owner-managed `staff: true` and `reviewer: true` role. ID-only reviewers and ordinary users cannot edit. Direct client Firestore writes remain denied. The Supabase function rechecks roles in a transaction, validates values/dates/source metadata, checks the previous revision, and atomically saves the reference and a private `marketReferenceEdits` audit record. It retains up to 36 dated observations; same-period corrections replace that observation, with the original preserved in the audit. This feature adds no Firebase Cloud Functions, Storage, billing upgrade, or paid service.

Validation: `npm run check:app` includes local price validation, staff permissions/revocation, source preservation, variants, auditing and concurrent-edit tests. `node scripts/check_admin_live.js` is a read-only live portal/backend probe; it reads the ignored local admin login without printing credentials.

`node scripts/preview_market_ui.js --serve` creates isolated, read-only React Native Web layout previews from the affected screen components at 320 and 390 px, plus hosted portal markup/CSS previews. Files stay in ignored `.expo/market-ui-preview`; network/auth mocks exist only inside this Node process and are not bundled in AniMarket. Layout previews do not verify native device rendering or backend form interactions.
