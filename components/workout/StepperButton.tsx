/**
 * components/workout/StepperButton.tsx
 *
 * Inline +/- ghost button used inside weight/reps input cells.
 *
 * Why extracted
 * -------------
 * Both `WeightRepsRow` and `RepsOnlyRow` need stepper-cells that share:
 *   - 28pt visible width, 44pt effective hit target (via 8pt hitSlop L/R)
 *   - no border, no background (ghost)
 *   - long-press auto-repeat at 8 ticks/sec (125ms interval, 400ms
 *     initial delay)
 *   - haptic on every 4th tick (stutter-feedback without tick-jitter)
 *   - bounds-aware (stops repeating when the increment/decrement
 *     would cross its own bound, reported by the parent via `disabled`)
 *
 * Pulling this into a shared component keeps the timer-management + haptic-
 * cadence logic in ONE file. The parent only needs to supply `onStep()` (a
 * single increment/decrement handler) and an `icon` (`add` or `remove`).
 *
 * UX-herziening 2026-04-19 decisions baked in
 * -------------------------------------------
 *   - No scale-pulse feedback; flash-feedback is owned by the parent
 *     (it's the middle-digit that flashes lime, not the button itself).
 *     Rationale: a scale-pulse on the button competes with the digit flash
 *     visually during rapid-repeat.
 *   - No single-tap haptic. Holding the button at 8 taps/sec while every
 *     tap had its own haptic would feel like a vibrator, not feedback.
 *   - Haptic fires every 4th repeat tick so the user feels the stepper
 *     is "working" without turning the phone into a massager.
 *   - 400ms initial long-press delay (iOS HIG default) — short enough to
 *     feel responsive, long enough that a casual tap never triggers.
 *
 * Scope: numeric-value steppers only. Not a general-purpose button.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors } from '@/lib/theme';

type StepperButtonProps = {
  direction: 'increment' | 'decrement';
  /**
   * Called for every step — both on the initial tap AND on every
   * long-press repeat tick. Parent owns the value clamping; see
   * `disabled` for bounds-awareness.
   */
  onStep: () => void;
  /**
   * True when the next step would cross the bound (e.g. weight at 0
   * on decrement, reps at 999 on increment). A disabled button
   * renders at 40% opacity and does not fire onStep, nor does it
   * start a long-press repeat.
   */
  disabled?: boolean;
  /** Accessibility label — i18n-resolved by caller. */
  accessibilityLabel: string;
};

// Timing constants — centralized so A/B tweaks happen in one place.
const LONG_PRESS_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 125; // 8 ticks/sec
const HAPTIC_EVERY_N_TICKS = 4;

function StepperButtonImpl({
  direction,
  onStep,
  disabled = false,
  accessibilityLabel,
}: StepperButtonProps) {
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickCountRef = useRef(0);

  const clearRepeat = useCallback(() => {
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
    tickCountRef.current = 0;
  }, []);

  // Cleanup on unmount.
  useEffect(() => clearRepeat, [clearRepeat]);

  const handlePressIn = useCallback(() => {
    // No-op on press-in; single-tap path fires in onPress (onPress respects
    // scroll-cancel semantics — onPressIn would trigger even if the user
    // is mid-scroll and won't release on top of us).
  }, []);

  const handlePress = useCallback(() => {
    if (disabled) return;
    onStep();
  }, [disabled, onStep]);

  const handleLongPress = useCallback(() => {
    if (disabled) return;
    // Start the repeat loop. The initial tap already fired via onPress
    // if the user held long enough that both fired — React Native's
    // Pressable fires both onPress AND onLongPress when delayLongPress
    // elapses, so we end up with: tap → onStep, then 125ms later the
    // interval's first tick fires another onStep. That's correct —
    // the user's intent is "+1, then keep going".
    tickCountRef.current = 0;
    repeatIntervalRef.current = setInterval(() => {
      if (disabled) {
        clearRepeat();
        return;
      }
      onStep();
      tickCountRef.current += 1;
      if (tickCountRef.current % HAPTIC_EVERY_N_TICKS === 0) {
        // selectionAsync is the lightest haptic — feels like a soft tick.
        Haptics.selectionAsync();
      }
    }, REPEAT_INTERVAL_MS);
  }, [disabled, onStep, clearRepeat]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressOut={clearRepeat}
      delayLongPress={LONG_PRESS_DELAY_MS}
      // 44pt effective hit target: 28pt visible width + 8pt slop L/R.
      // Shrunk from 36pt → 28pt on 2026-04-19 to free 16pt of horizontal
      // space per input-cell so 4-digit + decimal weights (e.g. "102.5",
      // "999.75") render without truncation on iPhone SE. hitSlop bumped
      // to 8pt so the effective tap target stays at the iOS HIG minimum.
      hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      android_disableSound
      style={{
        width: 28,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ opacity: disabled ? 0.4 : 1 }}>
        <Ionicons
          name={direction === 'increment' ? 'add' : 'remove'}
          size={20}
          color={colors.content.muted}
        />
      </View>
    </Pressable>
  );
}

export default React.memo(StepperButtonImpl);
