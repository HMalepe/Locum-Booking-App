'use client';

import { useFormState } from 'react-dom';
import { updatePharmacySettings } from '../../../lib/actions';

export default function SettingsForm({ currentCutoff }) {
  const [state, formAction] = useFormState(updatePharmacySettings, {});

  return (
    <form action={formAction} className="stack">
      {state?.error && <div className="error">{state.error}</div>}
      {state?.success && (
        <div className="pill ok" style={{ alignSelf: 'flex-start' }}>✓ Settings saved</div>
      )}

      <label className="field">
        Pay all locums by the…
        <select name="payment_cutoff_day" defaultValue={currentCutoff ?? ''}>
          <option value="">No cutoff (not recommended)</option>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
              {ordinal(d)} of each month
            </option>
          ))}
          <option value="31">Last day of each month</option>
        </select>
      </label>

      <button className="btn" type="submit">Save settings</button>
    </form>
  );
}

function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
}
