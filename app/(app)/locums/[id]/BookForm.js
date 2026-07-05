'use client';

import { useFormState } from 'react-dom';
import { sendBookingRequest } from '../../../../lib/actions';

export default function BookForm({ locumId }) {
  const [state, formAction] = useFormState(sendBookingRequest, {});
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="stack">
      {state?.error && <div className="error">{state.error}</div>}
      <input type="hidden" name="locum_id" value={locumId} />
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
        Hourly rate (R, optional)
        <input type="number" name="rate" min="0" step="1" placeholder="e.g. 250" />
      </label>
      <label className="field">
        Notes (optional)
        <textarea name="notes" rows="2" placeholder="e.g. Please arrive 15 min early for handover." />
      </label>
      <button className="btn block" type="submit">Send booking request</button>
    </form>
  );
}
