/**
 * app/(tabs)/_layout.tsx
 *
 * Bottom-tab shell for the authenticated app (T-016).
 *
 * Tab order (decision 2026-04-18, SPEC §13)
 * ----------------------------------------
 *   1. Challenge  (default landing; contains Leaderboard subsection)
 *   2. Workout    (visually dominant — larger icon)
 *   3. Stats
 *   4. Profile
 *
 * Visual hierarchy = UNIFORM (decision 2026-04-19, Johnny)
 *   All 4 icons are 24pt. No size-based dominance, no tint-based
 *   dominance. Rationale: a 4-tab bar doesn't support a centre-weighted
 *   accent on position 2 (Workout) — it reads asymmetric. Logging
 *   importance is communicated via CONTENT inside tabs instead:
 *   Challenge-tab shows a prominent "Start workout" CTA, and the
 *   Workout-tab's own landing page has its own large Start button.
 *   Tab bar stays uniform + symmetric for quiet scannability.
 *
 * Haptic switch-guard
 *   `Haptics.selectionAsync()` fires only on a genuine tab SWITCH
 *   (previous tab !== new tab). Tapping the already-active tab must feel
 *   inert, not notify the hand. We use the per-screen `tabPress`
 *   listener + Expo Router's `useSegments()` to read the current route
 *   at the moment of press — that's the cleanest cross-check without
 *   wiring a custom tab bar.
 *
 * initialRouteName
 *   Challenge. This is what `router.replace('/(tabs)')` lands on after
 *   the onboarding flush in lib/onboarding.ts completes (confirmed: the
 *   root Stack hands the `(tabs)` group to this layout, which honours
 *   initialRouteName).
 */

import React from 'react';
import { Tabs, useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { colors } from '@/lib/theme';
import { TabIcon } from '@/components/TabIcon';

/**
 * Fire a selection haptic only when the tap results in an actual route
 * change. `routeName` is the tab being tapped; `currentTab` is the
 * top-level segment right now.
 */
function maybeHaptic(routeName: string, currentTab: string | undefined) {
  if (currentTab !== routeName) {
    void Haptics.selectionAsync();
  }
}

export default function TabLayout() {
  const { t } = useTranslation();
  // segments() for a (tabs) route returns e.g. ['(tabs)', 'challenge'].
  // During the microseconds around a tab press this still reflects the
  // previously-active tab, which is exactly what we need to detect a switch.
  const segments = useSegments();
  const currentTab = segments[1];

  return (
    <Tabs
      initialRouteName="challenge"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary.DEFAULT,
        tabBarInactiveTintColor: colors.content.secondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.surface.elevated,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
        },
      }}
    >
      {/*
        index.tsx exists only to redirect `/(tabs)` → `/(tabs)/challenge`.
        `href: null` keeps it out of the tab bar so it doesn't render as a
        5th empty tab.
      */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="challenge"
        options={{
          title: t('tabs.challenge'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'trophy' : 'trophy-outline'}
              size={24}
              color={color}
              focused={focused}
            />
          ),
        }}
        listeners={{
          tabPress: () => maybeHaptic('challenge', currentTab),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: t('tabs.workout'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'barbell' : 'barbell-outline'}
              size={24}
              color={color}
              focused={focused}
            />
          ),
        }}
        listeners={{
          tabPress: () => maybeHaptic('workout', currentTab),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('tabs.stats'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={24}
              color={color}
              focused={focused}
            />
          ),
        }}
        listeners={{
          tabPress: () => maybeHaptic('stats', currentTab),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={color}
              focused={focused}
            />
          ),
        }}
        listeners={{
          tabPress: () => maybeHaptic('profile', currentTab),
        }}
      />
    </Tabs>
  );
}
