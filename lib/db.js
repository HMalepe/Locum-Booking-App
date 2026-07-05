import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db = globalThis.__locumDb;
if (!db) {
  db = new Database(path.join(DATA_DIR, 'locum.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000'); // concurrent opens (e.g. build workers) wait instead of failing
  migrate(db);
  globalThis.__locumDb = db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_number TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('locum','manager')),
      locum_type TEXT CHECK (locum_type IN ('pharmacist','pba')),
      pharmacy_name TEXT,
      company TEXT,
      city TEXT,
      phone TEXT,
      bio TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Open shifts advertised by managers (the "WhatsApp group" replacement)
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_id INTEGER NOT NULL REFERENCES users(id),
      pharmacy_name TEXT NOT NULL,
      city TEXT,
      shift_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      locum_type TEXT NOT NULL CHECK (locum_type IN ('pharmacist','pba')),
      rate REAL,
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','closed')),
      assigned_locum_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Locum applications to open shifts
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      locum_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (shift_id, locum_id)
    );

    -- Direct booking requests (manager books a specific locum, Uber-style)
    CREATE TABLE IF NOT EXISTS booking_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_id INTEGER NOT NULL REFERENCES users(id),
      locum_id INTEGER NOT NULL REFERENCES users(id),
      pharmacy_name TEXT NOT NULL,
      shift_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      rate REAL,
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Availability calendar: one row per locum per day they have set a status for
    CREATE TABLE IF NOT EXISTS availability (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('available','unavailable')),
      PRIMARY KEY (user_id, day)
    );

    -- Private direct messages
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Two-way ratings after completed shifts (manager↔locum)
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_kind TEXT NOT NULL CHECK (booking_kind IN ('shift','request')),
      booking_id INTEGER NOT NULL,
      rater_id INTEGER NOT NULL REFERENCES users(id),
      ratee_id INTEGER NOT NULL REFERENCES users(id),
      stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
      comment TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (booking_kind, booking_id, rater_id)
    );

    -- Weekly payment nudges sent to the pharmacy side for unpaid shifts
    CREATE TABLE IF NOT EXISTS payment_nudges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_id INTEGER NOT NULL REFERENCES users(id),
      booking_kind TEXT NOT NULL CHECK (booking_kind IN ('shift','request')),
      booking_id INTEGER NOT NULL,
      nudged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_nudges_booking ON payment_nudges(booking_kind, booking_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON ratings(ratee_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_status_date ON shifts(status, shift_date);
    CREATE INDEX IF NOT EXISTS idx_apps_shift ON applications(shift_id);
    CREATE INDEX IF NOT EXISTS idx_apps_locum ON applications(locum_id);
    CREATE INDEX IF NOT EXISTS idx_req_locum ON booking_requests(locum_id, status);
    CREATE INDEX IF NOT EXISTS idx_req_manager ON booking_requests(manager_id, status);
    CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages(sender_id, recipient_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_msg_recipient ON messages(recipient_id, read);
  `);

  // Additive migrations for existing databases
  const addColumn = (table, column, ddl) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };

  addColumn('users', 'job_title', 'job_title TEXT');
  // Payment cutoff day of month (1-31), set by the pharmacy for ALL its locums
  addColumn('users', 'payment_cutoff_day', 'payment_cutoff_day INTEGER');

  for (const table of ['shifts', 'booking_requests']) {
    addColumn(table, 'done', `done INTEGER NOT NULL DEFAULT 0`);
    addColumn(table, 'done_at', `done_at TEXT`);
    addColumn(table, 'paid', `paid INTEGER NOT NULL DEFAULT 0`);
    addColumn(table, 'paid_at', `paid_at TEXT`);
  }
}

export default db;
