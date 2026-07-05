'use client';

import { useState } from 'react';
import { submitRating } from '../lib/actions';

export default function RatingForm({ bookingKind, bookingId, otherName }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);

  return (
    <form action={submitRating} className="stack" style={{ marginTop: '0.75rem' }}>
      <input type="hidden" name="booking_kind" value={bookingKind} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="stars" value={stars} />

      <div className="star-input" role="radiogroup" aria-label={`Rate ${otherName}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            className={`star ${(hover || stars) >= n ? 'on' : ''}`}
            onClick={() => setStars(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
        <span className="star-hint">
          {stars === 0 ? 'Tap to rate' : ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][stars]}
        </span>
      </div>

      <textarea name="comment" rows="2" placeholder={`Optional review of ${otherName}…`} maxLength={500} />
      <button className="btn small" type="submit" disabled={stars === 0}>
        Submit rating
      </button>
    </form>
  );
}
