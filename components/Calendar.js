import { toggleAvailability } from '../lib/actions';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function iso(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Renders `numMonths` months starting from the current month.
// availability: { 'YYYY-MM-DD': 'available'|'unavailable' }
// booked: { 'YYYY-MM-DD': true }  (confirmed shifts — override availability display)
// editable: if true, future days become toggle buttons (own schedule)
export default function Calendar({ availability = {}, booked = {}, editable = false, numMonths = 2 }) {
  const now = new Date();
  const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate());

  const months = [];
  for (let i = 0; i < numMonths; i++) {
    months.push(new Date(now.getFullYear(), now.getMonth() + i, 1));
  }

  return (
    <div className="cal">
      <div className="cal-legend">
        <span className="key"><span className="swatch" style={{ background: 'var(--ok-bg)', borderColor: 'var(--ok)' }} /> Available</span>
        <span className="key"><span className="swatch" style={{ background: '#fdecea', borderColor: '#f5c6c0' }} /> Unavailable</span>
        <span className="key"><span className="swatch" style={{ background: 'var(--brand)' }} /> Booked</span>
        <span className="key"><span className="swatch" /> Not set</span>
      </div>

      {months.map((monthStart) => {
        const y = monthStart.getFullYear();
        const m = monthStart.getMonth();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const firstDow = (monthStart.getDay() + 6) % 7; // Monday-start

        const cells = [];
        for (let i = 0; i < firstDow; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        return (
          <div key={`${y}-${m}`}>
            <div className="cal-title">{MONTH_NAMES[m]} {y}</div>
            <div className="cal-grid">
              {DOW.map((d) => <div className="dow" key={d}>{d}</div>)}
              {cells.map((d, idx) => {
                if (d === null) return <div className="cal-day blank" key={`b${idx}`} />;
                const dayIso = iso(y, m, d);
                const isPast = dayIso < todayIso;
                const isBooked = booked[dayIso];
                const status = availability[dayIso];
                const cls = [
                  'cal-day',
                  isPast ? 'past' : '',
                  isBooked ? 'booked' : status === 'available' ? 'available' : status === 'unavailable' ? 'unavailable' : '',
                ].join(' ');

                if (editable && !isPast && !isBooked) {
                  return (
                    <form action={toggleAvailability} key={dayIso} style={{ display: 'contents' }}>
                      <input type="hidden" name="day" value={dayIso} />
                      <button
                        type="submit"
                        className={cls}
                        title={`Tap to change: ${status || 'not set'} → ${!status ? 'available' : status === 'available' ? 'unavailable' : 'not set'}`}
                      >
                        {d}
                      </button>
                    </form>
                  );
                }
                return (
                  <button type="button" className={cls} disabled key={dayIso}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
