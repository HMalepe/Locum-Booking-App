import db from './db';
import { hoursBetween, cutoffAfter } from './format';

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function getOpenShifts() {
  return db
    .prepare(
      `SELECT s.*, u.name AS manager_name,
              (SELECT COUNT(*) FROM applications a WHERE a.shift_id = s.id AND a.status = 'pending') AS pending_applications,
              (SELECT ROUND(AVG(r.stars), 1) FROM ratings r WHERE r.ratee_id = s.manager_id) AS manager_rating,
              (SELECT COUNT(*) FROM ratings r WHERE r.ratee_id = s.manager_id) AS manager_rating_count
       FROM shifts s JOIN users u ON u.id = s.manager_id
       WHERE s.status = 'open' AND s.shift_date >= ?
       ORDER BY s.shift_date ASC, s.start_time ASC`
    )
    .all(today());
}

export function getShift(id) {
  return db
    .prepare(
      `SELECT s.*, u.name AS manager_name, l.name AS assigned_locum_name,
              (SELECT ROUND(AVG(r.stars), 1) FROM ratings r WHERE r.ratee_id = s.manager_id) AS manager_rating,
              (SELECT COUNT(*) FROM ratings r WHERE r.ratee_id = s.manager_id) AS manager_rating_count
       FROM shifts s
       JOIN users u ON u.id = s.manager_id
       LEFT JOIN users l ON l.id = s.assigned_locum_id
       WHERE s.id = ?`
    )
    .get(id);
}

export function getShiftApplications(shiftId) {
  return db
    .prepare(
      `SELECT a.*, u.name, u.locum_type, u.city, u.employee_number
       FROM applications a JOIN users u ON u.id = a.locum_id
       WHERE a.shift_id = ? AND a.status != 'withdrawn'
       ORDER BY a.created_at ASC`
    )
    .all(shiftId);
}

export function getMyApplication(shiftId, locumId) {
  return db.prepare(`SELECT * FROM applications WHERE shift_id = ? AND locum_id = ?`).get(shiftId, locumId);
}

export function getManagerShifts(managerId) {
  return db
    .prepare(
      `SELECT s.*, l.name AS assigned_locum_name,
              (SELECT COUNT(*) FROM applications a WHERE a.shift_id = s.id AND a.status = 'pending') AS pending_applications
       FROM shifts s LEFT JOIN users l ON l.id = s.assigned_locum_id
       WHERE s.manager_id = ?
       ORDER BY s.shift_date DESC`
    )
    .all(managerId);
}

export function getLocums() {
  return db
    .prepare(
      `SELECT u.id, u.name, u.locum_type, u.city, u.company, u.bio, u.employee_number,
              (SELECT COUNT(*) FROM availability av WHERE av.user_id = u.id AND av.status = 'available' AND av.day >= ?) AS days_available,
              (SELECT ROUND(AVG(r.stars), 1) FROM ratings r WHERE r.ratee_id = u.id) AS avg_rating,
              (SELECT COUNT(*) FROM ratings r WHERE r.ratee_id = u.id) AS rating_count
       FROM users u WHERE u.role = 'locum'
       ORDER BY days_available DESC, u.name ASC`
    )
    .all(today());
}

