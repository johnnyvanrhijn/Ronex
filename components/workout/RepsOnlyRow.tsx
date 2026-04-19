/**
 * components/workout/RepsOnlyRow.tsx
 *
 * Set-row for a `reps_only` logging exercise.
 *
 * Canonical columns (headers rendered by ExerciseGroup)
 * -----------------------------------------------------
 *   ×  |  # (set_order)  |  (optional kg [−+])  |  reps [−+]  |  ○
 *
 * Optional kg (weighted bodyweight)
 * ---------------------------------
 *   Per decision 3 (Johnny approved), the `+ kg` hint is ALWAYS subtly
 *   rendered (text-small-caps uppercase text-content-muted). Tapping it
 *   expands an inline kg input to the LEFT of reps — both fields then
 *   share the middle flex with reps. Once expanded for a given row the
 *   toggle becomes "− kg" (tap to collapse back, only valid if kg is
 *   empty). Parent (ExerciseGroup) owns the per-group "kg expanded"
 *   state so once one row expands, the remaining rows in this group
 *   session also render with the kg input visible.
 *
 * Steppers (UX-herziening 2026-04-19 §A)
 * --------------------------------------
 *   - Reps cell: always shows [−] and [+] ghost buttons around the
 *     TextInput, UNLESS `unilateral` is true (see below).
 *   - kg cell: when kgExpanded, also shows [−]/[+] steppers around the
 *     kg TextInput; step is `getWeightStep(equipment)`.
 *   - Unilateral (is_unilateral === true) → NO steppers, numpad-only.
 *     Argumentation: two sets of steppers per unilateral rep-logging row
 *     would be too dense; unilateral bodyweight logging is infrequent
 *     enough that taps-reduction there is secondary. Revisit post-launch.
 *
 * Completion rule
 * ---------------
 *   Circle requires reps > 0. Weight is always optional. This differs
 *   from WeightRepsRow (which requires both).
 *
 * Everything else (long-press edit-mode, × delete cell, ack-flash, dim
 * inputs, lime border, commit Success-haptic, pre-fill pulse) mirrors
 * WeightRepsRow 1:1 for consistency.
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
// wrapped via `Animated.createAnimatedComponent`; applying to a plain
// <TextInput /> throws the "set key `current` with value `undefined` on
// frozen object" error from Reanimated's ref-freeze check in dev.
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
import type { ActiveSet } from '@/types/workout';
import type { Equipment } from '@/lib/queries/useExercises';
import { getWeightStep, REPS_STEP } from '@/lib/exerciseStep';
import StepperButton from './StepperButton';
import type { LastTimeData } from './KeyboardAccessory';

type FocusField = 'weight' | 'reps' | null;

type RepsOnlyRowProps = {
  set: ActiveSet;
  setNumber: number; // 1-based display order within this exercise group.
  active: boolean;
  isInEditMode: boolean;
  /** Parent-owned: whether the optional kg input should be visible for this row. */
  kgExpanded: boolean;
  /** Parent exercise equipment — drives weight-stepper size. */
  equipment: Equipment;
  /** Pulse on mount when the row was prefilled from history/carry-forward. */
  shouldPulseOnMount?: boolean;
  onActivate: () => void;
  onUpdate: (patch: Partial<Omit<ActiveSet, 'localId'>>) => void;
  onRequestDelete: () => void;
  onFocusWeight: () => void; // "I'm lifting again" signal
  onLongPress: () => void; // promote to edit-mode
  /** Tapping `+ kg` / `− kg` lifts state into the parent group. */
  onToggleKg: (next: boolean) => void;
  registerRef?: (ref: RepsOnlyRowHandle | null) => void;
  unilateral?: boolean;
  /** T-211 drop-in: historic last-time data for this (exerciseId, setNumber). */
  lastTime?: LastTimeData | null;
};

export type RepsOnlyRowHandle = {
  focusWeight: () => void;
  focusReps: () => void;
};

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
  return Number.isInteger(w) ? String(w) : String(w);
}

function roundToStep(n: number): number {
  return Math.round(n * 10) / 10;
}

const LONG_PRESS_MS = 500;
const ACK_FLASH_MS = 150;
const DIGIT_FLASH_MS = 150;
const REPS_MAX = 999;
const WEIGHT_MAX = 9999;

