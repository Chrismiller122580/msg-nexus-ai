'use server';

import { loginUser } from '@/lib/auth-user';
import { getDbErrorMessage } from '@/lib/db-error';
import { clearSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export interface LoginResult {
  success?: boolean;
  error?: string;
  user?: { email: string; name?: string };
  onboarded?: boolean;
}

export async function loginAction(email: string, _password?: string): Promise<LoginResult> {
  void _password;

  try {
    if (!email || !email.includes('@')) {
      return { error: 'Please enter a valid email' };
    }

    const result = await loginUser(email);
    return { success: true, ...result };
  } catch (err: unknown) {
    console.error('loginAction error:', err);
    const dbError = getDbErrorMessage(err);
    if (dbError) return { error: dbError };
    return { error: 'Login failed. Check your database connection and try again.' };
  }
}

export async function logoutAction() {
  await clearSession();
  revalidatePath('/');
  return { success: true };
}