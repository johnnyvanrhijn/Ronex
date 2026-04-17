import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

/**
 * Send a magic link (OTP) to the given email address.
 * The user receives a 6-digit code they enter in the app.
 */
export async function signInWithEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // We use OTP code entry (not a clickable link) because
      // deep link handling in RN is unreliable across mail clients.
      shouldCreateUser: true,
    },
  });

  if (error) {
    throw error;
  }
}

/**
 * Verify the OTP code the user received via email.
 * Returns the session on success.
 */
export async function verifyOtp(
  email: string,
  token: string,
): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error('Verification succeeded but no session was returned');
  }

  return data.session;
}

/**
 * Sign out the current user. Clears session from AsyncStorage.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

/**
 * Get the current session, or null if not authenticated.
 * This reads from the persisted session in AsyncStorage.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}
