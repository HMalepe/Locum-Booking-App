const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function fmtRate(rate) {
  return rate ? `R${Number(rate).toFixed(0)}/hr` : 'Rate on request';
}

export function fmtTime(t) {
  return t || '';
}

export function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function typeLabel(t) {
  return t === 'pba' ? 'PBA' : 'Pharmacist';
}

const JOB_TITLES = {
  pharmacy_manager: 'Pharmacy Manager',
  responsible_pharmacist: 'Responsible Pharmacist',
  doctor: 'Doctor',
  owner: 'Owner',
};

export function jobTitleLabel(t) {
  return JOB_TITLES[t] || 'Manager';
}

export function starString(n) {
  const full = Math.round(n);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export function hoursBetween(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em - sh * 60 - sm) / 60;
  if (diff <= 0) diff += 24; // overnight shift
  return diff;
}

// First payment cutoff date on/after the given day.
// cutoffDay is a day of month (1-31); values past a month's end clamp to its last day.
export function cutoffAfter(cutoffDay, fromIso) {
  if (!cutoffDay) return null;
  let [y, m, d] = fromIso.split('-').map(Number); // m is 1-based
  for (let i = 0; i < 2; i++) {
    const daysInMonth = new Date(y, m, 0).getDate();
    const day = Math.min(cutoffDay, daysInMonth);
    const candidate = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (candidate >= fromIso) return candidate;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return null;
}

export function daysUntil(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - todayMid) / 86400000);
}
