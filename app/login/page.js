'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { login } from '../../lib/actions';

export default function LoginPage() {
  const [state, formAction] = useFormState(login, {});

  return (
    <div className="auth-wrap">
      <div className="auth-logo">
        <div className="mark">💊</div>
        <h1>Locum Planner</h1>
        <p>Book and advertise pharmacy locum shifts — fast.</p>
      </div>

      <div className="card">
        <form action={formAction} className="stack">
          {state?.error && <div className="error">{state.error}</div>}
          <label className="field">
            Employee number
            <input name="employee_number" placeholder="e.g. DC-12345" autoComplete="username" required />
          </label>
          <label className="field">
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn block" type="submit">Log in</button>
        </form>
      </div>

      <p style={{ textAlign: 'center' }}>
        New here? <Link href="/register">Create your free account</Link>
      </p>
    </div>
  );
}
