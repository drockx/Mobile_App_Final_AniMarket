// Store a generated cleanup credential in Supabase Secrets and encrypted Vault only.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const secretPath = path.join(root, '.env.maintenance.local');
const sqlPath = path.join(root, 'cloud-maintenance.local.sql');
const cli = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
const token = fs.existsSync(secretPath) ? fs.readFileSync(secretPath, 'utf8').trim().split('=')[1] : randomBytes(32).toString('base64url');
if (!/^[\w-]{43}$/.test(token)) throw new Error('Unexpected cleanup secret. No values printed.');
if (!fs.existsSync(secretPath)) fs.writeFileSync(secretPath, `MAINTENANCE_TOKEN=${token}\n`, { flag: 'wx', mode: 0o600 });
function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error('Cloud cleanup setup did not complete. No private values printed.');
}
run(['secrets', 'set', '--env-file', secretPath, '--project-ref', 'yvamvsbfbknnasfvqdto']);
fs.writeFileSync(sqlPath, `create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
do $$ declare secret_id uuid; begin
 select id into secret_id from vault.secrets where name = 'animarket_cleanup_token';
 if secret_id is null then perform vault.create_secret('${token}', 'animarket_cleanup_token', 'AniMarket hourly private media cleanup');
 else perform vault.update_secret(secret_id, '${token}', 'animarket_cleanup_token', 'AniMarket hourly private media cleanup'); end if;
end $$;
do $$ begin if exists(select 1 from cron.job where jobname='animarket-hourly-cleanup') then perform cron.unschedule('animarket-hourly-cleanup'); end if; end $$;
select cron.schedule('animarket-hourly-cleanup', '17 * * * *', $job$
 select net.http_post(url := 'https://yvamvsbfbknnasfvqdto.supabase.co/functions/v1/animarket/maintenance',
 headers := jsonb_build_object('Content-Type','application/json','x-maintenance-token',(select decrypted_secret from vault.decrypted_secrets where name='animarket_cleanup_token')), body := '{}'::jsonb, timeout_milliseconds := 60000);
$job$);
`, { mode: 0o600 });
try { run(['db', 'query', '--linked', '--file', sqlPath]); console.log('Hourly private media cleanup configured. Credential stored only in Supabase Secrets and encrypted Vault.'); }
finally { fs.unlinkSync(sqlPath); }
