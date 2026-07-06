/* Seeds the database with demo users and shifts so you can try the app immediately.
   Run: npm run seed
   All demo accounts use the password: password123 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'locum.db'));
db.pragma('journal_mode = WAL');

// Ensure schema exists (mirror of lib/db.js — the app also creates it on boot)
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

const PASSWORD = hashPassword('password123');

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (employee_number, password_hash, name, role, locum_type, job_title, pharmacy_name, company, city, phone, bio, email)
  VALUES (@employee_number, @password_hash, @name, @role, @locum_type, @job_title, @pharmacy_name, @company, @city, @phone, @bio, @email)
`);

const users = [
  { employee_number: 'MGR-001', email: 'sarah@example.com', name: 'Sarah Naidoo', role: 'manager', locum_type: null, job_title: 'pharmacy_manager', pharmacy_name: 'Dis-Chem Sandton City', company: null, city: 'Sandton', phone: '+27 82 111 2222', bio: '' },
  { employee_number: 'MGR-002', email: 'david@example.com', name: 'David Khumalo', role: 'manager', locum_type: null, job_title: 'owner', pharmacy_name: 'Clicks Rosebank', company: null, city: 'Rosebank', phone: '+27 82 333 4444', bio: '' },
  { employee_number: 'DR-001', email: 'aisha@example.com', name: 'Aisha Patel', role: 'manager', locum_type: null, job_title: 'doctor', pharmacy_name: 'Rosebank Family Practice', company: null, city: 'Rosebank', phone: '+27 82 222 3333', bio: '' },
  { employee_number: 'DC-12345', email: 'john@example.com', name: 'John Mthembu', role: 'locum', locum_type: 'pharmacist', job_title: null, pharmacy_name: null, company: 'Freelance', city: 'Johannesburg', phone: '+27 82 555 6666', bio: 'Pharmacist with 8 years retail experience. Punctual, accurate, great with patients.' },
  { employee_number: 'CLK-67890', email: 'thandi@example.com', name: 'Thandi Nkosi', role: 'locum', locum_type: 'pba', job_title: null, pharmacy_name: null, company: 'Clicks', city: 'Pretoria East', phone: '+27 82 777 8888', bio: 'PBA at Clicks Menlyn, available for weekend locum shifts.' },
  { employee_number: 'PNP-54321', email: 'lerato@example.com', name: 'Lerato Molefe', role: 'locum', locum_type: 'pharmacist', job_title: null, pharmacy_name: null, company: 'Freelance', city: 'Cape Town', phone: '+27 82 999 0000', bio: 'Freelance pharmacist, flexible weekdays and weekends.' },
];

for (const u of users) insertUser.run({ ...u, password_hash: PASSWORD });

const byNumber = (n) => db.prepare('SELECT id FROM users WHERE employee_number = ?').get(n).id;
const sarah = byNumber('MGR-001');
const david = byNumber('MGR-002');
const john = byNumber('DC-12345');
const thandi = byNumber('CLK-67890');
const lerato = byNumber('PNP-54321');

// Open shifts
const insertShift = db.prepare(`
  INSERT INTO shifts (manager_id, pharmacy_name, city, shift_date, start_time, end_time, locum_type, rate, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
if (db.prepare('SELECT COUNT(*) AS n FROM shifts').get().n === 0) {
  insertShift.run(sarah, 'Dis-Chem Sandton City', 'Sandton', day(2), '09:00', '17:00', 'pharmacist', 250, 'Busy Saturday. Parking at back entrance. Arrive 15 min early for handover.');
  insertShift.run(sarah, 'Dis-Chem Sandton City', 'Sandton', day(5), '08:00', '14:00', 'pba', 130, 'Morning support shift.');
  insertShift.run(david, 'Clicks Rosebank', 'Rosebank', day(3), '10:00', '18:00', 'pharmacist', 240, 'Weekend cover needed. Friendly team.');
  insertShift.run(byNumber('DR-001'), 'Rosebank Family Practice', 'Rosebank', day(4), '08:30', '13:00', 'pharmacist', 260, 'Dispensing doctor practice — morning cover for our in-house dispensary.');

  // A completed shift in the past with two-way ratings, so the review system has demo data.
  // Marked done but NOT paid — demonstrates the weekly payment nudge.
  const past = db.prepare(`
    INSERT INTO shifts (manager_id, pharmacy_name, city, shift_date, start_time, end_time, locum_type, rate, notes, status, assigned_locum_id, done, done_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'filled', ?, 1, datetime('now'))
  `).run(sarah, 'Dis-Chem Sandton City', 'Sandton', day(-5), '09:00', '17:00', 'pharmacist', 250, '', john);

  // Sarah pays all her locums by the 25th of each month
  db.prepare(`UPDATE users SET payment_cutoff_day = 25 WHERE id = ?`).run(sarah);

  const rate = db.prepare(`
    INSERT OR IGNORE INTO ratings (booking_kind, booking_id, rater_id, ratee_id, stars, comment)
    VALUES ('shift', ?, ?, ?, ?, ?)
  `);
  rate.run(past.lastInsertRowid, sarah, john, 5, 'John was excellent — arrived early, handled a busy Saturday with ease. Will book again!');
  rate.run(past.lastInsertRowid, john, sarah, 4, 'Well-organised pharmacy, friendly team. Got a proper lunch break.');
}

// Availability for locums (next 14 days, weekdays available for John, weekends for Thandi)
const setAvail = db.prepare(`
  INSERT INTO availability (user_id, day, status) VALUES (?, ?, 'available')
  ON CONFLICT (user_id, day) DO NOTHING
`);
for (let i = 1; i <= 21; i++) {
  const d = new Date();
  d.setDate(d.getDate() + i);
  const iso = d.toISOString().slice(0, 10);
  const dow = d.getDay();
  if (dow >= 1 && dow <= 5) { setAvail.run(john, iso); setAvail.run(lerato, iso); }
  if (dow === 0 || dow === 6) { setAvail.run(thandi, iso); setAvail.run(john, iso); }
}

// A message thread
if (db.prepare('SELECT COUNT(*) AS n FROM messages').get().n === 0) {
  const msg = db.prepare('INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)');
  msg.run(thandi, john, 'Hi John! Are you taking the Dis-Chem Sandton shift this Saturday?');
  msg.run(john, thandi, 'Hey Thandi 👋 I applied this morning. You should apply for the PBA one!');
}

console.log('Seed complete. Demo accounts (password: password123):');
console.log('  Pharmacy side: MGR-001 (Sarah, Pharmacy Manager) / MGR-002 (David, Owner) / DR-001 (Aisha, Doctor)');
console.log('  Locums:        DC-12345 (John, pharmacist) / CLK-67890 (Thandi, PBA) / PNP-54321 (Lerato, pharmacist)');
