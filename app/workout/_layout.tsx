/**
 * app/workout/_layout.tsx
 *
 * Stack router for the workout namespace.
 *
 * Currently one screen: `active` — the in-progress workout UI (T-204).
 * Future additions (all post-MVP):
 *   - workout/[id]      — read-only historical workout detail
 *   - workout/new       — launcher / template picker (T-207)
 *
 * Presentation
 * ------------
 *   Non-modal stack. The active workout is a FULL-SCREEN experience;
 *   presenting it as a modal would hide the tab-bar but also mute the
 *   back-chevron semantics we want. Keeps native back-swipe behaviour
 *   off (gestureEnabled=false) — the back chevron drives discard-confirm
 *   explicitly.
 */

import { Stack } from 'expo-router';

export default function WorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A0A' },
        animation: 'slide_from_bottom',
      }}
    >
      <Stack.Screen
        name="active"
        options={{
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}
