'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import db from './db';
import { hashPassword, verifyPassword, createSession, destroySession, getCurrentUser } from './auth';

function requireUser() {
  const user = getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

// ---------- Auth ----------

export async function register(prevState, formData) {
  const employeeNumber = (formData.get('employee_number') || '').toString().trim();
  const password = (formData.get('password') || '').toString();
  const name = (formData.get('name') || '').toString().trim();
  const role = (formData.get('role') || '').toString();
  const locumType = (formData.get('locum_type') || '').toString() || null;
  const pharmacyName = (formData.get('pharmacy_name') || '').toString().trim() || null;
  const company = (formData.get('company') || '').toString().trim() || null;
  const city = (formData.get('city') || '').toString().trim() || null;
  const phone = (formData.get('phone') || '').toString().trim() || null;

  if (!employeeNumber || employeeNumber.length < 3) return { error: 'Employee number must be at least 3 characters.' };
  if (!password || password.length < 6) return { error: 'Password must be at least 6 characters.' };
  if (!name || !name.includes(' ')) return { error: 'Please enter your full name (first and last).' };
  if (!['locum', 'manager'].includes(role)) return { error: 'Please choose a role.' };
  if (role === 'locum' && !['pharmacist', 'pba'].includes(locumType)) return { error: 'Please choose your locum type.' };
  if (role === 'manager' && !pharmacyName) return { error: 'Please enter your pharmacy name.' };

  const existing = db.prepare('SELECT id FROM users WHERE employee_number = ?').get(employeeNumber);
  if (existing) return { error: 'That employee number is already registered. Try logging in.' };

  const info = db
    .prepare(
      `INSERT INTO users (employee_number, password_hash, name, role, locum_type, pharmacy_name, company, city, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      employeeNumber,
      hashPassword(password),
      name,
      role,
      role === 'locum' ? locumType : null,
      role === 'manager' ? pharmacyName : null,
      company,
      city,
      phone
    );

  createSession(info.lastInsertRowid);
  redirect('/dashboard');
}

export async function login(prevState, formData) {
  const employeeNumber = (formData.get('employee_number') || '').toString().trim();
  const password = (formData.get('password') || '').toString();

  const user = db.prepare('SELECT * FROM users WHERE employee_number = ?').get(employeeNumber);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: 'Invalid employee number or password.' };
  }
  createSession(user.id);
  redirect('/dashboard');
}

export async function logout() {
  destroySession();
  redirect('/login');
}

// ---------- Shifts (advertise & apply) ----------

export async function postShift(prevState, formData) {
  const user = requireUser();
  if (user.role !== 'manager') return { error: 'Only managers can advertise shifts.' };

  const shiftDate = (formData.get('shift_date') || '').toString();
  const startTime = (formData.get('start_time') || '').toString();
  const endTime = (formData.get('end_time') || '').toString();
  const locumType = (formData.get('locum_type') || '').toString();
  const rate = parseFloat(formData.get('rate')) || null;
  const notes = (formData.get('notes') || '').toString().trim();

  if (!shiftDate || !startTime || !endTime) return { error: 'Date, start and end time are required.' };
  if (!['pharmacist', 'pba'].includes(locumType)) return { error: 'Choose the locum type you need.' };

  db.prepare(
    `INSERT INTO shifts (manager_id, pharmacy_name, city, shift_date, start_time, end_time, locum_type, rate, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(user.id, user.pharmacy_name, user.city, shiftDate, startTime, endTime, locumType, rate, notes);

  revalidatePath('/shifts');
  redirect('/shifts');
}

export async function applyToShift(formData) {
  const user = requireUser();
  if (user.role !== 'locum') return;
  const shiftId = Number(formData.get('shift_id'));
  const message = (formData.get('message') || '').toString().trim();

  const shift = db.prepare(`SELECT * FROM shifts WHERE id = ? AND status = 'open'`).get(shiftId);
  if (!shift) return;

  db.prepare(
    `INSERT INTO applications (shift_id, locum_id, message) VALUES (?, ?, ?)
     ON CONFLICT (shift_id, locum_id) DO UPDATE SET status = 'pending', message = excluded.message`
  ).run(shiftId, user.id, message);

  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath('/shifts');
}

export async function withdrawApplication(formData) {
  const user = requireUser();
  const shiftId = Number(formData.get('shift_id'));
  db.prepare(
    `UPDATE applications SET status = 'withdrawn' WHERE shift_id = ? AND locum_id = ? AND status = 'pending'`
  ).run(shiftId, user.id);
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath('/shifts');
}

export async function acceptApplication(formData) {
  const user = requireUser();
  const applicationId = Number(formData.get('application_id'));

  const app = db
    .prepare(
      `SELECT a.*, s.manager_id, s.shift_date FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE a.id = ?`
    )
    .get(applicationId);
  if (!app || app.manager_id !== user.id || app.status !== 'pending') return;

  const tx = db.transaction(() => {
    db.prepare(`UPDATE applications SET status = 'accepted' WHERE id = ?`).run(applicationId);
    db.prepare(`UPDATE applications SET status = 'declined' WHERE shift_id = ? AND id != ? AND status = 'pending'`).run(
      app.shift_id,
      applicationId
    );
    db.prepare(`UPDATE shifts SET status = 'filled', assigned_locum_id = ? WHERE id = ?`).run(app.locum_id, app.shift_id);
    db.prepare(
      `INSERT INTO availability (user_id, day, status) VALUES (?, ?, 'unavailable')
       ON CONFLICT (user_id, day) DO UPDATE SET status = 'unavailable'`
    ).run(app.locum_id, app.shift_date);
  });
  tx();

  revalidatePath(`/shifts/${app.shift_id}`);
  revalidatePath('/shifts');
}

export async function declineApplication(formData) {
  const user = requireUser();
  const applicationId = Number(formData.get('application_id'));
  const app = db
    .prepare(`SELECT a.*, s.manager_id FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE a.id = ?`)
    .get(applicationId);
  if (!app || app.manager_id !== user.id) return;
  db.prepare(`UPDATE applications SET status = 'declined' WHERE id = ? AND status = 'pending'`).run(applicationId);
  revalidatePath(`/shifts/${app.shift_id}`);
}

export async function closeShift(formData) {
  const user = requireUser();
  const shiftId = Number(formData.get('shift_id'));
  db.prepare(`UPDATE shifts SET status = 'closed' WHERE id = ? AND manager_id = ? AND status = 'open'`).run(
    shiftId,
    user.id
  );
  revalidatePath('/shifts');
  revalidatePath(`/shifts/${shiftId}`);
}

// ---------- Direct booking requests (Uber-style) ----------

export async function sendBookingRequest(prevState, formData) {
  const user = requireUser();
  if (user.role !== 'manager') return { error: 'Only managers can send booking requests.' };

  const locumId = Number(formData.get('locum_id'));
  const shiftDate = (formData.get('shift_date') || '').toString();
  const startTime = (formData.get('start_time') || '').toString();
  const endTime = (formData.get('end_time') || '').toString();
  const rate = parseFloat(formData.get('rate')) || null;
  const notes = (formData.get('notes') || '').toString().trim();

  const locum = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'locum'`).get(locumId);
  if (!locum) return { error: 'Locum not found.' };
  if (!shiftDate || !startTime || !endTime) return { error: 'Date, start and end time are required.' };

  db.prepare(
    `INSERT INTO booking_requests (manager_id, locum_id, pharmacy_name, shift_date, start_time, end_time, rate, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(user.id, locumId, user.pharmacy_name, shiftDate, startTime, endTime, rate, notes);

  revalidatePath('/requests');
  redirect('/requests');
}

export async function respondToRequest(formData) {
  const user = requireUser();
  const requestId = Number(formData.get('request_id'));
  const action = (formData.get('action') || '').toString();

  const request = db.prepare(`SELECT * FROM booking_requests WHERE id = ?`).get(requestId);
  if (!request) return;

  if (action === 'cancel' && request.manager_id === user.id && request.status === 'pending') {
    db.prepare(`UPDATE booking_requests SET status = 'cancelled' WHERE id = ?`).run(requestId);
  } else if (request.locum_id === user.id && request.status === 'pending') {
    if (action === 'accept') {
      const tx = db.transaction(() => {
        db.prepare(`UPDATE booking_requests SET status = 'accepted' WHERE id = ?`).run(requestId);
        db.prepare(
          `INSERT INTO availability (user_id, day, status) VALUES (?, ?, 'unavailable')
           ON CONFLICT (user_id, day) DO UPDATE SET status = 'unavailable'`
        ).run(user.id, request.shift_date);
      });
      tx();
    } else if (action === 'decline') {
      db.prepare(`UPDATE booking_requests SET status = 'declined' WHERE id = ?`).run(requestId);
    }
  }

  revalidatePath('/requests');
  revalidatePath('/dashboard');
}

// ---------- Availability ----------

export async function toggleAvailability(formData) {
  const user = requireUser();
  if (user.role !== 'locum') return;
  const day = (formData.get('day') || '').toString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;

  const current = db.prepare(`SELECT status FROM availability WHERE user_id = ? AND day = ?`).get(user.id, day);
  if (!current) {
    db.prepare(`INSERT INTO availability (user_id, day, status) VALUES (?, ?, 'available')`).run(user.id, day);
  } else if (current.status === 'available') {
    db.prepare(`UPDATE availability SET status = 'unavailable' WHERE user_id = ? AND day = ?`).run(user.id, day);
  } else {
    db.prepare(`DELETE FROM availability WHERE user_id = ? AND day = ?`).run(user.id, day);
  }
  revalidatePath('/schedule');
}

// ---------- Messaging ----------

export async function sendMessage(formData) {
  const user = requireUser();
  const recipientId = Number(formData.get('recipient_id'));
  const body = (formData.get('body') || '').toString().trim();
  if (!body || body.length > 2000) return;

  const recipient = db.prepare(`SELECT id FROM users WHERE id = ?`).get(recipientId);
  if (!recipient || recipient.id === user.id) return;

  db.prepare(`INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)`).run(user.id, recipientId, body);
  revalidatePath(`/messages/${recipientId}`);
  revalidatePath('/messages');
}
