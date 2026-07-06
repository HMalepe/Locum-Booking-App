'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import db from './db';
import { hashPassword, verifyPassword, createSession, destroySession, getCurrentUser } from './auth';
import { sendEmail } from './email';
import { fmtDate } from './format';

function requireUser() {
  const user = getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

function userById(id) {
  return db.prepare('SELECT id, name, email, role, pharmacy_name, locum_type FROM users WHERE id = ?').get(id);
}

// ---------- Auth ----------

export async function register(prevState, formData) {
  const employeeNumber = (formData.get('employee_number') || '').toString().trim();
  const password = (formData.get('password') || '').toString();
  const name = (formData.get('name') || '').toString().trim();
  const role = (formData.get('role') || '').toString();
  const locumType = (formData.get('locum_type') || '').toString() || null;
  const jobTitle = (formData.get('job_title') || '').toString() || null;
  const pharmacyName = (formData.get('pharmacy_name') || '').toString().trim() || null;
  const company = (formData.get('company') || '').toString().trim() || null;
  const city = (formData.get('city') || '').toString().trim() || null;
  const phone = (formData.get('phone') || '').toString().trim() || null;
  const email = (formData.get('email') || '').toString().trim().toLowerCase() || null;

  if (!employeeNumber || employeeNumber.length < 3) return { error: 'Employee number must be at least 3 characters.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email address.' };
  if (!password || password.length < 6) return { error: 'Password must be at least 6 characters.' };
  if (!name || !name.includes(' ')) return { error: 'Please enter your full name (first and last).' };
  if (!['locum', 'manager'].includes(role)) return { error: 'Please choose a role.' };
  if (role === 'locum' && !['pharmacist', 'pba'].includes(locumType)) return { error: 'Please choose your locum type.' };
  if (role === 'manager' && !pharmacyName) return { error: 'Please enter your pharmacy or practice name.' };
  if (role === 'manager' && !['pharmacy_manager', 'responsible_pharmacist', 'doctor', 'owner'].includes(jobTitle)) {
    return { error: 'Please choose your position.' };
  }

  const existing = db.prepare('SELECT id FROM users WHERE employee_number = ?').get(employeeNumber);
  if (existing) return { error: 'That employee number is already registered. Try logging in.' };

  const info = db
    .prepare(
      `INSERT INTO users (employee_number, password_hash, name, role, locum_type, job_title, pharmacy_name, company, city, phone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      employeeNumber,
      hashPassword(password),
      name,
      role,
      role === 'locum' ? locumType : null,
      role === 'manager' ? jobTitle : null,
      role === 'manager' ? pharmacyName : null,
      company,
      city,
      phone,
      email
    );

  sendEmail({
    to: email,
    subject: 'Welcome to Locum Planner!',
    heading: `Welcome, ${name.split(' ')[0]}! 🎉`,
    lines: [
      `Your account is live. Your login is your employee number: ${employeeNumber}.`,
      role === 'locum'
        ? 'Set your availability so pharmacies can find and book you, and keep an eye out for open shifts near you.'
        : 'Advertise your first open shift or browse locums and book one directly.',
    ],
    ctaLabel: 'Open your dashboard',
    ctaPath: '/dashboard',
  });

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

  const info = db.prepare(
    `INSERT INTO shifts (manager_id, pharmacy_name, city, shift_date, start_time, end_time, locum_type, rate, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(user.id, user.pharmacy_name, user.city, shiftDate, startTime, endTime, locumType, rate, notes);

  // Notify locums of the matching type — the WhatsApp-group broadcast, by email
  const locums = db
    .prepare(`SELECT name, email FROM users WHERE role = 'locum' AND locum_type = ? AND email IS NOT NULL AND id != ?`)
    .all(locumType, user.id);
  for (const l of locums) {
    sendEmail({
      to: l.email,
      subject: `Open shift: ${user.pharmacy_name} — ${fmtDate(shiftDate)}`,
      heading: 'New open shift near you 📋',
      lines: [
        `${user.pharmacy_name} is looking for a ${locumType === 'pba' ? 'PBA' : 'pharmacist'} on ${fmtDate(shiftDate)}, ${startTime}–${endTime}.`,
        rate ? `Offered rate: R${rate}/hr.` : 'Rate on request.',
        'Apply before it gets filled!',
      ],
      ctaLabel: 'View & apply',
      ctaPath: `/shifts/${info.lastInsertRowid}`,
    });
  }

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

  const manager = userById(shift.manager_id);
  sendEmail({
    to: manager?.email,
    subject: `${user.name} applied for your shift on ${fmtDate(shift.shift_date)}`,
    heading: 'New application 🙋',
    lines: [
      `${user.name} applied for your open shift at ${shift.pharmacy_name} on ${fmtDate(shift.shift_date)}, ${shift.start_time}–${shift.end_time}.`,
      message ? `Their message: “${message}”` : 'They didn’t leave a message.',
    ],
    ctaLabel: 'Review applicants',
    ctaPath: `/shifts/${shiftId}`,
  });

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

  const shift = db.prepare(`SELECT * FROM shifts WHERE id = ?`).get(app.shift_id);
  const locum = userById(app.locum_id);
  sendEmail({
    to: locum?.email,
    subject: `Shift confirmed: ${shift.pharmacy_name} on ${fmtDate(shift.shift_date)}`,
    heading: 'You got the shift! ✅',
    lines: [
      `${shift.pharmacy_name} booked you for ${fmtDate(shift.shift_date)}, ${shift.start_time}–${shift.end_time}.`,
      shift.rate ? `Rate: R${shift.rate}/hr.` : '',
      'The day has been marked as booked on your schedule.',
    ].filter(Boolean),
    ctaLabel: 'View your bookings',
    ctaPath: '/dashboard',
  });

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

  const locumUser = userById(locumId);
  sendEmail({
    to: locumUser?.email,
    subject: `${user.pharmacy_name} wants to book you — ${fmtDate(shiftDate)}`,
    heading: 'New booking request ⚡',
    lines: [
      `${user.pharmacy_name} wants to book you on ${fmtDate(shiftDate)}, ${startTime}–${endTime}.`,
      rate ? `Offered rate: R${rate}/hr.` : '',
      notes ? `Note from them: “${notes}”` : '',
      'Accept or decline from your dashboard.',
    ].filter(Boolean),
    ctaLabel: 'Respond now',
    ctaPath: '/dashboard',
  });

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
    const locum = userById(request.locum_id);
    sendEmail({
      to: locum?.email,
      subject: `Booking request cancelled — ${fmtDate(request.shift_date)}`,
      heading: 'Booking request cancelled',
      lines: [`${request.pharmacy_name} withdrew their booking request for ${fmtDate(request.shift_date)}.`],
      ctaLabel: 'Browse open shifts',
      ctaPath: '/shifts',
    });
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
    if (action === 'accept' || action === 'decline') {
      const manager = userById(request.manager_id);
      sendEmail({
        to: manager?.email,
        subject: `${user.name} ${action === 'accept' ? 'accepted' : 'declined'} your booking — ${fmtDate(request.shift_date)}`,
        heading: action === 'accept' ? 'Booking confirmed ✅' : 'Booking declined',
        lines: [
          action === 'accept'
            ? `${user.name} accepted your booking for ${fmtDate(request.shift_date)}, ${request.start_time}–${request.end_time}. It's on both your calendars.`
            : `${user.name} declined your booking for ${fmtDate(request.shift_date)}. Try another locum — plenty are available.`,
        ],
        ctaLabel: action === 'accept' ? 'View bookings' : 'Browse locums',
        ctaPath: action === 'accept' ? '/requests' : '/locums',
      });
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

// ---------- Payments (done / paid / settings) ----------

function ownedBooking(kind, id, managerId) {
  if (kind === 'shift') {
    return db
      .prepare(`SELECT id FROM shifts WHERE id = ? AND manager_id = ? AND status = 'filled'`)
      .get(id, managerId);
  }
  if (kind === 'request') {
    return db
      .prepare(`SELECT id FROM booking_requests WHERE id = ? AND manager_id = ? AND status = 'accepted'`)
      .get(id, managerId);
  }
  return null;
}

export async function markDone(formData) {
  const user = requireUser();
  if (user.role !== 'manager') return;
  const kind = (formData.get('booking_kind') || '').toString();
  const id = Number(formData.get('booking_id'));
  if (!ownedBooking(kind, id, user.id)) return;

  const table = kind === 'shift' ? 'shifts' : 'booking_requests';
  db.prepare(`UPDATE ${table} SET done = 1, done_at = datetime('now') WHERE id = ?`).run(id);
  revalidatePath('/payments');
  revalidatePath('/dashboard');
}

export async function markPaid(formData) {
  const user = requireUser();
  if (user.role !== 'manager') return;
  const kind = (formData.get('booking_kind') || '').toString();
  const id = Number(formData.get('booking_id'));
  if (!ownedBooking(kind, id, user.id)) return;

  const table = kind === 'shift' ? 'shifts' : 'booking_requests';
  // Paying a shift implies it happened, so it is marked done too.
  db.prepare(
    `UPDATE ${table} SET paid = 1, paid_at = datetime('now'), done = 1,
     done_at = COALESCE(done_at, datetime('now')) WHERE id = ?`
  ).run(id);

  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  const locum = userById(kind === 'shift' ? row.assigned_locum_id : row.locum_id);
  sendEmail({
    to: locum?.email,
    subject: `You've been paid — ${row.pharmacy_name}`,
    heading: 'Payment sent 💰',
    lines: [
      `${row.pharmacy_name} marked your shift on ${fmtDate(row.shift_date)} (${row.start_time}–${row.end_time}) as paid.`,
      'If the money hasn\'t reached your account, message them in the app.',
    ],
    ctaLabel: 'View payments',
    ctaPath: '/payments',
  });

  revalidatePath('/payments');
  revalidatePath('/dashboard');
}

export async function markUnpaid(formData) {
  const user = requireUser();
  if (user.role !== 'manager') return;
  const kind = (formData.get('booking_kind') || '').toString();
  const id = Number(formData.get('booking_id'));
  if (!ownedBooking(kind, id, user.id)) return;

  const table = kind === 'shift' ? 'shifts' : 'booking_requests';
  db.prepare(`UPDATE ${table} SET paid = 0, paid_at = NULL WHERE id = ?`).run(id);
  revalidatePath('/payments');
  revalidatePath('/dashboard');
}

export async function updatePharmacySettings(prevState, formData) {
  const user = requireUser();
  if (user.role !== 'manager') return { error: 'Only the pharmacy side has settings.' };

  const raw = (formData.get('payment_cutoff_day') || '').toString();
  let cutoffDay = null;
  if (raw !== '') {
    cutoffDay = Number(raw);
    if (!Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 31) {
      return { error: 'Cutoff day must be between 1 and 31.' };
    }
  }

  db.prepare(`UPDATE users SET payment_cutoff_day = ? WHERE id = ?`).run(cutoffDay, user.id);
  revalidatePath('/settings');
  revalidatePath('/payments');
  revalidatePath('/dashboard');
  return { success: true };
}

// ---------- Ratings ----------

export async function submitRating(formData) {
  const user = requireUser();
  const kind = (formData.get('booking_kind') || '').toString();
  const bookingId = Number(formData.get('booking_id'));
  const stars = Number(formData.get('stars'));
  const comment = (formData.get('comment') || '').toString().trim().slice(0, 500);

  if (!['shift', 'request'].includes(kind)) return;
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return;

  const today = new Date().toISOString().slice(0, 10);
  let manager_id, locum_id;

  if (kind === 'shift') {
    const shift = db
      .prepare(`SELECT manager_id, assigned_locum_id, shift_date, status FROM shifts WHERE id = ?`)
      .get(bookingId);
    if (!shift || shift.status !== 'filled' || !shift.assigned_locum_id || shift.shift_date > today) return;
    manager_id = shift.manager_id;
    locum_id = shift.assigned_locum_id;
  } else {
    const request = db
      .prepare(`SELECT manager_id, locum_id, shift_date, status FROM booking_requests WHERE id = ?`)
      .get(bookingId);
    if (!request || request.status !== 'accepted' || request.shift_date > today) return;
    manager_id = request.manager_id;
    locum_id = request.locum_id;
  }

  // Only the two parties on the booking can rate, and each rates the other.
  let rateeId;
  if (user.id === manager_id) rateeId = locum_id;
  else if (user.id === locum_id) rateeId = manager_id;
  else return;

  db.prepare(
    `INSERT INTO ratings (booking_kind, booking_id, rater_id, ratee_id, stars, comment)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (booking_kind, booking_id, rater_id)
     DO UPDATE SET stars = excluded.stars, comment = excluded.comment`
  ).run(kind, bookingId, user.id, rateeId, stars, comment);

  revalidatePath('/dashboard');
  revalidatePath(`/locums/${rateeId}`);
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
