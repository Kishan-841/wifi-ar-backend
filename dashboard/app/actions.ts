'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { COOKIE, api } from '@/lib/scans';

export type FormState = { error?: string } | undefined;

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  let data: { token?: string; error?: string } = {};
  try {
    const res = await api('/api/auth/login', null, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    data = await res.json();
    if (!res.ok || !data.token) return { error: data.error ?? 'login failed' };
  } catch {
    return { error: 'API unreachable — is the backend running?' };
  }
  (await cookies()).set(COOKIE, data.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 24 * 3600,
  });
  redirect('/');
}

export async function logoutAction() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? null;
  if (token) await api('/api/auth/logout', token, { method: 'POST' }).catch(() => {});
  jar.delete(COOKIE);
  redirect('/login');
}

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = (await cookies()).get(COOKIE)?.value ?? null;
  const res = await api('/api/admin/users', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error ?? `failed (HTTP ${res.status})` };
  }
  revalidatePath('/users');
  return {};
}

export async function deleteUserAction(formData: FormData) {
  const token = (await cookies()).get(COOKIE)?.value ?? null;
  await api(`/api/admin/users/${String(formData.get('id'))}`, token, { method: 'DELETE' });
  revalidatePath('/users');
}
