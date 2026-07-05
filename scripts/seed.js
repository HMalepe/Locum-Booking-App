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
  INSERT OR IGNORE INTO users (employee_number, password_hash, name, role, locum_type, pharmacy_name, company, city, phone, bio)
  VALUES (@employee_number, @password_hash, @name, @role, @locum_type, @pharmacy_name, @company, @city, @phone, @bio)
`);

const users = [
  { employee_number: 'MGR-001', name: 'Sarah Naidoo', role: 'manager', locum_type: null, pharmacy_name: 'Dis-Chem Sandton City', company: null, city: 'Sandton', phone: '+27 82 111 2222', bio: '' },
  { employee_number: 'MGR-002', name: 'David Khumalo', role: 'manager', locum_type: null, pharmacy_name: 'Clicks Rosebank', company: null, city: 'Rosebank', phone: '+27 82 333 4444', bio: '' },
  { employee_number: 'DC-12345', name: 'John Mthembu', role: 'locum', locum_type: 'pharmacist', pharmacy_name: null, company: 'Freelance', city: 'Johannesburg', phone: '+27 82 555 6666', bio: 'Pharmacist with 8 years retail experience. Punctual, accurate, great with patients.' },
  { employee_number: 'CLK-67890', name: 'Thandi Nkosi', role: 'locum', locum_type: 'pba', pharmacy_name: null, company: 'Clicks', city: 'Pretoria East', phone: '+27 82 777 8888', bio: 'PBA at Clicks Menlyn, available for weekend locum shifts.' },
  { employee_number: 'PNP-54321', name: 'Lerato Molefe', role: 'locum', locum_type: 'pharmacist', pharmacy_name: null, company: 'Freelance', city: 'Cape Town', phone: '+27 82 999 0000', bio: 'Freelance pharmacist, flexible weekdays and weekends.' },
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
console.log('  Manager: MGR-001 (Sarah, Dis-Chem Sandton) / MGR-002 (David, Clicks Rosebank)');
console.log('  Locums:  DC-12345 (John, pharmacist) / CLK-67890 (Thandi, PBA) / PNP-54321 (Lerato, pharmacist)');
