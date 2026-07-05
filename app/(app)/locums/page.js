import Link from 'next/link';
import { getCurrentUser } from '../../../lib/auth';
import { getLocums } from '../../../lib/queries';
import { initials, typeLabel, starString } from '../../../lib/format';

export const dynamic = 'force-dynamic';

export default function LocumsPage() {
  const user = getCurrentUser();
  const locums = getLocums().filter((l) => l.id !== user.id);

  return (
    <>
      <h1>Locums</h1>
      <p style={{ color: 'var(--muted)' }}>
        {user.role === 'manager'
          ? 'Browse locums, check their schedules, and book them directly.'
          : 'See who else is on the platform, check their schedules, and message them.'}
      </p>

      {locums.length === 0 ? (
        <div className="empty">No other locums registered yet. Invite your colleagues!</div>
      ) : (
        locums.map((l) => (
          <Link href={`/locums/${l.id}`} key={l.id} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card">
              <div className="card-row">
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div className="avatar">{initials(l.name)}</div>
                  <div>
                    <h3>{l.name}</h3>
                    <div className="meta">
                      {typeLabel(l.locum_type)} · {l.employee_number}
                      {l.city ? ` · ${l.city}` : ''}
                      {l.company ? ` · ${l.company}` : ''}
                    </div>
                    {l.rating_count > 0 && (
                      <div className="rating-line">
                        <span className="stars">{starString(l.avg_rating)}</span> {l.avg_rating} ({l.rating_count} review{l.rating_count === 1 ? '' : 's'})
                      </div>
                    )}
                  </div>
                </div>
                <span className={`pill ${l.days_available > 0 ? 'ok' : 'off'}`}>
                  {l.days_available > 0 ? `${l.days_available} days available` : 'No availability set'}
                </span>
              </div>
            </div>
          </Link>
        ))
      )}
    </>
  );
}
