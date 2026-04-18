import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  signInWithEmail as authSignIn,
  verifyOtp as authVerifyOtp,
  signOut as authSignOut,
} from '@/lib/auth';

/**
 * Subset of the profiles row we care about for routing decisions.
 * Kept intentionally narrow — other profile fields are read elsewhere.
 */
type ProfileRouteRow = {
  onboarding_completed_at: string | null;
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  /**
   * Derived from the user's profiles row.
   * - `null`  → still fetching (or no session at all — callers should treat as loading)
   * - `false` → session exists, profile row loaded, onboarding_completed_at is null
   * - `true`  → session exists, profile row loaded, onboarding_completed_at is set
   */
  onboardingComplete: boolean | null;
  /**
   * Force a re-read of the profiles row. Call this after mutating
   * onboarding_completed_at so the gate revalidates without requiring
   * an app reload.
   */
  refreshProfile: () => Promise<void>;
  signIn: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // `onboardingComplete`:
  //   null  = we haven't finished a profile fetch yet (either no session, or
  //           the fetch is in flight). The gate treats this as "keep showing
  //           a loading state" rather than route anywhere.
  //   bool  = authoritative answer from the DB for the current user.
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(
    null,
  );

  // Track whether a profile fetch is in-flight for the active user so we can
  // ignore stale responses when the session changes rapidly (sign-out mid-fetch).
  const fetchTokenRef = useRef(0);

  const fetchProfile = useCallback(
    async (userId: string | undefined) => {
      if (!userId) {
        setOnboardingComplete(null);
        return;
      }

      const myToken = ++fetchTokenRef.current;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_completed_at')
          .eq('id', userId)
          .maybeSingle<ProfileRouteRow>();

        // Discard the result if another fetch started after us (or the user
        // signed out while we were waiting).
        if (myToken !== fetchTokenRef.current) return;

        if (error) {
          // Surface the error to the console but do NOT default to `true` —
          // that would skip onboarding for users who are genuinely pending.
          console.warn(
            '[AuthProvider] Failed to fetch profile row:',
            error.message,
          );
          setOnboardingComplete(false);
          return;
        }

        if (!data) {
          // Shouldn't happen — `handle_new_user` trigger creates a row on
          // signup. Defensive: treat a missing row as "needs onboarding".
          console.warn(
            '[AuthProvider] No profile row for user',
            userId,
            '— handle_new_user trigger may have missed this account. Treating as onboarding-incomplete.',
          );
          setOnboardingComplete(false);
          return;
        }

        setOnboardingComplete(data.onboarding_completed_at !== null);
      } catch (err) {
        if (myToken !== fetchTokenRef.current) return;
        console.warn('[AuthProvider] Profile fetch threw:', err);
        setOnboardingComplete(false);
      }
    },
    [],
  );

  useEffect(() => {
    // Restore session from AsyncStorage on mount.
    supabase.auth.getSession().then(({ data: { session: restored } }) => {
      setSession(restored);
      setIsLoading(false);
      // Kick off profile fetch for the restored user (if any).
      if (restored?.user?.id) {
        void fetchProfile(restored.user.id);
      } else {
        setOnboardingComplete(null);
      }
    });

    // Listen for auth state changes (sign in, sign out, token refresh).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.id) {
        // Reset to `null` while fetching so the gate shows loading, not a
        // stale answer from the previous user.
        setOnboardingComplete(null);
        void fetchProfile(newSession.user.id);
      } else {
        // Signed out — clear the flag and cancel any in-flight fetch.
        fetchTokenRef.current++;
        setOnboardingComplete(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile(session?.user?.id);
  }, [fetchProfile, session?.user?.id]);

  const signIn = useCallback(async (email: string) => {
    await authSignIn(email);
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const newSession = await authVerifyOtp(email, token);
    setSession(newSession);
    // onAuthStateChange will also fire and trigger the profile fetch, but we
    // kick it off here too so the loading state is set synchronously with the
    // session update (no flash through a nullish onboardingComplete frame
    // caused by out-of-order state commits).
    if (newSession?.user?.id) {
      setOnboardingComplete(null);
      void fetchProfile(newSession.user.id);
    }
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await authSignOut();
    fetchTokenRef.current++;
    setSession(null);
    setOnboardingComplete(null);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      onboardingComplete,
      refreshProfile,
      signIn,
      verifyOtp,
      signOut,
    }),
    [
      session,
      isLoading,
      onboardingComplete,
      refreshProfile,
      signIn,
      verifyOtp,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access the auth context. Must be used within <AuthProvider>.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
