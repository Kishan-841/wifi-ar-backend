'use client';

import { useActionState } from 'react';

import { createUserAction } from '../actions';

export default function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, undefined);
  return (
    <form action={action} className="form inline">
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password (8+ chars)" required minLength={8} />
      <button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create user'}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}
