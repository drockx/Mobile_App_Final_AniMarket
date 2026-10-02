// Backwards-compatible entry point for the current explicit cloud connectivity probe.
// The legacy direct-ID-upload probe was superseded by server-only private uploads.
import('./check_cloud_live.mjs').catch(() => {
  console.error('Cloud probe failed. Check its cleanup manifest before retrying. No credentials were printed.');
  process.exitCode = 1;
});
