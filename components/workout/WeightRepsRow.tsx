/**
 * components/workout/WeightRepsRow.tsx
 *
 * One set-row for a `weight_reps`-logging exercise.
 *
 * Columns
 * -------
 *   ×  |  # (set_order)  |  kg input [− value +]  |  reps input [− value +]  |  ○
 *
 *   The leading × is a dedicated close-cell (not merged into the number
 *   column). 16pt icon, 25% muted opacity at rest, 44pt hitSlop so
 *   sweaty-finger taps always land. Long-press on the row promotes it
 *   into edit-mode: the × goes red + 100% opacity, the kg/reps inputs
 *   dim to 60%, and a lime 1px border outlines the row. A tap on the
 *   red × then deletes the set; a tap anywhere else cancels edit-mode.
 *
 * Inline steppers (UX-herziening 2026-04-19 §A)
 * ---------------------------------------------
 *   Each numeric input cell hosts its own [−] and [+] ghost buttons,
 *   36pt wide each, bracketing the central TextInput. Taps step by:
 *     - weight: `getWeightStep(exercise.equipment)` kg (2.5 for barbell/
 *       smith_machine, 1 for everything else)
 *     - reps:   `REPS_STEP` = 1
 *   Long-press auto-repeats at 8 ticks/sec after a 400ms initial delay
 *   (see StepperButton). Haptic every 4 ticks so the stutter-feedback
 *   is perceptible without being buzzy.
 *   Single-tap has NO haptic — the middle digit flashes lime (150ms)
 *   instead, which is quieter visual acknowledgement.
 *
 * Visual states
 * -------------
 *   active     — currently-focused row: lime dot prefix on the number
 *                column. Subtle surface background so it reads "next up".
 *   logged     — `completed === true`: muted text. Tap a value to re-edit.
 *   idle       — placeholder row, not yet active and not yet logged.
 *   edit-mode  — long-press armed. Red × + dimmed inputs + lime border.
 *                Exits on successful delete, on a tap outside the row
 *                (handled by parent), or when another row is long-pressed.
 *   prefill-pulse — row background pulses `primary/15%` for 400ms on
 *                first-ever mount if the caller marked the row as
 *                pre-filled-from-history (shouldPulseOnMount). Fire-once
 *                per row via a useRef guard.
 *
 * Hybrid logging flow (per spec)
 * ------------------------------
 *   Flow A: tap kg → type → keyboard "Next" → type reps → keyboard
 *           "Done" → auto-log (flip the circle, Success haptic).
 *   Flow B: tap kg → type → tap reps → type → tap circle → log.
 *   Flow C (new, stepper): tap [+] on kg → tap [+] on reps → tap circle.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import Animated, {
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { colors } from '@/lib/theme';

// Reanimated's useAnimatedStyle results can only be applied to components
// wrapped via `Animated.createAnimatedComponent` — applying them to a plain
// RN <TextInput /> throws "You attempted to set the key `current` with the
// value `undefined` on an object that is meant to be immutable and has been
// frozen" from Reanimated's internal ref-freeze check. Created once at
// module level (Reanimated docs recommend — creating inside the component
// body would bypass the animated-node caching).
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
import type { ActiveSet } from '@/types/workout';
import type { Equipment } from '@/lib/queries/useExercises';
import { getWeightStep, REPS_STEP } from '@/lib/exerciseStep';
import StepperButton from './StepperButton';

type FocusField = 'weight' | 'reps' | null;

type WeightRepsRowProps = {
  set: ActiveSet;
  setNumber: number; // 1-based display order within this exercise group.
  active: boolean;
  isInEditMode: boolean;
  /** Equipment of the parent exercise — drives weight-stepper size. */
  equipment: Equipment;
  /**
   * True if this row was just spawned with pre-filled values from either
   * historic data (set 1) or carry-forward (sets 2+). Triggers a one-shot
   * 400ms background pulse on mount so the user notices the values were
   * suggested-not-typed. Guarded by useRef so re-renders don't replay it.
   */
  shouldPulseOnMount?: boolean;
  onActivate: () => void;
  onUpdate: (patch: Partial<Omit<ActiveSet, 'localId'>>) => void;
  onRequestDelete: () => void;
  onFocusWeight: () => void; // fires the "I'm lifting again" signal
  onLongPress: () => void; // promote this row into edit-mode
  registerRef?: (ref: WeightRepsRowHandle | null) => void;
};

