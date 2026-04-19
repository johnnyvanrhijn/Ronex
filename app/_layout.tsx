import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

// NativeWind global styles — must be imported before any component renders
import '../global.css';

// Initialize i18n before any component renders
import '@/lib/i18n';

import { QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { initSync } from '@/lib/sync/syncActiveWorkout';
import { useActiveWorkout } from '@/stores/activeWorkout';
import { useRestTimer } from '@/stores/restTimer';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // T-212: wire up the sync engine's reconnect listener once, at app root.
  // Initialized outside the auth gate because the engine internally checks
  // `supabase.auth.getUser()` before every attempt — safe to run even when
  // no session exists yet.
  useEffect(() => {
    const unsub = initSync();
    return unsub;
  }, []);

  // T-204: discard stale active-workout sessions on app-startup.
  // If the zustand store rehydrated a session whose `startedAt` is older
  // than 24 hours and it was never completed, quietly reset it. Matches
  // the brief: the user has moved on, the old session is noise.
  useEffect(() => {
    const state = useActiveWorkout.getState();
    if (!state.startedAt || state.completedAt) return;
    const startedMs = Date.parse(state.startedAt);
    if (Number.isNaN(startedMs)) return;
    const ageMs = Date.now() - startedMs;
    if (ageMs > 24 * 60 * 60 * 1000) {
      state.reset();
      useRestTimer.getState().reset();
      // A toast would be nice but we can't render one here (before the
      // navigation tree is mounted). The challenge-tab ResumeCard
      // detection implicitly handles the "it's gone" case: the user
      // won't see a stale card, which is the only observable outcome.
    }
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Handles route protection based on auth state + onboarding completion.
 *
 * Branches (T-113):
 * - No session                                 -> /(auth)/welcome
 * - Session + onboardingComplete === null      -> stay put, render loading
 *                                                 splash (AuthProvider is still
 *                                                 resolving the profile fetch).
 *                                                 DON'T push anywhere — that
 *                                                 would cause a flicker through
 *                                                 Home before kicking to
 *                                                 onboarding.
 * - Session + onboardingComplete === false     -> /(onboarding)/identity
 * - Session + onboardingComplete === true      -> /(tabs)
 */
function useProtectedRoute() {
  const { session, isLoading, onboardingComplete } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // Still restoring session from AsyncStorage.

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      }
      return;
    }

    // Session established. Wait for the profile fetch to resolve before
    // deciding where to route — otherwise we'd briefly flash through
    // (tabs) for users whose onboarding is actually incomplete.
    if (onboardingComplete === null) return;

    if (onboardingComplete === false) {
      // Pending onboarding — park the user on the identity screen unless
      // they're already somewhere inside the onboarding stack (back/forward
      // navigation between onboarding steps is fine).
      if (!inOnboardingGroup) {
        // Typed-routes cast: the (onboarding) group is registered in the
        // app router but the generated route union may not include every
        // subroute until all screens exist. Safe because the path is real.
        router.replace('/(onboarding)/identity' as never);
      }
      return;
    }

    // onboardingComplete === true → user belongs in the main app.
    // Target the concrete landing tab; `/(tabs)` alone has no index route
    // since T-016 renamed index.tsx → challenge.tsx.
    if (inAuthGroup || inOnboardingGroup) {
      router.replace('/(tabs)/challenge');
    }
  }, [session, isLoading, onboardingComplete, segments, router]);
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isLoading, session, onboardingComplete } = useAuth();

  useProtectedRoute();

  // Don't render navigation until we know the auth state, otherwise Expo
  // Router will briefly show the wrong screen.
  if (isLoading) {
    return null;
  }

  // Session exists but we're still resolving the profile row — render
  // nothing (blank splash) for the brief window between sign-in and the
  // fetch completing. Prevents a flicker through (tabs) for users whose
  // onboarding is actually incomplete.
  if (session && onboardingComplete === null) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        {/* T-206: picker group hosts modal-presented picker screens */}
        <Stack.Screen name="picker" options={{ headerShown: false, presentation: 'modal' }} />
        {/* T-204: active-workout stack (full-screen, not modal). */}
        <Stack.Screen name="workout" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
