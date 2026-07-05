import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth';
import SettingsForm from './SettingsForm';
import { jobTitleLabel } from '../../../lib/format';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const user = getCurrentUser();
  if (user.role !== 'manager') redirect('/dashboard');

  return (
    <>
      <h1>Settings</h1>
      <p style={{ color: 'var(--muted)' }}>
        {jobTitleLabel(user.job_title)} · {user.pharmacy_name}
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>💰 Payment cutoff date</h2>
        <p className="meta" style={{ color: 'var(--muted)' }}>
          The day of the month by which <strong>all your locums</strong> must be paid. Every unpaid shift
          triggers a weekly reminder on your dashboard until this date — and shows as <strong>overdue</strong> after it.
          Locums also see this date on their payments page so they know when to expect money.
        </p>
        <SettingsForm currentCutoff={user.payment_cutoff_day} />
      </div>
    </>
  );
}
