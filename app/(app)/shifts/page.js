import Link from 'next/link';
import { getCurrentUser } from '../../../lib/auth';
import { getOpenShifts, getManagerShifts, getMyApplication } from '../../../lib/queries';
import { fmtDate, fmtRate, typeLabel, starString } from '../../../lib/format';

export const dynamic = 'force-dynamic';

export default function ShiftsPage() {
  const user = getCurrentUser();
  const shifts = getOpenShifts();

  return (
    <>
      <div className="section-head" style={{ marginTop: 0 }}>
        <h1 style={{ margin: 0 }}>Open shifts</h1>
        {user.role === 'manager' && <Link href="/shifts/new" className="btn small">+ Advertise</Link>}
      </div>
      <p style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
        Pharmacies looking for locums right now — no more scrolling WhatsApp.
      </p>

      {shifts.length === 0 ? (
        <div className="empty">
          No open shifts at the moment.
          {user.role === 'manager' && (
            <>
              <br />
              <Link href="/shifts/new" className="btn" style={{ marginTop: '0.75rem' }}>Advertise a shift</Link>
            </>
          )}
        </div>
      ) : (
        shifts.map((s) => {
          const mine = user.role === 'locum' ? getMyApplication(s.id, user.id) : null;
          const matchesType = user.role === 'locum' && s.locum_type === user.locum_type;
          return (
            <Link href={`/shifts/${s.id}`} key={s.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card">
                <div className="card-row">
                  <div>
                    <h3>{s.pharmacy_name}</h3>
                    <div className="meta">
                      {fmtDate(s.shift_date)} · {s.start_time}–{s.end_time}
                      {s.city ? ` · ${s.city}` : ''}
                    </div>
                    <div className="meta">
                      {typeLabel(s.locum_type)} needed · {fmtRate(s.rate)}
                    </div>
                    {s.manager_rating_count > 0 && (
                      <div className="rating-line">
                        <span className="stars">{starString(s.manager_rating)}</span> {s.manager_rating} rated by locums
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                    {matchesType && <span className="pill">For you</span>}
                    {mine?.status === 'pending' && <span className="pill warn">Applied</span>}
                    {mine?.status === 'accepted' && <span className="pill ok">You got it!</span>}
                    {s.manager_id === user.id && (
                      <span className={`pill ${s.pending_applications > 0 ? 'warn' : 'off'}`}>
                        {s.pending_applications} applied
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })
      )}

      {user.role === 'manager' && <MyPastAdverts userId={user.id} />}
    </>
  );
}

function MyPastAdverts({ userId }) {
  const mine = getManagerShifts(userId).filter((s) => s.status !== 'open');
  if (mine.length === 0) return null;
  return (
    <>
      <div className="section-head"><h2>Your filled & closed adverts</h2></div>
      {mine.map((s) => (
        <Link href={`/shifts/${s.id}`} key={s.id} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card">
            <div className="card-row">
              <div>
                <h3>{fmtDate(s.shift_date)} · {s.start_time}–{s.end_time}</h3>
                <div className="meta">
                  {typeLabel(s.locum_type)}
                  {s.assigned_locum_name ? ` · Filled by ${s.assigned_locum_name}` : ''}
                </div>
              </div>
              <span className={`pill ${s.status === 'filled' ? 'ok' : 'off'}`}>{s.status}</span>
            </div>
          </div>
        </Link>
      ))}
    </>
  );
}
