import Link from 'next/link';
import { getCurrentUser } from '../../../lib/auth';
import { getRequestsForLocum, getRequestsFromManager } from '../../../lib/queries';
import { respondToRequest } from '../../../lib/actions';
import { fmtDate, fmtRate } from '../../../lib/format';

export const dynamic = 'force-dynamic';

const PILL = { pending: 'warn', accepted: 'ok', declined: 'danger', cancelled: 'off' };

export default function RequestsPage() {
  const user = getCurrentUser();
  const isLocum = user.role === 'locum';
  const requests = isLocum ? getRequestsForLocum(user.id) : getRequestsFromManager(user.id);

  return (
    <>
      <h1>Booking requests</h1>
      <p style={{ color: 'var(--muted)' }}>
        {isLocum
          ? 'Managers who want to book you directly. Accept to confirm the shift.'
          : 'Direct bookings you have sent to locums.'}
      </p>

      {requests.length === 0 ? (
        <div className="empty">
          {isLocum ? (
            <>No booking requests yet. Keep your <Link href="/schedule">schedule</Link> up to date so managers can find you.</>
          ) : (
            <>You haven&apos;t sent any booking requests. <Link href="/locums">Browse locums</Link> and book one directly.</>
          )}
        </div>
      ) : (
        requests.map((r) => (
          <div className="card" key={r.id}>
            <div className="card-row">
              <div>
                <h3>{isLocum ? r.pharmacy_name : r.locum_name}</h3>
                <div className="meta">
                  {fmtDate(r.shift_date)} · {r.start_time}–{r.end_time} · {fmtRate(r.rate)}
                </div>
                {isLocum && <div className="meta">From {r.manager_name}</div>}
                {r.notes && <div className="meta">“{r.notes}”</div>}
              </div>
              <span className={`pill ${PILL[r.status] || 'off'}`}>{r.status}</span>
            </div>

            {r.status === 'pending' && (
              <div className="btn-row" style={{ marginTop: '0.75rem' }}>
                {isLocum ? (
                  <>
                    <form action={respondToRequest}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="action" value="accept" />
                      <button className="btn small" type="submit">✓ Accept</button>
                    </form>
                    <form action={respondToRequest}>
                      <input type="hidden" name="request_id" value={r.id} />
                      <input type="hidden" name="action" value="decline" />
                      <button className="btn small danger" type="submit">Decline</button>
                    </form>
                    <Link href={`/messages/${r.manager_id}`} className="btn small secondary">Message</Link>
                  </>
                ) : (
                  <form action={respondToRequest}>
                    <input type="hidden" name="request_id" value={r.id} />
                    <input type="hidden" name="action" value="cancel" />
                    <button className="btn small danger" type="submit">Cancel request</button>
                  </form>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}
