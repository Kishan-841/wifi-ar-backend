'use client';

import { useActionState } from 'react';

import { loginAction } from '../actions';

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <main className="wrap narrow">
      <h1>WiFi AR — Log in</h1>
      <p className="scanMeta">Accounts are created by the admin.</p>
      <form action={action} className="form">
        <input name="email" type="email" placeholder="Email" required autoComplete="username" />
        <input name="password" type="password" placeholder="Password" required autoComplete="current-password" />
        {state?.error && <p className="error">{state.error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
