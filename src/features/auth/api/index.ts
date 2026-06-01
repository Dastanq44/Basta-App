import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabase';

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function verifyOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Send a password-reset email. `redirectTo` points the email link at the app's deep-link
 * scheme; until the USER adds this URL to Supabase Auth → URL Configuration → Redirect URLs
 * the link will be rejected (see W-020). Sending succeeds either way.
 */
export const PASSWORD_RESET_REDIRECT = 'basta://reset-password';
export async function resetPasswordForEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: PASSWORD_RESET_REDIRECT,
  });
  if (error) throw error;
}

/**
 * Exchange a recovery `code` (from the deep link) for a recovery session. After this succeeds
 * the next `updateUser({ password })` is accepted by Supabase as a password-reset action.
 */
export async function exchangeCodeForSession(code: string) {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

/** Set a new password for the currently-recovered session (PKCE recovery flow). */
export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
