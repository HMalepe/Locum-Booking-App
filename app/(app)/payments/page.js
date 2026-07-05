import Link from 'next/link';
import { getCurrentUser } from '../../../lib/auth';
import { getPayments, ensurePaymentNudges } from '../../../lib/queries';
import { markDone, markPaid, markUnpaid } from '../../../lib/actions';
import { fmtDate, daysUntil } from '../../../lib/format';

export const dynamic = 'force-dynamic';

export default function PaymentsPage() {
  const user = getCurrentUser();
  const isManager = user.role === 'manager';
  if (isManager) ensurePaymentNudges(user);
  const payments = getPayments(user);
  const unpaid = payments.filter((b) => !b.paid);
  const paid = payments.filter((b) => b.paid);
  const totalDue = unpaid.reduce((s, b) => s + (b.amount || 0), 0);

  return (
    <>
      <h1>Payments</h1>
      {isManager ? (
        <p style={{ color: 'var(--muted)' }}>
          Mark shifts as <strong>done</strong> once worked, then <strong>paid</strong> once payroll goes out.
          You&apos;ll get a reminder every week until your{' '}
          {user.payment_cutoff_day
            ? <>cutoff (the <strong>{user.payment_cutoff_day}{ordinal(user.payment_cutoff_day)}</strong> of each month)</>
            : <Link href="/settings">cutoff date — set it in Settings</Link>}.
        </p>
      ) : (
        <p style={{ color: 'var(--muted)' }}>
          Payment status for your worked shifts. The expected date comes from each pharmacy&apos;s payment cutoff.
        </p>
      )}

      {isManager && (
        <div className="btn-row" style={{ marginBottom: '1rem' }}>
          <Link href="/settings" className="btn secondary small">⚙️ Payment settings</Link>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat">
          <div className="n">{unpaid.length}</div>
          <div className="l">{isManager ? 'Unpaid shifts' : 'Awaiting payment'}</div>
        </div>
        <div className="stat">
          <div className="n">{totalDue > 0 ? `R ${totalDue.toLocaleString()}` : '—'}</div>
          <div className="l">{isManager ? 'Total owed' : 'Owed to you'}</div>
        </div>
      </div>

      <div className="section-head"><h2>{isManager ? 'Unpaid' : 'Awaiting payment'} ({unpaid.length})</h2></div>
      {unpaid.length === 0 ? (
        <div className="empty">All settled — no unpaid shifts. 🎉</div>
      ) : (
        unpaid.map((b) => <PaymentCard key={`${b.kind}-${b.id}`} b={b} isManager={isManager} />)
      )}

      <div className="section-head"><h2>Paid ({paid.length})</h2></div>
      {paid.length === 0 ? (
        <div className="empty">Nothing paid yet.</div>
      ) : (
        paid.map((b) => <PaymentCard key={`${b.kind}-${b.id}`} b={b} isManager={isManager} />)
      )}
    </>
  );
}

function PaymentCard({ b, isManager }) {
  return (
    <div className="card">
      <div className="card-row">
        <div>
          <h3>{isManager ? b.other_name : b.pharmacy_name}</h3>
          <div className="meta">
            {fmtDate(b.shift_date)} · {b.start_time}–{b.end_time} · {b.hours} hrs
            {b.amount ? ` · R ${b.amount.toLocaleString()}` : ''}
          </div>
          {isManager && b.kind === 'request' && <div className="meta">Direct booking</div>}
          <PayByLine b={b} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          {b.paid ? (
            <span className="pill ok">Paid ✓</span>
          ) : b.overdue ? (
            <span className="pill danger">Overdue</span>
          ) : (
            <span className="pill warn">Unpaid</span>
          )}
          {b.done ? <span className="pill">Done ✓</span> : <span className="pill off">Not marked done</span>}
        </div>
      </div>

      {isManager && (
        <div className="btn-row" style={{ marginTop: '0.75rem' }}>
          {!b.done && !b.paid && (
            <form action={markDone}>
              <input type="hidden" name="booking_kind" value={b.kind} />
              <input type="hidden" name="booking_id" value={b.id} />
              <button className="btn small secondary" type="submit">✓ Mark done</button>
            </form>
          )}
          {!b.paid ? (
            <form action={markPaid}>
              <input type="hidden" name="booking_kind" value={b.kind} />
              <input type="hidden" name="booking_id" value={b.id} />
              <button className="btn small" type="submit">💰 Mark paid</button>
            </form>
          ) : (
            <form action={markUnpaid}>
              <input type="hidden" name="booking_kind" value={b.kind} />
              <input type="hidden" name="booking_id" value={b.id} />
              <button className="btn small danger" type="submit">Undo paid</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function PayByLine({ b }) {
  if (b.paid) {
    return b.paid_at ? <div className="meta">Paid on {fmtDate(b.paid_at.slice(0, 10))}</div> : null;
  }
  if (!b.pay_by) {
    return <div className="meta">No payment cutoff set by this pharmacy</div>;
  }
  const days = daysUntil(b.pay_by);
  if (days < 0) {
    return (
      <div className="meta" style={{ color: 'var(--danger)', fontWeight: 600 }}>
        ⚠️ Pay-by date was {fmtDate(b.pay_by)} ({-days} day{days === -1 ? '' : 's'} overdue)
      </div>
    );
  }
  return (
    <div className="meta">
      Pay by {fmtDate(b.pay_by)} ({days === 0 ? 'today!' : `${days} day${days === 1 ? '' : 's'} left`})
    </div>
  );
}

function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
}
