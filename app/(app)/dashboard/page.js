import Link from 'next/link';
import { getCurrentUser } from '../../../lib/auth';
import {
  getUpcomingBookings,
  getRequestsForLocum,
  getManagerShifts,
  getOpenShifts,
  getUnreadCount,
  getCompletedBookings,
  getRatingSummary,
  ensurePaymentNudges,
  getPayments,
} from '../../../lib/queries';
import { respondToRequest } from '../../../lib/actions';
import { fmtDate, fmtRate, typeLabel, jobTitleLabel, starString, daysUntil } from '../../../lib/format';
import RateShifts from '../../../components/RateShifts';

export const dynamic = 'force-dynamic';

export default function Dashboard() {
  const user = getCurrentUser();
  const upcoming = getUpcomingBookings(user);
  const unread = getUnreadCount(user.id);

  return user.role === 'locum' ? (
    <LocumDashboard user={user} upcoming={upcoming} unread={unread} />
  ) : (
    <ManagerDashboard user={user} upcoming={upcoming} unread={unread} />
  );
}

function LocumDashboard({ user, upcoming, unread }) {
  const requests = getRequestsForLocum(user.id).filter((r) => r.status === 'pending');
  const openShifts = getOpenShifts().filter((s) => s.locum_type === user.locum_type);
  const completed = getCompletedBookings(user);
  const myRating = getRatingSummary(user.id);
  const owed = getPayments(user).filter((b) => !b.paid);
  const owedTotal = owed.reduce((s, b) => s + (b.amount || 0), 0);

  return (
    <>
      <h1>Hi, {user.name.split(' ')[0]} 👋</h1>
      <p className="meta" style={{ color: 'var(--muted)', marginTop: 0 }}>
        {typeLabel(user.locum_type)} · {user.city || 'Location not set'}
        {myRating.count > 0 && (
          <> · <span className="stars">{starString(myRating.avg)}</span> {myRating.avg} ({myRating.count})</>
        )}
      </p>

      <div className="stat-grid">
        <div className="stat"><div className="n">{upcoming.length}</div><div className="l">Upcoming shifts</div></div>
        <div className="stat"><div className="n">{openShifts.length}</div><div className="l">Open shifts for you</div></div>
        <div className="stat"><div className="n">{requests.length}</div><div className="l">Booking requests</div></div>
        <div className="stat"><div className="n">{unread}</div><div className="l">Unread messages</div></div>
      </div>

      {owed.length > 0 && (
        <div className="card" style={{ background: 'var(--warn-bg)', borderColor: '#f0d9ae', marginTop: '0.75rem' }}>
          <div className="card-row">
            <div>
              <h3>💰 You&apos;re owed for {owed.length} shift{owed.length === 1 ? '' : 's'}</h3>
              <div className="meta">
                {owedTotal > 0 ? `≈ R ${owedTotal.toLocaleString()} outstanding · ` : ''}
                {owed[0].pay_by ? <>Next expected: <strong>{fmtDate(owed[0].pay_by)}</strong></> : 'Payment dates depend on each pharmacy'}
              </div>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: '0.6rem' }}>
            <Link href="/payments" className="btn small secondary">View payments</Link>
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <>
          <div className="section-head"><h2>⚡ Booking requests for you</h2></div>
          {requests.map((r) => (
            <div className="card" key={r.id}>
              <div className="card-row">
                <div>
                  <h3>{r.pharmacy_name}</h3>
                  <div className="meta">
                    {fmtDate(r.shift_date)} · {r.start_time}–{r.end_time} · {fmtRate(r.rate)}
                  </div>
                  <div className="meta">From {r.manager_name}</div>
                  {r.notes && <div className="meta">“{r.notes}”</div>}
                </div>
                <span className="pill warn">Pending</span>
              </div>
              <div className="btn-row" style={{ marginTop: '0.75rem' }}>
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
              </div>
            </div>
          ))}
        </>
      )}

      <div className="section-head">
        <h2>Your upcoming shifts</h2>
        <Link href="/schedule">Edit availability →</Link>
      </div>
      {upcoming.length === 0 ? (
        <div className="empty">
          No confirmed shifts yet.<br />
          <Link href="/shifts" className="btn" style={{ marginTop: '0.75rem' }}>Browse open shifts</Link>
        </div>
      ) : (
        upcoming.map((b, i) => (
          <div className="card" key={i}>
            <div className="card-row">
              <div>
                <h3>{b.pharmacy_name}</h3>
                <div className="meta">{fmtDate(b.shift_date)} · {b.start_time}–{b.end_time} · {fmtRate(b.rate)}</div>
              </div>
              <span className="pill ok">Confirmed</span>
            </div>
          </div>
        ))
      )}

      <RateShifts bookings={completed} viewerRole="locum" />
    </>
  );
}

