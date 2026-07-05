'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState } from 'react-dom';
import { register } from '../../lib/actions';

export default function RegisterPage() {
  const [state, formAction] = useFormState(register, {});
  const [role, setRole] = useState('locum');

  return (
    <div className="auth-wrap">
      <div className="auth-logo">
        <div className="mark">💊</div>
        <h1>Join Locum Planner</h1>
        <p>Your employee number is your username.</p>
      </div>

      <div className="card">
        <form action={formAction} className="stack">
          {state?.error && <div className="error">{state.error}</div>}

          <label className="field">
            I am a…
            <select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="locum">Locum (pharmacist / PBA) — I work shifts</option>
              <option value="manager">Pharmacy side — I book locums</option>
            </select>
          </label>

          <label className="field">
            Full name
            <input name="name" placeholder="e.g. John Mthembu" required />
          </label>

          <label className="field">
            Employee number (this is your login)
            <input name="employee_number" placeholder="e.g. DC-12345" required />
          </label>

          {role === 'locum' && (
            <>
              <label className="field">
                Locum type
                <select name="locum_type" defaultValue="pharmacist">
                  <option value="pharmacist">Pharmacist</option>
                  <option value="pba">Post-Basic Pharmacist Assistant (PBA)</option>
                </select>
              </label>
              <label className="field">
                Company (optional)
                <input name="company" placeholder="e.g. Dis-Chem, Clicks, Freelance" />
              </label>
            </>
          )}

          {role === 'manager' && (
            <>
              <label className="field">
                Your position
                <select name="job_title" defaultValue="pharmacy_manager">
                  <option value="pharmacy_manager">Pharmacy Manager</option>
                  <option value="responsible_pharmacist">Responsible Pharmacist</option>
                  <option value="doctor">Doctor</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <label className="field">
                Pharmacy / practice name
                <input name="pharmacy_name" placeholder="e.g. Dis-Chem Sandton City" required />
              </label>
            </>
          )}

          <div className="row2">
            <label className="field">
              City / area
              <input name="city" placeholder="e.g. Sandton" />
            </label>
            <label className="field">
              Phone (optional)
              <input name="phone" placeholder="+27 82 123 4567" />
            </label>
          </div>

          <label className="field">
            Password (min 6 characters)
            <input name="password" type="password" autoComplete="new-password" required />
          </label>

          <button className="btn block" type="submit">Create account</button>
        </form>
      </div>

      <p style={{ textAlign: 'center' }}>
        Already registered? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
