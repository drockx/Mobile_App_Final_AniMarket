const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

function openDatabase(filename) {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      full_name TEXT NOT NULL, phone TEXT NOT NULL, city TEXT NOT NULL,
      address TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL,
      created_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, initiator_id TEXT NOT NULL REFERENCES users(id),
      recipient_id TEXT NOT NULL REFERENCES users(id), pair_key TEXT NOT NULL,
      listing_id TEXT NOT NULL DEFAULT '', listing_title TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, UNIQUE(pair_key, listing_id)
    );
    CREATE TABLE IF NOT EXISTS members (
      conversation_id TEXT NOT NULL REFERENCES conversations(id), user_id TEXT NOT NULL REFERENCES users(id),
      read_seq INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(conversation_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
      conversation_id TEXT NOT NULL REFERENCES conversations(id), sender_id TEXT NOT NULL REFERENCES users(id),
      client_id TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(conversation_id, sender_id, client_id)
    );
    CREATE INDEX IF NOT EXISTS message_thread ON messages(conversation_id, seq);
    CREATE TABLE IF NOT EXISTS profile_photos (
      user_id TEXT PRIMARY KEY REFERENCES users(id), version TEXT NOT NULL,
      photo BLOB NOT NULL, mime_type TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS identity_verifications (
      user_id TEXT PRIMARY KEY REFERENCES users(id), submission_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'verified', 'rejected', 'expired')),
      id_type TEXT NOT NULL, submitted_name TEXT NOT NULL,
      photo BLOB, mime_type TEXT NOT NULL, consent_at TEXT NOT NULL,
      submitted_at TEXT NOT NULL, expires_at TEXT NOT NULL,
      reviewed_at TEXT, reviewed_by TEXT REFERENCES users(id), reason TEXT
    );
  `);
  const columns = db.prepare('PRAGMA table_info(users)').all();
  if (!columns.some((column) => column.name === 'is_reviewer')) db.exec('ALTER TABLE users ADD COLUMN is_reviewer INTEGER NOT NULL DEFAULT 0');
  return db;
}

module.exports = { openDatabase };
