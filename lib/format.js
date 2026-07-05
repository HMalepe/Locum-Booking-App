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
