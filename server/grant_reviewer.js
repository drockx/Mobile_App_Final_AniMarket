const path = require('node:path');
const { openDatabase } = require('./database');
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run verification:reviewer -- <registered-account-email>'); process.exitCode = 1;
} else {
  const db = openDatabase(process.env.ANIMARKET_DATABASE || path.join(__dirname, 'data', 'animarket.sqlite'));
  try {
    const result = db.prepare('UPDATE users SET is_reviewer = 1 WHERE email = ?').run(email);
    if (!result.changes) { console.error('Register the reviewer account first.'); process.exitCode = 1; }
    else console.log('Reviewer access granted. Refresh Profile to open ID reviews.');
  } finally { db.close(); }
}
