// Local repeatable checks; cloud deployments and live fixture creation are separate.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const checks = [
  ['Lint', 'node_modules/expo/bin/cli', 'lint'],
  ['TypeScript', 'node_modules/typescript/bin/tsc', '--noEmit'],
  ...['architecture', 'data', 'orders', 'navigation', 'location', 'inputs', 'calendar', 'auth', 'messages', 'calls', 'verification', 'profile_photos', 'backend_bootstrap']
    .map((name) => [name, `scripts/check_${name}.js`]),
  ['Cloud records', 'scripts/check_cloud.mjs'],
];
for (const [label, script, ...args] of checks) {
  console.log(`\nChecking ${label}`);
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(`${label} failed. Fix this check before continuing.`);
    process.exit(result.status || 1);
  }
}
console.log(`\nAll ${checks.length} app checks passed.`);