export function getUser(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

export function getAvailability(userId, fromDay, toDay) {
  const rows = db
    .prepare(`SELECT day, status FROM availability WHERE user_id = ? AND day BETWEEN ? AND ?`)
    .all(userId, fromDay, toDay);
  const map = {};
  for (const r of rows) map[r.day] = r.status;
  return map;
}

export function getBookedDays(locumId, fromDay, toDay) {
  const map = {};
  const shifts = db
    .prepare(
      `SELECT shift_date FROM shifts WHERE assigned_locum_id = ? AND status = 'filled' AND shift_date BETWEEN ? AND ?`
    )
    .all(locumId, fromDay, toDay);
  const requests = db
    .prepare(
      `SELECT shift_date FROM booking_requests WHERE locum_id = ? AND status = 'accepted' AND shift_date BETWEEN ? AND ?`
    )
    .all(locumId, fromDay, toDay);
  for (const r of [...shifts, ...requests]) map[r.shift_date] = true;
  return map;
}

export function getRequestsForLocum(locumId) {
  return db
    .prepare(
      `SELECT r.*, u.name AS manager_name FROM booking_requests r JOIN users u ON u.id = r.manager_id
       WHERE r.locum_id = ? ORDER BY r.created_at DESC`
    )
    .all(locumId);
}

export function getRequestsFromManager(managerId) {
  return db
    .prepare(
      `SELECT r.*, u.name AS locum_name FROM booking_requests r JOIN users u ON u.id = r.locum_id
       WHERE r.manager_id = ? ORDER BY r.created_at DESC`
    )
    .all(managerId);
}

export function getUpcomingBookings(user) {
  if (user.role === 'locum') {
    const fromShifts = db
      .prepare(
        `SELECT s.shift_date, s.start_time, s.end_time, s.pharmacy_name, s.rate, u.name AS other_party
         FROM shifts s JOIN users u ON u.id = s.manager_id
         WHERE s.assigned_locum_id = ? AND s.status = 'filled' AND s.shift_date >= ?`
      )
      .all(user.id, today());
    const fromRequests = db
      .prepare(
        `SELECT r.shift_date, r.start_time, r.end_time, r.pharmacy_name, r.rate, u.name AS other_party
         FROM booking_requests r JOIN users u ON u.id = r.manager_id
         WHERE r.locum_id = ? AND r.status = 'accepted' AND r.shift_date >= ?`
      )
      .all(user.id, today());
    return [...fromShifts, ...fromRequests].sort((a, b) => a.shift_date.localeCompare(b.shift_date));
  }
  const fromShifts = db
    .prepare(
      `SELECT s.shift_date, s.start_time, s.end_time, s.pharmacy_name, s.rate, u.name AS other_party
       FROM shifts s JOIN users u ON u.id = s.assigned_locum_id
       WHERE s.manager_id = ? AND s.status = 'filled' AND s.shift_date >= ?`
    )
    .all(user.id, today());
  const fromRequests = db
    .prepare(
      `SELECT r.shift_date, r.start_time, r.end_time, r.pharmacy_name, r.rate, u.name AS other_party
       FROM booking_requests r JOIN users u ON u.id = r.locum_id
       WHERE r.manager_id = ? AND r.status = 'accepted' AND r.shift_date >= ?`
    )
    .all(user.id, today());
  return [...fromShifts, ...fromRequests].sort((a, b) => a.shift_date.localeCompare(b.shift_date));
}

// Completed bookings (shift date passed) for either party, with any rating I already gave.
export function getCompletedBookings(user) {
  const t = today();
  const isLocum = user.role === 'locum';

  const shifts = db
    .prepare(
      `SELECT 'shift' AS kind, s.id, s.shift_date, s.start_time, s.end_time, s.pharmacy_name,
              ${isLocum ? 's.manager_id' : 's.assigned_locum_id'} AS other_id,
              u.name AS other_name,
              r.stars AS my_stars, r.comment AS my_comment
       FROM shifts s
       JOIN users u ON u.id = ${isLocum ? 's.manager_id' : 's.assigned_locum_id'}
       LEFT JOIN ratings r ON r.booking_kind = 'shift' AND r.booking_id = s.id AND r.rater_id = ?
       WHERE s.status = 'filled' AND s.shift_date <= ?
         AND ${isLocum ? 's.assigned_locum_id' : 's.manager_id'} = ?`
    )
    .all(user.id, t, user.id);

  const requests = db
    .prepare(
      `SELECT 'request' AS kind, q.id, q.shift_date, q.start_time, q.end_time, q.pharmacy_name,
              ${isLocum ? 'q.manager_id' : 'q.locum_id'} AS other_id,
              u.name AS other_name,
              r.stars AS my_stars, r.comment AS my_comment
       FROM booking_requests q
       JOIN users u ON u.id = ${isLocum ? 'q.manager_id' : 'q.locum_id'}
       LEFT JOIN ratings r ON r.booking_kind = 'request' AND r.booking_id = q.id AND r.rater_id = ?
       WHERE q.status = 'accepted' AND q.shift_date <= ?
         AND ${isLocum ? 'q.locum_id' : 'q.manager_id'} = ?`
    )
    .all(user.id, t, user.id);

  return [...shifts, ...requests].sort((a, b) => b.shift_date.localeCompare(a.shift_date));
}

// ---------- Payments ----------

// All past confirmed bookings for a user (either role), decorated with
// done/paid state, estimated amount, and the pay-by cutoff date.
export function getPayments(user) {
  const t = today();
  const isLocum = user.role === 'locum';

  const shifts = db
    .prepare(
      `SELECT 'shift' AS kind, s.id, s.shift_date, s.start_time, s.end_time, s.pharmacy_name, s.rate,
              s.done, s.paid, s.paid_at, s.manager_id,
              u.name AS other_name, m.payment_cutoff_day
       FROM shifts s
       JOIN users u ON u.id = ${isLocum ? 's.manager_id' : 's.assigned_locum_id'}
       JOIN users m ON m.id = s.manager_id
       WHERE s.status = 'filled' AND s.shift_date <= ?
         AND ${isLocum ? 's.assigned_locum_id' : 's.manager_id'} = ?`
    )
    .all(t, user.id);

  const requests = db
    .prepare(
      `SELECT 'request' AS kind, q.id, q.shift_date, q.start_time, q.end_time, q.pharmacy_name, q.rate,
              q.done, q.paid, q.paid_at, q.manager_id,
              u.name AS other_name, m.payment_cutoff_day
       FROM booking_requests q
       JOIN users u ON u.id = ${isLocum ? 'q.manager_id' : 'q.locum_id'}
       JOIN users m ON m.id = q.manager_id
       WHERE q.status = 'accepted' AND q.shift_date <= ?
         AND ${isLocum ? 'q.locum_id' : 'q.manager_id'} = ?`
    )
    .all(t, user.id);

  return [...shifts, ...requests]
    .map((b) => {
      const hours = hoursBetween(b.start_time, b.end_time);
      const amount = b.rate ? Math.round(b.rate * hours) : null;
      const pay_by = cutoffAfter(b.payment_cutoff_day, b.shift_date);
      const overdue = !b.paid && pay_by && pay_by < t;
      return { ...b, hours, amount, pay_by, overdue };
    })
    .sort((a, b) => (a.paid - b.paid) || b.shift_date.localeCompare(a.shift_date));
}

// The weekly payment nudge: for every unpaid past shift, record a nudge if the
// last one is older than 7 days. Returns a summary for the reminder banner.
export function ensurePaymentNudges(manager) {
  const unpaid = getPayments(manager).filter((b) => !b.paid);

  const lastNudge = db.prepare(
    `SELECT MAX(nudged_at) AS at FROM payment_nudges WHERE booking_kind = ? AND booking_id = ?`
  );
  const insertNudge = db.prepare(
    `INSERT INTO payment_nudges (manager_id, booking_kind, booking_id) VALUES (?, ?, ?)`
  );

  let nudgedNow = 0;
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  for (const b of unpaid) {
    const last = lastNudge.get(b.kind, b.id).at;
    if (!last || last < weekAgo) {
      insertNudge.run(manager.id, b.kind, b.id);
      nudgedNow++;
    }
  }

  const totalDue = unpaid.reduce((sum, b) => sum + (b.amount || 0), 0);
  const overdue = unpaid.filter((b) => b.overdue);
  const nextPayBy = unpaid
    .map((b) => b.pay_by)
    .filter(Boolean)
    .sort()[0] || null;

  return {
    unpaidCount: unpaid.length,
    totalDue,
    overdueCount: overdue.length,
    nextPayBy,
    nudgedNow,
    notDoneCount: unpaid.filter((b) => !b.done).length,
  };
}

export function getRatingSummary(userId) {
  return db
    .prepare(`SELECT ROUND(AVG(stars), 1) AS avg, COUNT(*) AS count FROM ratings WHERE ratee_id = ?`)
    .get(userId);
}

export function getReviewsAbout(userId) {
  return db
    .prepare(
      `SELECT r.stars, r.comment, r.created_at, u.name AS rater_name, u.role AS rater_role,
              u.pharmacy_name AS rater_pharmacy
       FROM ratings r JOIN users u ON u.id = r.rater_id
       WHERE r.ratee_id = ?
       ORDER BY r.created_at DESC
       LIMIT 20`
    )
    .all(userId);
}

export function getConversations(userId) {
  return db
    .prepare(
      `SELECT other.id, other.name, other.role, other.locum_type, other.job_title,
              m.body AS last_body, m.created_at AS last_at, m.sender_id AS last_sender_id,
              (SELECT COUNT(*) FROM messages um
               WHERE um.sender_id = other.id AND um.recipient_id = ? AND um.read = 0) AS unread
       FROM (
         SELECT CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS other_id,
                MAX(id) AS last_id
         FROM messages WHERE sender_id = ? OR recipient_id = ?
         GROUP BY other_id
       ) c
       JOIN messages m ON m.id = c.last_id
       JOIN users other ON other.id = c.other_id
       ORDER BY m.created_at DESC`
    )
    .all(userId, userId, userId, userId);
}

export function getThread(userId, otherId) {
  db.prepare(`UPDATE messages SET read = 1 WHERE sender_id = ? AND recipient_id = ?`).run(otherId, userId);
  return db
    .prepare(
      `SELECT * FROM messages
       WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
       ORDER BY created_at ASC, id ASC`
    )
    .all(userId, otherId, otherId, userId);
}

export function getUnreadCount(userId) {
  return db.prepare(`SELECT COUNT(*) AS n FROM messages WHERE recipient_id = ? AND read = 0`).get(userId).n;
}

export function getPendingCounts(user) {
  if (user.role === 'locum') {
    const requests = db
      .prepare(`SELECT COUNT(*) AS n FROM booking_requests WHERE locum_id = ? AND status = 'pending'`)
      .get(user.id).n;
    return { requests };
  }
  const applications = db
    .prepare(
      `SELECT COUNT(*) AS n FROM applications a JOIN shifts s ON s.id = a.shift_id
       WHERE s.manager_id = ? AND a.status = 'pending' AND s.status = 'open'`
    )
    .get(user.id).n;
  return { applications };
}
