import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth';
import { getAvailability, getBookedDays } from '../../../lib/queries';
import Calendar from '../../../components/Calendar';

export const dynamic = 'force-dynamic';

export default function SchedulePage() {
  const user = getCurrentUser();
  if (user.role !== 'locum') redirect('/dashboard');

  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().slice(0, 10);

  const availability = getAvailability(user.id, '2000-01-01', to);
  const booked = getBookedDays(user.id, from, to);

  return (
    <>
      <h1>My schedule</h1>
      <p style={{ color: 'var(--muted)' }}>
        Tap a day to cycle: <strong>not set → available → unavailable</strong>. Managers and other locums can
        see your schedule, so keep it fresh — available days get you booked.
      </p>
      <Calendar availability={availability} booked={booked} editable numMonths={3} />
    </>
  );
}
