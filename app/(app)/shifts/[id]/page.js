import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '../../../../lib/auth';
import { getShift, getShiftApplications, getMyApplication } from '../../../../lib/queries';
import {
  applyToShift,
  withdrawApplication,
  acceptApplication,
  declineApplication,
  closeShift,
} from '../../../../lib/actions';
import { fmtDate, fmtRate, typeLabel, initials } from '../../../../lib/format';

export const dynamic = 'force-dynamic';

export default function ShiftDetailPage({ params }) {
  const user = getCurrentUser();
  const shift = getShift(Number(params.id));
  if (!shift) notFound();

  const isOwner = shift.manager_id === user.id;

  return (
    <>
      <Link href="/shifts">← All shifts</Link>
      <div className="card" style={{ marginTop: '0.75rem' }}>
        <div className="card-row">
          <div>
            <h1 style={{ fontSize: '1.25rem' }}>{shift.pharmacy_name}</h1>
            <div className="meta">{fmtDate(shift.shift_date)} · {shift.start_time}–{shift.end_time}</div>
            <div className="meta">{typeLabel(shift.locum_type)} needed · {fmtRate(shift.rate)}</div>
            {shift.city && <div className="meta">📍 {shift.city}</div>}
            <div className="meta">Posted by {shift.manager_name}</div>
          </div>
          <span className={`pill ${shift.status === 'open' ? 'ok' : shift.status === 'filled' ? '' : 'off'}`}>
            {shift.status}
          </span>
        </div>
        {shift.notes && <p style={{ marginBottom: 0 }}>“{shift.notes}”</p>}
        {shift.status === 'filled' && (
          <p style={{ marginBottom: 0 }}>
            ✅ Filled by <strong>{shift.assigned_locum_name}</strong>
          </p>
        )}
      </div>

      {user.role === 'locum' && shift.status === 'open' && <LocumApply shift={shift} user={user} />}
      {isOwner && <Applicants shift={shift} />}
      {isOwner && shift.status === 'open' && (
        <form action={closeShift} style={{ marginTop: '1rem' }}>
          <input type="hidden" name="shift_id" value={shift.id} />
          <button className="btn danger block" type="submit">Close advert (no longer looking)</button>
        </form>
      )}
    </>
  );
}

function LocumApply({ shift, user }) {
  const mine = getMyApplication(shift.id, user.id);

  if (mine?.status === 'pending') {
    return (
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <span className="pill warn">Applied</span>&nbsp; You applied for this shift. The manager will respond soon.
        </p>
        <form action={withdrawApplication}>
          <input type="hidden" name="shift_id" value={shift.id} />
          <button className="btn small danger" type="submit">Withdraw application</button>
        </form>
      </div>
    );
  }
  if (mine?.status === 'accepted') {
    return (
      <div className="card">
        <span className="pill ok">Confirmed</span>&nbsp; You got this shift! It's on your schedule.
      </div>
    );
  }
  if (mine?.status === 'declined') {
    return (
      <div className="card">
        <span className="pill off">Not selected</span>&nbsp; The manager went with someone else this time.
      </div>
    );
  }

  const wrongType = shift.locum_type !== user.locum_type;
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Apply for this shift</h2>
      {wrongType && (
        <p className="meta" style={{ color: 'var(--warn)' }}>
          ⚠️ This shift asks for a {typeLabel(shift.locum_type)} — you're registered as a {typeLabel(user.locum_type)}. You can still apply.
        </p>
      )}
      <form action={applyToShift} className="stack">
        <input type="hidden" name="shift_id" value={shift.id} />
        <label className="field">
          Message to the manager (optional)
          <textarea
            name="message"
            rows="3"
            placeholder="e.g. Hi, I'm available all day and know the Dis-Chem system well."
          />
        </label>
        <button className="btn block" type="submit">Apply now</button>
      </form>
    </div>
  );
}

function Applicants({ shift }) {
  const apps = getShiftApplications(shift.id);
  return (
    <>
      <div className="section-head">
        <h2>Applicants ({apps.length})</h2>
      </div>
      {apps.length === 0 ? (
        <div className="empty">No applications yet. Locums have been able to see this advert since you posted it.</div>
      ) : (
        apps.map((a) => (
          <div className="card" key={a.id}>
            <div className="card-row">
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div className="avatar">{initials(a.name)}</div>
                <div>
                  <h3>
                    <Link href={`/locums/${a.locum_id}`}>{a.name}</Link>
                  </h3>
                  <div className="meta">
                    {typeLabel(a.locum_type)} · {a.employee_number}
                    {a.city ? ` · ${a.city}` : ''}
                  </div>
                  {a.message && <div className="meta">“{a.message}”</div>}
                </div>
              </div>
              <span className={`pill ${a.status === 'pending' ? 'warn' : a.status === 'accepted' ? 'ok' : 'off'}`}>
                {a.status}
              </span>
            </div>
            {a.status === 'pending' && shift.status === 'open' && (
              <div className="btn-row" style={{ marginTop: '0.75rem' }}>
                <form action={acceptApplication}>
                  <input type="hidden" name="application_id" value={a.id} />
                  <button className="btn small" type="submit">✓ Book {a.name.split(' ')[0]}</button>
                </form>
                <form action={declineApplication}>
                  <input type="hidden" name="application_id" value={a.id} />
                  <button className="btn small danger" type="submit">Decline</button>
                </form>
                <Link href={`/messages/${a.locum_id}`} className="btn small secondary">Message</Link>
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}
