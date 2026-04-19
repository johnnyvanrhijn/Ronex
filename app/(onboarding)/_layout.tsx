import { Stack } from 'expo-router';

/**
 * Onboarding stack (T-108..T-112).
 *
 * Screen 1 (`identity`) — swipe-back disabled: verify OTP has been consumed,
 * sending the user back to (auth) is a dead end.
 *
 * Screens 2..5 — swipe-back + back chevron enabled (default `gestureEnabled`
 * is `true`). Tapping back preserves the draft store state so prior
 * selections survive round-trips.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A0A' },
        animation: 'slide_from_right',
      }}
      initialRouteName="identity"
    >
      <Stack.Screen name="identity" options={{ gestureEnabled: false }} />
      <Stack.Screen name="experience" />
      <Stack.Screen name="usage-type" />
      {/* T-111 — shown only when usage-type === 'plan'. */}
      <Stack.Screen name="plan-preferences" />
      {/* T-112 — terminal onboarding screen (5/5). Reached from either
          usage-type (loose-branch) or plan-preferences (plan-branch). */}
      <Stack.Screen name="injuries" />
    </Stack>
  );
}
