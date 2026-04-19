/**
 * components/TabIcon.tsx
 *
 * Bottom-tab icon with a subtle scale animation on switch.
 *
 * Behaviour (per T-016 approved mockup specs)
 * -------------------------------------------
 * - Icon scales 0.95 → 1.0 over 150ms whenever the `focused` prop
 *   FLIPS from false → true. No animation on initial mount, and no
 *   animation on the focused=true → focused=true no-op re-render
 *   that happens when the user taps an already-active tab.
 * - Size is size-only hierarchy: the caller passes `size` (24 or 28).
 *   This component does NOT tint based on `focused` — color is
 *   authoritative from Expo Router's `tabBarActiveTintColor` /
 *   `tabBarInactiveTintColor` and is threaded in via `color`.
 * - Extensible: accepts optional `badgeCount`. When > 0 it renders a
 *   tiny lime pill top-right. T-016 does NOT ship badges, but this
 *   keeps the contract ready for later tasks (challenges count etc.)
 *   so we don't hit an architectural barrier.
 *
 * Why Reanimated and not Animated
 * -------------------------------
 * The animation must feel native on iOS even under JS-thread load
 * (Expo Router's tab transition can coincide with data fetches on the
 * newly-revealed tab). Reanimated runs on the UI thread, so the scale
 * tween is jank-free regardless.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  /** Ionicons glyph name. Use the filled variant for active, outline for inactive. */
  name: IoniconsName;
  /** Pixel size (24 for standard tabs, 28 for Workout — size-only hierarchy). */
  size: number;
  /** Color from Expo Router — primary when focused, content-secondary when not. */
  color: string;
  /** Whether this tab is the currently-active one. Drives the scale animation. */
  focused: boolean;
  /**
   * Optional badge — NOT rendered in T-016 (spec says no badges yet) but kept
   * in the contract so later tasks can pass a number without refactoring
   * consumers. Any value ≤ 0 or undefined = no pill.
   */
  badgeCount?: number;
}

const ANIM_DURATION_MS = 150;
const SCALE_FROM = 0.95;
const SCALE_TO = 1.0;

export function TabIcon({ name, size, color, focused, badgeCount }: TabIconProps) {
  const scale = useSharedValue(SCALE_TO);
  // Track the previous focused value so we only animate on a genuine
  // false → true transition, not on initial mount.
  const prevFocusedRef = useRef<boolean>(focused);

  useEffect(() => {
    const prev = prevFocusedRef.current;
    if (!prev && focused) {
      // Just became active — run the subtle 0.95 → 1.0 pop.
      scale.value = SCALE_FROM;
      scale.value = withTiming(SCALE_TO, {
        duration: ANIM_DURATION_MS,
        easing: Easing.out(Easing.quad),
      });
    }
    prevFocusedRef.current = focused;
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;

  return (
    <View style={{ width: size + 4, height: size + 4, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={animatedStyle}>
        <Ionicons name={name} size={size} color={color} />
      </Animated.View>
      {showBadge ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            borderRadius: 8,
            backgroundColor: colors.primary.DEFAULT,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel={`${badgeCount}`}
        >
          <Text
            style={{
              color: colors.background,
              fontSize: 10,
              fontFamily: 'Inter_700Bold',
              lineHeight: 12,
            }}
          >
            {badgeCount && badgeCount > 99 ? '99+' : badgeCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