function RepsOnlyRowImpl({
  set,
  setNumber,
  active,
  isInEditMode,
  kgExpanded,
  equipment,
  shouldPulseOnMount,
  onActivate,
  onUpdate,
  onRequestDelete,
  onFocusWeight,
  onLongPress,
  onToggleKg,
  registerRef,
  unilateral = false,
  lastTime: _lastTime, // reserved for T-211 keyboard accessory wiring
}: RepsOnlyRowProps) {
  const { t } = useTranslation();

  const weightInputRef = useRef<TextInput>(null);
  const repsInputRef = useRef<TextInput>(null);

  const [weightText, setWeightText] = useState(formatWeight(set.weightKg));
  const [repsText, setRepsText] = useState(set.reps == null ? '' : String(set.reps));
  const [focusField, setFocusField] = useState<FocusField>(null);

  const weightStep = useMemo(() => getWeightStep(equipment), [equipment]);

  useEffect(() => {
    setWeightText(formatWeight(set.weightKg));
  }, [set.weightKg]);
  useEffect(() => {
    setRepsText(set.reps == null ? '' : String(set.reps));
  }, [set.reps]);

  useEffect(() => {
    if (!registerRef) return;
    const handle: RepsOnlyRowHandle = {
      focusWeight: () => weightInputRef.current?.focus(),
      focusReps: () => repsInputRef.current?.focus(),
    };
    registerRef(handle);
    return () => registerRef(null);
  }, [registerRef]);

  // ─── Edit-mode animations (identical semantics to WeightRepsRow) ────
  const closeOpacity = useSharedValue(isInEditMode ? 1 : 0.25);
  const dangerMix = useSharedValue(isInEditMode ? 1 : 0);
  const inputOpacity = useSharedValue(isInEditMode ? 0.6 : 1);
  const closeScale = useSharedValue(1);

  // Pre-fill pulse.
  const prefillPulse = useSharedValue(0);
  const prefillFiredRef = useRef(false);

  // Middle-digit flash values.
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

  const rowBackgroundAnimStyle = useAnimatedStyle(() => {
    const baseColor =
      set.completed || !active ? 'rgba(0,0,0,0)' : colors.surface.DEFAULT;
    const pulseColor = 'rgba(34,197,94,0.15)';
    return {
      backgroundColor: interpolateColor(
        prefillPulse.value,
        [0, 1],
        [baseColor, pulseColor],
      ),
    };
  });

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

  // ─── Handlers ──────────────────────────────────────────────────────
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

  // Stepper handlers (suppressed for unilateral; see prop wiring below).
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

  const currentWeight = parseWeight(weightText) ?? set.weightKg ?? 0;
  const currentReps = parseReps(repsText) ?? set.reps ?? 0;
  const weightDecrementDisabled = currentWeight <= 0;
  const weightIncrementDisabled = currentWeight + weightStep > WEIGHT_MAX;
  const repsDecrementDisabled = currentReps <= 0;
  const repsIncrementDisabled = currentReps + REPS_STEP > REPS_MAX;

  // Steppers suppressed when unilateral (see module doc).
  const showSteppers = !unilateral;

  // Completion rule: reps > 0 is the ONLY requirement. Weight is
  // always optional for reps_only (weighted bodyweight is additive
  // context, not part of the completion gate).
  const canComplete = set.reps !== null && set.reps > 0;

  const handleToggleComplete = () => {
    if (!set.completed && !canComplete) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      repsInputRef.current?.focus();
      return;
    }
    // UX-herziening §E: Success-haptic on commit.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onUpdate({ completed: !set.completed });
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

  const handleToggleKgTap = () => {
    if (kgExpanded && set.weightKg !== null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.selectionAsync();
    onToggleKg(!kgExpanded);
  };

  const textColor = set.completed ? 'text-content-secondary' : 'text-content';
  const borderColor = isInEditMode ? colors.primary.DEFAULT : 'transparent';

  // Helper: render a numeric input cell with optional stepper brackets.
  // Keeps the JSX in the main render blocks readable.
  const renderInputCell = (opts: {
    inputRef: React.RefObject<TextInput | null>;
    value: string;
    onChangeText: (raw: string) => void;
    onFocus: () => void;
    kind: 'weight' | 'reps';
    placeholder: string;
    showStep: boolean;
    decrement: () => void;
    increment: () => void;
    decrementDisabled: boolean;
    incrementDisabled: boolean;
    accessibilityLabel: string;
    keyboardType: 'decimal-pad' | 'number-pad';
    inputMode: 'decimal' | 'numeric';
    digitStyle: ReturnType<typeof useAnimatedStyle>;
  }) => (
    <Animated.View
      className="flex-1 flex-row items-center px-1"
      style={inputsDimStyle}
    >
      {opts.showStep && (
        <StepperButton
          direction="decrement"
          onStep={opts.decrement}
          disabled={opts.decrementDisabled || isInEditMode}
          accessibilityLabel={
            opts.kind === 'weight'
              ? t('workout.decrementWeight')
              : t('workout.decrementReps')
          }
        />
      )}
      <View className="flex-1 h-11 items-center justify-center rounded-input bg-surface-elevated">
        <AnimatedTextInput
          ref={opts.inputRef}
          value={opts.value}
          onChangeText={opts.onChangeText}
          onFocus={opts.onFocus}
          onBlur={handleBlur}
          keyboardType={opts.keyboardType}
          inputMode={opts.inputMode}
          returnKeyType={opts.kind === 'weight' ? 'next' : 'done'}
          placeholder={opts.placeholder}
          placeholderTextColor={colors.content.muted}
          style={[
            {
              width: '100%',
              textAlign: 'center',
              fontFamily: 'Inter_600SemiBold',
              fontSize: 16,
              lineHeight: 24,
            },
            // useAnimatedStyle's return type is a ViewStyle-flavored
            // DefaultStyle. TypeScript can't narrow it to AnimatedTextInput's
            // TextStyle-flavored prop type. AnimatedTextInput accepts the
            // style at runtime (it's what makes the color interpolation work)
            // so the cast is safe; TS just can't see through Reanimated's
            // type abstraction.
            opts.digitStyle as any,
          ]}
          accessibilityLabel={opts.accessibilityLabel}
        />
      </View>
      {opts.showStep && (
        <StepperButton
          direction="increment"
          onStep={opts.increment}
          disabled={opts.incrementDisabled || isInEditMode}
          accessibilityLabel={
            opts.kind === 'weight'
              ? t('workout.incrementWeight')
              : t('workout.incrementReps')
          }
        />
      )}
    </Animated.View>
  );

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
          {/* Close (×) cell */}
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

          {kgExpanded &&
            renderInputCell({
              inputRef: weightInputRef,
              value: weightText,
              onChangeText: handleWeightChange,
              onFocus: handleFocusWeight,
              kind: 'weight',
              placeholder: '0',
              showStep: showSteppers,
              decrement: handleWeightDecrement,
              increment: handleWeightIncrement,
              decrementDisabled: weightDecrementDisabled,
              incrementDisabled: weightIncrementDisabled,
              accessibilityLabel: t('workout.weight'),
              keyboardType: 'decimal-pad',
              inputMode: 'decimal',
              digitStyle: weightDigitStyle,
            })}

          {renderInputCell({
            inputRef: repsInputRef,
            value: repsText,
            onChangeText: handleRepsChange,
            onFocus: handleFocusReps,
            kind: 'reps',
            placeholder: '0',
            showStep: showSteppers,
            decrement: handleRepsDecrement,
            increment: handleRepsIncrement,
            decrementDisabled: repsDecrementDisabled,
            incrementDisabled: repsIncrementDisabled,
            accessibilityLabel: t('workout.reps'),
            keyboardType: 'number-pad',
            inputMode: 'numeric',
            digitStyle: repsDigitStyle,
          })}

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
                    : canComplete
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

        {/* +/− kg toggle hint. Always rendered (subtle) per decision 3. */}
        <Pressable
          onPress={handleToggleKgTap}
          hitSlop={{ top: 6, bottom: 10, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t(
            kgExpanded ? 'workout.removeWeightToggle' : 'workout.addWeightToggle',
          )}
          style={{ paddingLeft: 72, paddingTop: 2, paddingBottom: 6 }}
        >
          <Text className="text-small-caps uppercase text-content-muted">
            {kgExpanded
              ? t('workout.removeWeightToggle')
              : t('workout.addWeightToggle')}
          </Text>
        </Pressable>
      </Pressable>

      {focusField !== null && set.completed && (
        <View className="absolute right-16 top-1/2 -mt-2">
          <Ionicons name="pencil-outline" size={14} color={colors.content.muted} />
        </View>
      )}
    </Animated.View>
  );
}

export default React.memo(RepsOnlyRowImpl);
