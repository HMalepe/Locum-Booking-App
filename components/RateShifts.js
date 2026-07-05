import { fmtDate, starString } from '../lib/format';
import RatingForm from './RatingForm';

// Lists completed bookings; unrated ones get an inline rating form,
// rated ones show the rating you gave.
export default function RateShifts({ bookings, viewerRole }) {
  if (bookings.length === 0) return null;
  const unrated = bookings.filter((b) => !b.my_stars);
  const rated = bookings.filter((b) => b.my_stars).slice(0, 3);

  return (
    <>
      {unrated.length > 0 && (
        <>
          <div className="section-head"><h2>⭐ Rate your recent shifts</h2></div>
          {unrated.map((b) => (
            <div className="card" key={`${b.kind}-${b.id}`}>
              <div className="card-row">
                <div>
                  <h3>{viewerRole === 'locum' ? b.pharmacy_name : b.other_name}</h3>
                  <div className="meta">
                    {fmtDate(b.shift_date)} · {b.start_time}–{b.end_time}
                    {viewerRole === 'locum' ? ` · with ${b.other_name}` : ''}
                  </div>
                </div>
                <span className="pill warn">Not rated</span>
              </div>
              <RatingForm bookingKind={b.kind} bookingId={b.id} otherName={b.other_name.split(' ')[0]} />
            </div>
          ))}
        </>
      )}

      {rated.length > 0 && (
        <>
          <div className="section-head"><h2>Your recent ratings</h2></div>
          {rated.map((b) => (
            <div className="card" key={`${b.kind}-${b.id}`}>
              <div className="card-row">
                <div>
                  <h3>{viewerRole === 'locum' ? b.pharmacy_name : b.other_name}</h3>
                  <div className="meta">{fmtDate(b.shift_date)} · {b.start_time}–{b.end_time}</div>
                  {b.my_comment && <div className="meta">“{b.my_comment}”</div>}
                </div>
                <span className="stars">{starString(b.my_stars)}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
