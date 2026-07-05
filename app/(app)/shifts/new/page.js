'use client';

import { useFormState } from 'react-dom';
import { postShift } from '../../../../lib/actions';

export default function NewShiftPage() {
  const [state, formAction] = useFormState(postShift, {});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <h1>Advertise a shift</h1>
      <p style={{ color: 'var(--muted)' }}>
        Every locum on the platform can see this and apply — like posting to the WhatsApp group, but organised.
      </p>

      <div className="card">
        <form action={formAction} className="stack">
          {state?.error && <div className="error">{state.error}</div>}

          <label className="field">
            Date
            <input type="date" name="shift_date" min={today} required />
          </label>

          <div className="row2">
            <label className="field">
              Start time
              <input type="time" name="start_time" defaultValue="09:00" required />
            </label>
            <label className="field">
              End time
              <input type="time" name="end_time" defaultValue="17:00" required />
            </label>
          </div>

          <label className="field">
            Locum type needed
            <select name="locum_type" defaultValue="pharmacist">
              <option value="pharmacist">Pharmacist</option>
              <option value="pba">Post-Basic Pharmacist Assistant (PBA)</option>
            </select>
          </label>

          <label className="field">
            Hourly rate (R, optional — posting a rate attracts more applicants)
            <input type="number" name="rate" min="0" step="1" placeholder="e.g. 250" />
          </label>

          <label className="field">
            Notes for applicants (optional)
            <textarea name="notes" rows="3" placeholder="e.g. Busy Saturday. Parking at back entrance. Arrive 15 min early for handover." />
          </label>

          <button className="btn block" type="submit">Post shift</button>
        </form>
      </div>
    </>
  );
}