export type WeightRepsRowHandle = {
  focusWeight: () => void;
  focusReps: () => void;
};

/**
 * Parse a numpad string into a number. Accepts both '.' and ',' as
 * decimal separators (NL keyboard sends ',' on some devices).
 */
function parseWeight(raw: string): number | null {
  if (!raw) return null;
  const normalized = raw.replace(',', '.');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseReps(raw: string): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatWeight(w: number | null): string {
  if (w == null) return '';
  // Avoid trailing `.0`: 82.5 → "82.5", 82 → "82".
  return Number.isInteger(w) ? String(w) : String(w);
}

/** Round a stepped weight to one decimal to avoid 2.5+2.5+2.5 drifting into
 *  floating-point noise (7.500000000000001 etc). */
function roundToStep(n: number): number {
  return Math.round(n * 10) / 10;
}

// Long-press delay: iOS HIG default is ~500ms. Short enough to feel
// responsive, long enough that scroll/tap never accidentally triggers.
const LONG_PRESS_MS = 500;

// Tap-acknowledge window on the × icon: flash full-opacity for this
// many ms before the row starts its fade-out. Gives the user a visual
// confirmation that their tap registered.
const ACK_FLASH_MS = 150;

// Pre-fill pulse: 400ms total (UX-herziening §5) — acknowledgment, not
// showcase. Peak at 150ms, 100ms hold, 150ms fade-out.
const PREFILL_PULSE_MS = 400;

// Middle-digit flash on stepper tap.
const DIGIT_FLASH_MS = 150;

// Reps ceiling per schema constraint (workout_sets.reps CHECK 1-999).
const REPS_MAX = 999;
// Weight ceiling per schema constraint (workout_sets.weight_kg 0-9999).
const WEIGHT_MAX = 9999;

function WeightRepsRowImpl({
  set,
  setNumber,
  active,
  isInEditMode,
  equipment,
  shouldPulseOnMount,
  onActivate,
  onUpdate,
  onRequestDelete,
  onFocusWeight,
  onLongPress,
  registerRef,
}: WeightRepsRowProps) {
  const { t } = useTranslation();

  const weightInputRef = useRef<TextInput>(null);
  const repsInputRef = useRef<TextInput>(null);

  const [weightText, setWeightText] = useState(formatWeight(set.weightKg));
  const [repsText, setRepsText] = useState(set.reps == null ? '' : String(set.reps));
  const [focusField, setFocusField] = useState<FocusField>(null);

  // Equipment-aware step sizes. Memoized so switches on equipment don't
  // repeatedly recompute; cheap but polite.
  const weightStep = useMemo(() => getWeightStep(equipment), [equipment]);

  // Keep local text in sync when the underlying set is replaced (e.g.
  // undo via an external reset, OR carry-forward prefill from parent).
  useEffect(() => {
    setWeightText(formatWeight(set.weightKg));
  }, [set.weightKg]);
  useEffect(() => {
    setRepsText(set.reps == null ? '' : String(set.reps));
  }, [set.reps]);

  // Expose imperative focus handles to the parent (for auto-focusing
  // the kg input after the picker returns).
  useEffect(() => {
    if (!registerRef) return;
    const handle: WeightRepsRowHandle = {
      focusWeight: () => weightInputRef.current?.focus(),
      focusReps: () => repsInputRef.current?.focus(),
    };
    registerRef(handle);
    return () => registerRef(null);
  }, [registerRef]);

  // ─── Animated values ─────────────────────────────────────────────────
  const closeOpacity = useSharedValue(isInEditMode ? 1 : 0.25);
  const dangerMix = useSharedValue(isInEditMode ? 1 : 0);
  const inputOpacity = useSharedValue(isInEditMode ? 0.6 : 1);
  const closeScale = useSharedValue(1);

  // Pre-fill pulse: a 0→1→0 progress shared value. The row-background
  // animated style interpolates from transparent surface to lime-tinted
  // surface as `prefillPulse` rises.
  const prefillPulse = useSharedValue(0);
  const prefillFiredRef = useRef(false);

  // Middle-digit flash values (one per input cell). 0 = default color,
  // 1 = full lime. We animate `1 → 0` on each stepper tap.
  const weightDigitFlash = useSharedValue(0);
  const repsDigitFlash = useSharedValue(0);

  useEffect(() => {
    closeOpacity.value = withTiming(isInEditMode ? 1 : 0.25, {
      duration: ACK_FLASH_MS,
      easing: Easing.out(Easing.quad),
    });
    dangerMix.value = withTiming(isInEditMode ? 1 : 0, {
      duration: ACK_FLASH_MS,
      easing: Easing.out(Easing.quad),
    });
    inputOpacity.value = withTiming(isInEditMode ? 0.6 : 1, {
      duration: ACK_FLASH_MS,
      easing: Easing.out(Easing.quad),
    });
  }, [isInEditMode, closeOpacity, dangerMix, inputOpacity]);

  // Fire-once pre-fill pulse on mount (if the caller asked for it AND we
  // haven't already fired). Pulse: 150ms up, 100ms hold, 150ms down.
  useEffect(() => {
    if (!shouldPulseOnMount) return;
    if (prefillFiredRef.current) return;
    prefillFiredRef.current = true;
    prefillPulse.value = withSequence(
      withTiming(1, { duration: 150, easing: Easing.inOut(Easing.quad) }),
      withDelay(100, withTiming(0, { duration: 150, easing: Easing.inOut(Easing.quad) })),
    );
  }, [shouldPulseOnMount, prefillPulse]);

  const closeIconMutedStyle = useAnimatedStyle(() => ({
    opacity: closeOpacity.value * (1 - dangerMix.value),
    transform: [{ scale: closeScale.value }],
  }));
  const closeIconDangerStyle = useAnimatedStyle(() => ({
    opacity: closeOpacity.value * dangerMix.value,
    transform: [{ scale: closeScale.value }],
  }));
  const inputsDimStyle = useAnimatedStyle(() => ({
    opacity: inputOpacity.value,
  }));

  // Row background: solid surface when active, transparent otherwise.
  // Pre-fill pulse layers on top via interpolation to a lime-tinted
  // version. We compute the "base" color outside the animated style so
  // we only interpolate the pulse axis.
  const rowBackgroundAnimStyle = useAnimatedStyle(() => {
    // Base = transparent when completed or idle, surface when active.
    // We interpolate to primary-tinted surface (rgba lime 15%) at peak.
    const baseColor =
      set.completed || !active ? 'rgba(0,0,0,0)' : colors.surface.DEFAULT;
    const pulseColor = 'rgba(34,197,94,0.15)'; // colors.primary.DEFAULT @ 15%
    return {
      backgroundColor: interpolateColor(
        prefillPulse.value,
        [0, 1],
        [baseColor, pulseColor],
      ),
    };
  });

  // Middle-digit animated text colors. Interpolate from default text
  // color to lime, then back. Returning `color` from useAnimatedStyle
  // works on Text nodes because Reanimated v3 supports color props.
  const weightDigitStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      weightDigitFlash.value,
      [0, 1],
      [
        set.completed ? colors.content.secondary : colors.content.DEFAULT,
        colors.primary.DEFAULT,
      ],
    ),
  }));
  const repsDigitStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      repsDigitFlash.value,
      [0, 1],
      [
        set.completed ? colors.content.secondary : colors.content.DEFAULT,
        colors.primary.DEFAULT,
      ],
    ),
  }));

  // ─── Handlers ───────────────────────────────────────────────────────
  const handleWeightChange = (raw: string) => {
    const filtered = raw.replace(/[^0-9.,]/g, '');
    setWeightText(filtered);
    onUpdate({ weightKg: parseWeight(filtered) });
  };

  const handleRepsChange = (raw: string) => {
    const filtered = raw.replace(/[^0-9]/g, '');
    setRepsText(filtered);
    onUpdate({ reps: parseReps(filtered) });
  };

  const handleFocusWeight = () => {
    setFocusField('weight');
    onActivate();
    onFocusWeight();
  };

  const handleFocusReps = () => {
    setFocusField('reps');
    onActivate();
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (
        !weightInputRef.current?.isFocused() &&
        !repsInputRef.current?.isFocused()
      ) {
        setFocusField(null);
      }
    }, 0);
  };

  // Stepper handlers. Each one: clamp to bounds, update store + local text,
  // flash the middle digit lime for 150ms. No haptic here (per UX spec).
  const stepWeightBy = useCallback(
    (delta: number) => {
      const current = parseWeight(weightText) ?? set.weightKg ?? 0;
      const next = Math.max(0, Math.min(WEIGHT_MAX, roundToStep(current + delta)));
      setWeightText(formatWeight(next));
      onUpdate({ weightKg: next });
      weightDigitFlash.value = withSequence(
        withTiming(1, { duration: 60, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: DIGIT_FLASH_MS - 60, easing: Easing.in(Easing.quad) }),
      );
      // Activate the row so the active-state coordination picks this up
      // (the user is now "working this row", mirrors focus-input behavior).
      onActivate();
    },
    [weightText, set.weightKg, onUpdate, weightDigitFlash, onActivate],
  );

  const stepRepsBy = useCallback(
    (delta: number) => {
      const current = parseReps(repsText) ?? set.reps ?? 0;
      const next = Math.max(0, Math.min(REPS_MAX, current + delta));
      setRepsText(next === 0 ? '' : String(next));
      onUpdate({ reps: next === 0 ? null : next });
      repsDigitFlash.value = withSequence(
        withTiming(1, { duration: 60, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: DIGIT_FLASH_MS - 60, easing: Easing.in(Easing.quad) }),
      );
      onActivate();
    },
    [repsText, set.reps, onUpdate, repsDigitFlash, onActivate],
  );

  const handleWeightIncrement = useCallback(() => stepWeightBy(weightStep), [stepWeightBy, weightStep]);
  const handleWeightDecrement = useCallback(() => stepWeightBy(-weightStep), [stepWeightBy, weightStep]);
  const handleRepsIncrement = useCallback(() => stepRepsBy(REPS_STEP), [stepRepsBy]);
  const handleRepsDecrement = useCallback(() => stepRepsBy(-REPS_STEP), [stepRepsBy]);

  // Bounds-awareness for the stepper buttons — they render disabled when
  // the next step would cross the schema constraint.
  const currentWeight = parseWeight(weightText) ?? set.weightKg ?? 0;
  const currentReps = parseReps(repsText) ?? set.reps ?? 0;
  const weightDecrementDisabled = currentWeight <= 0;
  const weightIncrementDisabled = currentWeight + weightStep > WEIGHT_MAX;
  const repsDecrementDisabled = currentReps <= 0;
  const repsIncrementDisabled = currentReps + REPS_STEP > REPS_MAX;

  const hasBothValues =
    set.weightKg !== null && set.weightKg >= 0 && set.reps !== null && set.reps > 0;

  const handleToggleComplete = () => {
    if (!set.completed && !hasBothValues) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      weightInputRef.current?.focus();
      return;
    }
    const next = !set.completed;
    // UX-herziening §E: Success-haptic on commit (was selectionAsync),
    // consistent with the PR-celebration haptic pattern (T-215).
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onUpdate({ completed: next });
  };

  const handleDeletePress = useCallback(() => {
    Haptics.selectionAsync();
    closeScale.value = withSequence(
      withTiming(0.95, { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) }),
    );
    closeOpacity.value = withTiming(1, { duration: ACK_FLASH_MS });
    setTimeout(onRequestDelete, ACK_FLASH_MS);
  }, [closeOpacity, closeScale, onRequestDelete]);

  const handleLongPress = useCallback(() => {
    if (isInEditMode) return;
    Haptics.selectionAsync();
    onLongPress();
  }, [isInEditMode, onLongPress]);

  // Row text color applies to the # column and (as base) to the middle
  // digit before the animated color override kicks in.
  const textColor = set.completed ? 'text-content-secondary' : 'text-content';
  const borderColor = isInEditMode ? colors.primary.DEFAULT : 'transparent';

  return (
    <Animated.View
      layout={LinearTransition.duration(200)}
      exiting={FadeOut.duration(200)}
      className="relative"
    >
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={LONG_PRESS_MS}
        android_disableSound
      >
        <Animated.View
          className="flex-row items-center rounded-input px-1"
          style={[
            {
              minHeight: 56,
              borderWidth: 1,
              borderColor,
            },
            rowBackgroundAnimStyle,
          ]}
        >
          {/* Close (×) cell ------------------------------------------ */}
          <Pressable
            onPress={handleDeletePress}
            hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
            className="h-11 items-center justify-center"
            style={{ width: 28, marginRight: 12 }}
          >
            <Animated.View
              style={[{ position: 'absolute' }, closeIconMutedStyle]}
            >
              <Ionicons name="close" size={16} color={colors.content.muted} />
            </Animated.View>
            <Animated.View
              style={[{ position: 'absolute' }, closeIconDangerStyle]}
            >
              <Ionicons name="close" size={16} color={colors.danger} />
            </Animated.View>
          </Pressable>

          {/* # column */}
          <View className="w-8 flex-row items-center justify-center">
            {active && (
              <View
                className="bg-primary"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  marginRight: 4,
                }}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            )}
            <Text className={`font-inter text-body ${textColor}`}>
              {setNumber}
            </Text>
          </View>

          {/* kg cell: [−] [TextInput] [+] */}
          <Animated.View
            className="flex-1 flex-row items-center px-1"
            style={inputsDimStyle}
          >
            <StepperButton
              direction="decrement"
              onStep={handleWeightDecrement}
              disabled={weightDecrementDisabled || isInEditMode}
              accessibilityLabel={t('workout.decrementWeight')}
            />
            <View
              className="flex-1 h-11 items-center justify-center rounded-input bg-surface-elevated"
            >
              <AnimatedTextInput
                ref={weightInputRef}
                value={weightText}
                onChangeText={handleWeightChange}
                onFocus={handleFocusWeight}
                onBlur={handleBlur}
                keyboardType="decimal-pad"
                inputMode="decimal"
                returnKeyType="next"
                placeholder="0"
                placeholderTextColor={colors.content.muted}
                style={[
                  {
                    width: '100%',
                    textAlign: 'center',
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 16,
                    lineHeight: 24,
                  },
                  weightDigitStyle,
                ]}
                accessibilityLabel={t('workout.weight')}
              />
            </View>
            <StepperButton
              direction="increment"
              onStep={handleWeightIncrement}
              disabled={weightIncrementDisabled || isInEditMode}
              accessibilityLabel={t('workout.incrementWeight')}
            />
          </Animated.View>

          {/* reps cell: [−] [TextInput] [+] */}
          <Animated.View
            className="flex-1 flex-row items-center px-1"
            style={inputsDimStyle}
          >
            <StepperButton
              direction="decrement"
              onStep={handleRepsDecrement}
              disabled={repsDecrementDisabled || isInEditMode}
              accessibilityLabel={t('workout.decrementReps')}
            />
            <View
              className="flex-1 h-11 items-center justify-center rounded-input bg-surface-elevated"
            >
              <AnimatedTextInput
                ref={repsInputRef}
                value={repsText}
                onChangeText={handleRepsChange}
                onFocus={handleFocusReps}
                onBlur={handleBlur}
                keyboardType="number-pad"
                inputMode="numeric"
                returnKeyType="done"
                placeholder="0"
                placeholderTextColor={colors.content.muted}
                style={[
                  {
                    width: '100%',
                    textAlign: 'center',
                    fontFamily: 'Inter_600SemiBold',
                    fontSize: 16,
                    lineHeight: 24,
                  },
                  repsDigitStyle,
                ]}
                accessibilityLabel={t('workout.reps')}
              />
            </View>
            <StepperButton
              direction="increment"
              onStep={handleRepsIncrement}
              disabled={repsIncrementDisabled || isInEditMode}
              accessibilityLabel={t('workout.incrementReps')}
            />
          </Animated.View>

          {/* Complete-circle column */}
          <View className="w-12 items-center">
            <Pressable
              onPress={handleToggleComplete}
              className="h-11 w-11 items-center justify-center"
              hitSlop={4}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: set.completed }}
              accessibilityLabel={t('workout.logSet')}
            >
              <View
                className={`h-8 w-8 items-center justify-center rounded-pill ${
                  set.completed
                    ? 'bg-primary'
                    : hasBothValues
                      ? 'border-2 border-primary'
                      : 'border-2 border-surface-elevated'
                }`}
              >
                {set.completed && (
                  <Ionicons name="checkmark" size={18} color={colors.background} />
                )}
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>

      {/* Edit-pencil hint, only when an input is focused on a logged row. */}
      {focusField !== null && set.completed && (
        <View className="absolute right-16 top-1/2 -mt-2">
          <Ionicons
            name="pencil-outline"
            size={14}
            color={colors.content.muted}
          />
        </View>
      )}
    </Animated.View>
  );
}

export default React.memo(WeightRepsRowImpl);