function ManagerDashboard({ user, upcoming, unread }) {
  const myShifts = getManagerShifts(user.id);
  const open = myShifts.filter((s) => s.status === 'open');
  const totalApplications = open.reduce((sum, s) => sum + s.pending_applications, 0);
  const completed = getCompletedBookings(user);
  const myRating = getRatingSummary(user.id);
  const nudge = ensurePaymentNudges(user);

  return (
    <>
      <h1>Hi, {user.name.split(' ')[0]} 👋</h1>
      <p className="meta" style={{ color: 'var(--muted)', marginTop: 0 }}>
        {jobTitleLabel(user.job_title)} · {user.pharmacy_name}
        {myRating.count > 0 && (
          <> · <span className="stars">{starString(myRating.avg)}</span> {myRating.avg} ({myRating.count})</>
        )}
      </p>

      {nudge.unpaidCount > 0 && <PaymentNudgeBanner nudge={nudge} cutoffDay={user.payment_cutoff_day} />}

      <div className="btn-row" style={{ margin: '0.75rem 0 1rem' }}>
        <Link href="/shifts/new" className="btn">+ Advertise a shift</Link>
        <Link href="/locums" className="btn secondary">Find a locum</Link>
        <Link href="/settings" className="btn secondary">⚙️ Settings</Link>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="n">{open.length}</div><div className="l">Open adverts</div></div>
        <div className="stat"><div className="n">{totalApplications}</div><div className="l">Applications waiting</div></div>
        <div className="stat"><div className="n">{upcoming.length}</div><div className="l">Upcoming filled shifts</div></div>
        <div className="stat"><div className="n">{unread}</div><div className="l">Unread messages</div></div>
      </div>

      {open.length > 0 && (
        <>
          <div className="section-head"><h2>Your open adverts</h2></div>
          {open.map((s) => (
            <Link href={`/shifts/${s.id}`} key={s.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card">
                <div className="card-row">
                  <div>
                    <h3>{fmtDate(s.shift_date)} · {s.start_time}–{s.end_time}</h3>
                    <div className="meta">{typeLabel(s.locum_type)} needed · {fmtRate(s.rate)}</div>
                  </div>
                  <span className={`pill ${s.pending_applications > 0 ? 'warn' : 'off'}`}>
                    {s.pending_applications} application{s.pending_applications === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </>
      )}

      <div className="section-head"><h2>Upcoming filled shifts</h2></div>
      {upcoming.length === 0 ? (
        <div className="empty">No confirmed bookings yet. Advertise a shift or book a locum directly.</div>
      ) : (
        upcoming.map((b, i) => (
          <div className="card" key={i}>
            <div className="card-row">
              <div>
                <h3>{b.other_party}</h3>
                <div className="meta">{fmtDate(b.shift_date)} · {b.start_time}–{b.end_time} · {fmtRate(b.rate)}</div>
              </div>
              <span className="pill ok">Confirmed</span>
            </div>
          </div>
        ))
      )}

      <RateShifts bookings={completed} viewerRole="manager" />
    </>
  );
}

// The weekly payment nudge. Re-issued every 7 days per unpaid shift until the
// pharmacy's cutoff date; turns red once the cutoff has passed.
function PaymentNudgeBanner({ nudge, cutoffDay }) {
  const isOverdue = nudge.overdueCount > 0;
  return (
    <div
      className="card"
      style={{
        background: isOverdue ? '#fdecea' : 'var(--warn-bg)',
        borderColor: isOverdue ? '#f5c6c0' : '#f0d9ae',
        marginTop: '0.75rem',
      }}
    >
      <div className="card-row">
        <div>
          <h3>{isOverdue ? '🚨 Payments overdue!' : '🔔 Weekly payment reminder'}</h3>
          <div className="meta">
            {nudge.unpaidCount} unpaid shift{nudge.unpaidCount === 1 ? '' : 's'}
            {nudge.totalDue > 0 ? ` · R ${nudge.totalDue.toLocaleString()} owed` : ''}
            {nudge.notDoneCount > 0 ? ` · ${nudge.notDoneCount} still to confirm as done` : ''}
          </div>
          {isOverdue ? (
            <div className="meta" style={{ color: 'var(--danger)', fontWeight: 600 }}>
              {nudge.overdueCount} past your cutoff — pay your locums now.
            </div>
          ) : nudge.nextPayBy ? (
            <div className="meta">
              Pay by <strong>{fmtDate(nudge.nextPayBy)}</strong>
              {daysUntil(nudge.nextPayBy) >= 0 && <> ({daysUntil(nudge.nextPayBy) === 0 ? 'today' : `${daysUntil(nudge.nextPayBy)} days left`})</>}
              . This reminder repeats weekly until then.
            </div>
          ) : (
            <div className="meta">
              No cutoff date set — <Link href="/settings">set one in Settings</Link> so locums know when to expect payment.
            </div>
          )}
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: '0.6rem' }}>
        <Link href="/payments" className="btn small">Review & mark paid</Link>
      </div>
    </div>
  );
}
