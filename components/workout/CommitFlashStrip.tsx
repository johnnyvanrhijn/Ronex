/**
 * components/workout/CommitFlashStrip.tsx
 *
 * Transient lime small-caps banner shown just above the keyboard after the
 * user commits a set (taps the complete-circle). Reads like:
 *   "SET 2 VASTGELEGD · 82.5KG × 8"
 *
 * Lifecycle
 * ---------
 *   - Parent owns a local `{ visible: boolean, message: string }` state
 *     and toggles it from ExerciseGroup's commit-detect callback.
 *   - Component auto-hides after 1.2s from the moment `message` lands
 *     (fade-in 150ms, hold, fade-out 200ms). Parent receives `onHide`
 *     callback to reset its state when the fade-out finishes so the
 *     next commit can re-trigger a fresh fade.
 *   - Height 28pt. Positioned by the parent; in `app/workout/active.tsx`
 *     this lives inside the KeyboardAvoidingView, pinned just above the
 *     floating Finish CTA, so on iOS the OS keyboard lifts both.
 *
 * Deliberate scope boundaries
 * ---------------------------
 *   - This is NOT the T-208/T-211 `KeyboardAccessory` (a persistent bar
 *     with last-time hint + Next/Done). That stays deferred per T-211b.
 *     The CommitFlashStrip is standalone, transient, no-interaction.
 *   - No haptic fires from here — the row's complete-circle already
 *     triggers `Haptics.notificationAsync(Success)` (UX-herziening §E).
 *   - Not accessible via screen-tap (no Pressable). If the user needs to
 *     review values, they edit the row directly.
 *
 * Content formatting is the parent's job — the strip just renders the
 * already-formatted string. See `formatCommitSummary()` below for the
 * canonical formatter, exported for use in ExerciseGroup.
 */

import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import type { ActiveSet } from '@/types/workout';
import type { LoggingType } from '@/lib/queries/useExercises';
import { formatSeconds } from './TimeSecondsRow';

type CommitFlashStripProps = {
  visible: boolean;
  message: string | null;
  onHide: () => void;
};

const FADE_IN_MS = 150;
const HOLD_MS = 850;
const FADE_OUT_MS = 200;
const TOTAL_MS = FADE_IN_MS + HOLD_MS + FADE_OUT_MS; // 1200ms total

/**
 * Build the summary string for a just-committed set. Pure + exported so
 * ExerciseGroup can compose the translation key template with the right
 * summary without leaking logging-type branching into the strip itself.
 *
 * Shape examples:
 *   weight_reps          → "82.5kg × 8"
 *   reps_only (no kg)    → "12 reps"
 *   reps_only (with kg)  → "10kg × 8"
 *   time_seconds         → "1:15"
 */
export function formatCommitSummary(
  set: ActiveSet,
  loggingType: LoggingType,
): string {
  switch (loggingType) {
    case 'weight_reps':
    case 'distance_weight': {
      const w = set.weightKg ?? 0;
      const r = set.reps ?? 0;
      const wStr = Number.isInteger(w) ? `${w}` : `${w}`;
      return `${wStr}kg × ${r}`;
    }
    case 'reps_only': {
      const r = set.reps ?? 0;
      if (set.weightKg !== null && set.weightKg > 0) {
        const w = set.weightKg;
        const wStr = Number.isInteger(w) ? `${w}` : `${w}`;
        return `${wStr}kg × ${r}`;
      }
      return `${r} reps`;
    }
    case 'time_seconds': {
      return formatSeconds(set.seconds);
    }
    default:
      return '';
  }
}

function CommitFlashStripImpl({ visible, message, onHide }: CommitFlashStripProps) {
  const { t: _t } = useTranslation();
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible && message) {
      // Orchestrate fade-in → hold → fade-out.
      // We use `withSequence` rather than chained `withTiming(..., cb)` so the
      // entire animation lives on the UI thread without JS callbacks between
      // phases. Only the final completion callback calls back into JS via
      // runOnJS to clear the parent's state.
      opacity.value = withSequence(
        withTiming(1, {
          duration: FADE_IN_MS,
          easing: Easing.out(Easing.quad),
        }),
        withDelay(
          HOLD_MS,
          withTiming(
            0,
            { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) },
            (finished) => {
              if (finished) {
                runOnJS(onHide)();
              }
            },
          ),
        ),
      );
    } else {
      opacity.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, message]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={animatedStyle}
      className="items-center justify-center"
    >
      <View
        className="h-7 items-center justify-center px-3"
        accessibilityRole="alert"
        accessibilityLabel={message}
      >
        <Text className="text-small-caps uppercase text-primary">{message}</Text>
      </View>
    </Animated.View>
  );
}

export default React.memo(CommitFlashStripImpl);

// Expose timing for callers that need to know the total duration (e.g. to
// debounce consecutive commits). Not currently used but cheap to export.
export const COMMIT_FLASH_TOTAL_MS = TOTAL_MS;
