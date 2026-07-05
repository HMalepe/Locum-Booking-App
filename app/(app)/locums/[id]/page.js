import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '../../../../lib/auth';
import { getUser, getAvailability, getBookedDays, getRatingSummary, getReviewsAbout } from '../../../../lib/queries';
import Calendar from '../../../../components/Calendar';
import BookForm from './BookForm';
import { initials, typeLabel, jobTitleLabel, starString, fmtDate } from '../../../../lib/format';

export const dynamic = 'force-dynamic';

export default function LocumProfilePage({ params }) {
  const user = getCurrentUser();
  const locum = getUser(Number(params.id));
  if (!locum || locum.role !== 'locum') notFound();

  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().slice(0, 10);
  const availability = getAvailability(locum.id, '2000-01-01', to);
  const booked = getBookedDays(locum.id, now.toISOString().slice(0, 10), to);
  const rating = getRatingSummary(locum.id);
  const reviews = getReviewsAbout(locum.id);

  return (
    <>
      <Link href="/locums">← All locums</Link>

      <div className="card" style={{ marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
          <div className="avatar" style={{ width: 60, height: 60, fontSize: '1.3rem' }}>{initials(locum.name)}</div>
          <div>
            <h1 style={{ fontSize: '1.25rem', marginBottom: '0.1rem' }}>{locum.name}</h1>
            <div className="meta" style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              {typeLabel(locum.locum_type)} · {locum.employee_number}
              {locum.company ? ` · ${locum.company}` : ''}
              {locum.city ? ` · ${locum.city}` : ''}
            </div>
            {rating.count > 0 && (
              <div className="rating-line">
                <span className="stars">{starString(rating.avg)}</span> {rating.avg} · {rating.count} review{rating.count === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>
        {locum.bio && <p style={{ marginBottom: 0 }}>{locum.bio}</p>}
        <div className="btn-row" style={{ marginTop: '0.75rem' }}>
          <Link href={`/messages/${locum.id}`} className="btn secondary">💬 Message {locum.name.split(' ')[0]}</Link>
        </div>
      </div>

      {user.role === 'manager' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Book {locum.name.split(' ')[0]} directly</h2>
          <BookForm locumId={locum.id} />
        </div>
      )}

      <div className="section-head"><h2>{locum.name.split(' ')[0]}&apos;s schedule</h2></div>
      <Calendar availability={availability} booked={booked} numMonths={2} />

      <div className="section-head"><h2>Reviews ({rating.count})</h2></div>
      {reviews.length === 0 ? (
        <div className="empty">No reviews yet. Ratings appear here after completed shifts.</div>
      ) : (
        <div className="card">
          {reviews.map((r, i) => (
            <div className="review" key={i}>
              <div className="card-row">
                <span className="who">
                  {r.rater_name}
                  {r.rater_role === 'manager' && r.rater_pharmacy ? ` · ${r.rater_pharmacy}` : ''}
                </span>
                <span className="stars">{starString(r.stars)}</span>
              </div>
              {r.comment && <div>“{r.comment}”</div>}
              <div className="when">{fmtDate(r.created_at.slice(0, 10))}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
