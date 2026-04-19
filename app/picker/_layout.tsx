/**
 * app/picker/_layout.tsx
 *
 * Modal stack for picker screens. Currently hosts the exercise picker
 * (T-206); workout-setup / template-exercise pickers will land here too.
 *
 * Presentation: native iOS slide-up modal with swipe-down dismiss
 * (default on `presentation: 'modal'`). Renders without headers — each
 * screen owns its own top bar with a close chevron.
 */

import { Stack } from 'expo-router';

export default function PickerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        contentStyle: { backgroundColor: '#0A0A0A' },
      }}
    >
      <Stack.Screen name="exercises" />
    </Stack>
  );
}
