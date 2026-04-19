/**
 * components/workout/TimeSecondsRow.tsx
 *
 * Set-row for a `time_seconds` logging exercise.
 *
 * Canonical columns (headers rendered by ExerciseGroup)
 * -----------------------------------------------------
 *   ×  |  # (set_order)  |  seconds-input + ⏱ helper (flex-1)  |  ○
 *
 * Redesign (2026-04-19, Johnny-approved mockup)
 * ---------------------------------------------
 *   The 2026-04-18 spec wrapped the whole middle column in a
 *   stopwatch — a Start/Stop/Reset context-swap button, a readout-as-
 *   tappable-manual-entry trick, and a hidden overlay. User feedback:
 *   the stopwatch dominated a column that's primarily for data entry.
 *   Most users already time with a wall clock, Apple Watch, or a
 *   remembered target ("hold a plank for 45 seconds") — they want to
 *   type the number, not run a stopwatch.
 *
 *   New model: the numeric seconds input is the PRIMARY control
 *   (mirrors reps input in `RepsOnlyRow`). The stopwatch is a
 *   tertiary helper-affordance: a compact ⏱ icon-button to the right
 *   of the input. `= m:ss` renders below the row as a small-caps
 *   muted helper label — automatic, no user action needed — so
 *   users see `75` they typed AND `= 1:15` for quick sanity.
 *
 * Interaction phases
 * ------------------
 *   idle       [input: type seconds] [⏱ icon-button]
 *                                      └─ tap → stopwatch starts,
 *                                         input morphs into live
 *                                         tabular-nums readout.
 *
 *   running    [input: live 0:37 readout (read-only)] [STOP button]
 *                                                      └─ tap = stop,
 *                                                         long-press
 *                                                         = cancel.
 *              + small-caps hint underneath:
 *                "tap = stop · lang ingedrukt = annuleer"
 *
 *   After Stop: NON-DESTRUCTIVE MERGE
 *   --------------------------------
 *     If the user tapped the (read-only) live readout during running
 *     and typed a value OR had already typed a value before starting
 *     the stopwatch → that manual value wins. The stopwatch elapsed
 *     time is discarded silently. Manual input = deliberate intent
 *     (they may have timed with Apple Watch and are logging the
 *     remembered number, while the in-app stopwatch ran in parallel
 *     as a backup).
 *
 *     If the user had NOT typed anything (input is blank or 0) →
 *     the stopwatch elapsed populates the input field as expected.
 *
 *     No modal, no confirm, no toast — silent and frictionless.
 *     Asymmetric but correct: manual intent > automated observation.
 *
 *   Cancel gesture
 *   --------------
 *     Chose LONG-PRESS-to-cancel over double-tap (Johnny's options).
 *     Rationale: during a hard plank/hold the user's hand is
 *     shaking; double-tap has a non-trivial accidental-cancel risk
 *     on a compact icon. Long-press is by definition deliberate.
 *     Trade-off: discoverability. Mitigated with a small-caps hint
 *     underneath the running button ("tap = stop · lang ingedrukt
 *     = annuleer"). The hint auto-hides the moment the stopwatch
 *     stops — never clutters idle state.
 *
 * Unilateral (L/R)
 * ----------------
 *   TWO inputs side-by-side (not a single-toggle + one input —
 *   Johnny's clarified mockup). A shared ⏱ button dispatches to the
 *   last-focused side; defaults to L if neither has been focused
 *   yet in this session. Raw L/R times are written into
 *   `set.notes` as `{"l":45,"r":42}`; the aggregate `set.seconds`
 *   is `max(L, R)` (faster-side dominates, same policy as Fase 2).
 *   Helper label renders as `= 0:45 · 0:42` when both sides are
 *   populated, `= 0:45 · —` when only one side is filled.
 *
 * Ephemeral-state boundary
 * ------------------------
 *   Running stopwatch state (isRunning, startEpoch, elapsed ticks,
 *   manual-typed-during-run buffer) lives LOCAL to this component —
 *   NOT persisted to the zustand store. The store is only written on
 *   Stop (or when the user blurs a manually-typed input). Rationale:
 *   a running timer is UI-ephemeral; re-opening the screen should
 *   show the last logged value, not a still-ticking counter.
 *
 * Rest-timer integration
 * ----------------------
 *   Completing a time_seconds set flips the circle → ExerciseGroup
 *   detects the false→true transition and starts rest (same policy
 *   as WeightRepsRow). We do NOT start rest on Stop alone — the
 *   user may re-attempt. Rest only kicks in on the "commit"
 *   gesture (circle tap). Focusing the seconds input fires
 *   `onFocusWeight` (the "I'm lifting again" signal, uniform across
 *   all three row variants).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import type { ActiveSet } from '@/types/workout';
import type { LastTimeData } from './KeyboardAccessory';

type TimeSecondsRowProps = {
  set: ActiveSet;
  setNumber: number;
  active: boolean;
  isInEditMode: boolean;
  /** UX-herziening 2026-04-19 §B: pulse on mount when the row was prefilled
   *  from history / carry-forward. TimeSecondsRow does NOT render steppers
   *  (decision 4: stopwatch is primary, +/-5s would compete), but the pulse
   *  still applies so the user notices the seconds were suggested. */
  shouldPulseOnMount?: boolean;
  onActivate: () => void;
  onUpdate: (patch: Partial<Omit<ActiveSet, 'localId'>>) => void;
  onRequestDelete: () => void;
  /**
   * Fires when the user begins a new attempt (focusing the seconds
   * input or tapping the ⏱ helper-button). Matches WeightRepsRow's
   * `onFocusWeight` "I'm lifting again" signal so ExerciseGroup can
   * reset the rest timer uniformly across variants.
   */
  onFocusWeight: () => void;
  onLongPress: () => void;
  registerRef?: (ref: TimeSecondsRowHandle | null) => void;
  unilateral?: boolean;
  /** Historic last-time data (T-211 drop-in, not yet wired). */
  lastTime?: LastTimeData | null;
};

export type TimeSecondsRowHandle = {
  /** No weight field on this row; both aliases focus the seconds input. */
  focusWeight: () => void;
  focusReps: () => void;
};

const LONG_PRESS_MS = 500;
const ACK_FLASH_MS = 150;
const CANCEL_LONG_PRESS_MS = 500;

/** `75` → `"1:15"`. Values ≥ 1h render as `mm:ss` anyway (60:00+) —
 *  gym exercises rarely exceed an hour in a single set; if they do,
 *  the readout stays legible. */
export function formatSeconds(s: number | null): string {
  if (s == null || !Number.isFinite(s) || s < 0) return '0:00';
  const total = Math.floor(s);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseSeconds(raw: string): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parse notes JSON for stored `{l,r}` unilateral times. */
function parseLR(notes: string | null): { l: number | null; r: number | null } {
  if (!notes) return { l: null, r: null };
  try {
    const parsed = JSON.parse(notes);
    if (typeof parsed === 'object' && parsed !== null) {
      const l = typeof parsed.l === 'number' ? parsed.l : null;
      const r = typeof parsed.r === 'number' ? parsed.r : null;
      return { l, r };
    }
  } catch {
    // Non-JSON notes — ignore.
  }
  return { l: null, r: null };
}

function TimeSecondsRowImpl({
  set,
  setNumber,
  active,
  isInEditMode,
  shouldPulseOnMount,
  onActivate,
  onUpdate,
  onRequestDelete,
  onFocusWeight,
  onLongPress,
  registerRef,
  unilateral = false,
  lastTime: _lastTime, // reserved for T-211 keyboard accessory wiring
}: TimeSecondsRowProps) {
  const { t } = useTranslation();

  // ── Input refs (bilateral: single input; unilateral: L + R) ────────
  const secondsInputRef = useRef<TextInput>(null);
  const leftInputRef = useRef<TextInput>(null);
  const rightInputRef = useRef<TextInput>(null);

  // ── Controlled text buffers (so the field stays editable during
  //    a run when the user decides to type an override). ────────────
  const { l: storedL, r: storedR } = parseLR(set.notes);
  const [secondsText, setSecondsText] = useState(
    set.seconds != null && set.seconds > 0 ? String(set.seconds) : '',
  );
  const [leftText, setLeftText] = useState(
    storedL != null && storedL > 0 ? String(storedL) : '',
  );
  const [rightText, setRightText] = useState(
    storedR != null && storedR > 0 ? String(storedR) : '',
  );

  // Sync buffers when the store value changes externally (e.g. stop-
  // watch Stop path writes into store and feeds back here).
  useEffect(() => {
    if (unilateral) return;
    setSecondsText(
      set.seconds != null && set.seconds > 0 ? String(set.seconds) : '',
    );
  }, [set.seconds, unilateral]);

  useEffect(() => {
    if (!unilateral) return;
    const { l, r } = parseLR(set.notes);
    setLeftText(l != null && l > 0 ? String(l) : '');
    setRightText(r != null && r > 0 ? String(r) : '');
  }, [set.notes, unilateral]);

  // ── Stopwatch state (component-local, ephemeral) ───────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [runningElapsed, setRunningElapsed] = useState(0);
  const startEpochRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Unilateral last-focused side (for dispatching the shared ⏱).
  const [lastFocusedSide, setLastFocusedSide] = useState<'L' | 'R'>('L');
  // Which side the stopwatch is currently timing (locked at Start).
  const [runningSide, setRunningSide] = useState<'L' | 'R'>('L');

  // Expose imperative handles (kept consistent with other rows).
  useEffect(() => {
    if (!registerRef) return;
    const handle: TimeSecondsRowHandle = {
      focusWeight: () => {
        if (unilateral) {
          leftInputRef.current?.focus();
        } else {
          secondsInputRef.current?.focus();
        }
      },
      focusReps: () => {
        if (unilateral) {
          leftInputRef.current?.focus();
        } else {
          secondsInputRef.current?.focus();
        }
      },
    };
    registerRef(handle);
    return () => registerRef(null);
  }, [registerRef, unilateral]);

  // Cleanup interval on unmount.
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, []);

  // ── Edit-mode animations (parity with other row variants) ──────────
  const closeOpacity = useSharedValue(isInEditMode ? 1 : 0.25);
  const dangerMix = useSharedValue(isInEditMode ? 1 : 0);
  const inputOpacity = useSharedValue(isInEditMode ? 0.6 : 1);
  const closeScale = useSharedValue(1);

  // Pre-fill pulse (UX-herziening §B, parity with other variants).
  const prefillPulse = useSharedValue(0);
  const prefillFiredRef = useRef(false);
  useEffect(() => {
    if (!shouldPulseOnMount) return;
    if (prefillFiredRef.current) return;
    prefillFiredRef.current = true;
    prefillPulse.value = withSequence(
      withTiming(1, { duration: 150, easing: Easing.inOut(Easing.quad) }),
      withDelay(100, withTiming(0, { duration: 150, easing: Easing.inOut(Easing.quad) })),
    );
  }, [shouldPulseOnMount, prefillPulse]);

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

  // ── Stopwatch tick plumbing ────────────────────────────────────────
  const startTick = () => {
    if (tickIntervalRef.current) return;
    // 100ms ticks — the spec allowed up to 100ms; smoother than 250ms
    // during a short rep-tempo exercise. Render cost is trivial on a
    // single row and tabular-nums prevents digit-width jitter.
    tickIntervalRef.current = setInterval(() => {
      if (startEpochRef.current !== null) {
        const delta = Math.floor((Date.now() - startEpochRef.current) / 1000);
        setRunningElapsed(delta);
      }
    }, 100);
  };

  const stopTick = () => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  };

  // ── Primary input handlers (bilateral) ─────────────────────────────
  const handleSecondsChange = (raw: string) => {
    const filtered = raw.replace(/[^0-9]/g, '');
    setSecondsText(filtered);
    // During a run we DON'T write to the store on every keystroke —
    // the typed value is buffered locally and only committed at Stop
    // (via the non-destructive merge) OR on blur if the user typed
    // without running the stopwatch at all.
    if (!isRunning) {
      onUpdate({ seconds: parseSeconds(filtered) });
    }
  };

  const handleSecondsFocus = () => {
    onActivate();
    onFocusWeight();
  };

  // ── Unilateral input handlers ──────────────────────────────────────
  const writeUnilateralToStore = useCallback(
    (nextL: number | null, nextR: number | null) => {
      const agg = Math.max(nextL ?? 0, nextR ?? 0);
      const hasAny = nextL !== null || nextR !== null;
      onUpdate({
        seconds: agg === 0 ? null : agg,
        notes: hasAny ? JSON.stringify({ l: nextL, r: nextR }) : null,
      });
    },
    [onUpdate],
  );

  const handleLeftChange = (raw: string) => {
    const filtered = raw.replace(/[^0-9]/g, '');
    setLeftText(filtered);
    if (!isRunning) {
      const nextL = parseSeconds(filtered);
      const { r } = parseLR(set.notes);
      writeUnilateralToStore(nextL, r);
    }
  };

  const handleRightChange = (raw: string) => {
    const filtered = raw.replace(/[^0-9]/g, '');
    setRightText(filtered);
    if (!isRunning) {
      const nextR = parseSeconds(filtered);
      const { l } = parseLR(set.notes);
      writeUnilateralToStore(l, nextR);
    }
  };

  const handleLeftFocus = () => {
    setLastFocusedSide('L');
    onActivate();
    onFocusWeight();
  };

  const handleRightFocus = () => {
    setLastFocusedSide('R');
    onActivate();
    onFocusWeight();
  };

  // ── Stopwatch control ──────────────────────────────────────────────
  const handleStart = useCallback(() => {
    Haptics.selectionAsync();
    onActivate();
    onFocusWeight();
    // Lock which side the stopwatch is timing (unilateral only).
    if (unilateral) {
      setRunningSide(lastFocusedSide);
    }
    setRunningElapsed(0);
    startEpochRef.current = Date.now();
    setIsRunning(true);
    startTick();
  }, [onActivate, onFocusWeight, unilateral, lastFocusedSide]);

  const handleStop = useCallback(() => {
    Haptics.selectionAsync();
    stopTick();
    setIsRunning(false);
    const finalElapsed =
      startEpochRef.current !== null
        ? Math.max(0, Math.round((Date.now() - startEpochRef.current) / 1000))
        : runningElapsed;
    startEpochRef.current = null;

    // NON-DESTRUCTIVE MERGE: if the user typed a manual value during
    // the run (or had one from before), that value wins and the
    // stopwatch elapsed is discarded silently. Manual intent > auto.
    if (unilateral) {
      const activeSideText = runningSide === 'L' ? leftText : rightText;
      const manual = parseSeconds(activeSideText);
      const resolved = manual !== null && manual > 0 ? manual : finalElapsed;

      const { l: prevL, r: prevR } = parseLR(set.notes);
      const nextL = runningSide === 'L' ? resolved : prevL;
      const nextR = runningSide === 'R' ? resolved : prevR;

      // Reflect into the text buffer so the input shows the merged
      // value immediately (store-feedback also updates via effect).
      if (runningSide === 'L') setLeftText(String(resolved));
      else setRightText(String(resolved));

      writeUnilateralToStore(nextL, nextR);
    } else {
      const manual = parseSeconds(secondsText);
      const resolved = manual !== null && manual > 0 ? manual : finalElapsed;
      setSecondsText(String(resolved));
      onUpdate({ seconds: resolved });
    }
  }, [
    runningElapsed,
    unilateral,
    runningSide,
    leftText,
    rightText,
    secondsText,
    set.notes,
    onUpdate,
    writeUnilateralToStore,
  ]);

  const handleCancel = useCallback(() => {
    // Long-press while running cancels the stopwatch without writing
    // anything. Runs a warning haptic so the user feels the abort.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    stopTick();
    setIsRunning(false);
    setRunningElapsed(0);
    startEpochRef.current = null;
    // DO NOT touch the store — any pre-existing set.seconds / notes
    // remain untouched. The typed-during-run buffer is also left in
    // place (typing survives a cancel; only the stopwatch run is
    // discarded).
  }, []);

  // ── Completion gate ────────────────────────────────────────────────
  const canComplete = set.seconds !== null && set.seconds > 0;

  const handleToggleComplete = () => {
    if (!set.completed && !canComplete) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (unilateral) {
        leftInputRef.current?.focus();
      } else {
        secondsInputRef.current?.focus();
      }
      return;
    }
    // UX-herziening §E: Success-haptic on commit (was selectionAsync).
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onUpdate({ completed: !set.completed });
  };

  // ── Delete / edit-mode ─────────────────────────────────────────────
  const handleDeletePress = useCallback(() => {
    Haptics.selectionAsync();
    closeScale.value = withSequence(
      withTiming(0.95, { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) }),
    );
    closeOpacity.value = withTiming(1, { duration: ACK_FLASH_MS });
    setTimeout(onRequestDelete, ACK_FLASH_MS);
  }, [closeOpacity, closeScale, onRequestDelete]);

  const handleLongPressRow = useCallback(() => {
    if (isInEditMode) return;
    Haptics.selectionAsync();
    onLongPress();
  }, [isInEditMode, onLongPress]);

  // ── Visual state ───────────────────────────────────────────────────
  // NOTE: background now rendered via rowBackgroundAnimStyle (Animated.View)
  // so the pre-fill pulse can interpolate. No longer using rowBgClass.
  const textColor = set.completed ? 'text-content-secondary' : 'text-content';
  const borderColor = isInEditMode ? colors.primary.DEFAULT : 'transparent';

  // Helper label (= m:ss) content — only rendered when seconds > 0.
  const helperLabel = (() => {
    if (unilateral) {
      const { l, r } = parseLR(set.notes);
      if (l == null && r == null) return null;
      const lTxt = l != null && l > 0 ? formatSeconds(l) : '—';
      const rTxt = r != null && r > 0 ? formatSeconds(r) : '—';
      return `= ${lTxt} · ${rTxt}`;
    }
    if (set.seconds == null || set.seconds <= 0) return null;
    return `= ${formatSeconds(set.seconds)}`;
  })();

  // Live readout shown in the input position while running.
  const liveReadout = formatSeconds(runningElapsed);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <Animated.View
      layout={LinearTransition.duration(200)}
      exiting={FadeOut.duration(200)}
      className="relative"
    >
      <Pressable
        onLongPress={handleLongPressRow}
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

          {/* Middle: seconds input(s) + ⏱ helper ─────────────────── */}
          <Animated.View
            className="flex-1 flex-row items-center px-2"
            style={inputsDimStyle}
          >
            {unilateral ? (
              <>
                {/* L input */}
                <View className="flex-1 pr-1">
                  {isRunning && runningSide === 'L' ? (
                    <View
                      className="h-12 items-center justify-center rounded-input bg-surface-elevated"
                      accessibilityLiveRegion="polite"
                      accessibilityLabel={liveReadout}
                    >
                      <Text
                        className={`font-inter-semibold text-body ${textColor}`}
                        style={{
                          fontVariant: ['tabular-nums'],
                          fontSize: 20,
                        }}
                      >
                        {liveReadout}
                      </Text>
                    </View>
                  ) : (
                    <TextInput
                      ref={leftInputRef}
                      value={isRunning && runningSide === 'L' ? '' : leftText}
                      onChangeText={handleLeftChange}
                      onFocus={handleLeftFocus}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      returnKeyType="done"
                      placeholder={t('workout.unilateralLeft')}
                      placeholderTextColor={colors.content.muted}
                      className={`h-12 rounded-input bg-surface-elevated px-3 text-center font-inter-semibold text-body ${textColor}`}
                      accessibilityLabel={`${t('workout.unilateralLeft')} ${t('workout.secondsPlaceholder')}`}
                    />
                  )}
                </View>
                {/* R input */}
                <View className="flex-1 px-1">
                  {isRunning && runningSide === 'R' ? (
                    <View
                      className="h-12 items-center justify-center rounded-input bg-surface-elevated"
                      accessibilityLiveRegion="polite"
                      accessibilityLabel={liveReadout}
                    >
                      <Text
                        className={`font-inter-semibold text-body ${textColor}`}
                        style={{
                          fontVariant: ['tabular-nums'],
                          fontSize: 20,
                        }}
                      >
                        {liveReadout}
                      </Text>
                    </View>
                  ) : (
                    <TextInput
                      ref={rightInputRef}
                      value={isRunning && runningSide === 'R' ? '' : rightText}
                      onChangeText={handleRightChange}
                      onFocus={handleRightFocus}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      returnKeyType="done"
                      placeholder={t('workout.unilateralRight')}
                      placeholderTextColor={colors.content.muted}
                      className={`h-12 rounded-input bg-surface-elevated px-3 text-center font-inter-semibold text-body ${textColor}`}
                      accessibilityLabel={`${t('workout.unilateralRight')} ${t('workout.secondsPlaceholder')}`}
                    />
                  )}
                </View>
              </>
            ) : (
              <View className="flex-1 pr-1">
                {isRunning ? (
                  <View
                    className="h-12 items-center justify-center rounded-input bg-surface-elevated"
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={liveReadout}
                  >
                    <Text
                      className={`font-inter-semibold text-body ${textColor}`}
                      style={{
                        fontVariant: ['tabular-nums'],
                        fontSize: 20,
                      }}
                    >
                      {liveReadout}
                    </Text>
                  </View>
                ) : (
                  <TextInput
                    ref={secondsInputRef}
                    value={secondsText}
                    onChangeText={handleSecondsChange}
                    onFocus={handleSecondsFocus}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    returnKeyType="done"
                    placeholder="0"
                    placeholderTextColor={colors.content.muted}
                    className={`h-12 rounded-input bg-surface-elevated px-3 text-center font-inter-semibold text-body ${textColor}`}
                    accessibilityLabel={t('workout.secondsPlaceholder')}
                  />
                )}
              </View>
            )}

            {/* ⏱ helper button — tertiary; icon-only, muted at rest.
                While running: swaps to STOP text + is long-press-to-
                cancel. 36×44pt target (36 visible + slop expands it
                to 44 vertical).
            */}
            <Pressable
              onPress={isRunning ? handleStop : handleStart}
              onLongPress={isRunning ? handleCancel : undefined}
              delayLongPress={CANCEL_LONG_PRESS_MS}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={
                isRunning
                  ? t('workout.stopwatchStop')
                  : t('workout.stopwatchStart')
              }
              accessibilityHint={
                isRunning ? t('workout.stopwatchCancel') : undefined
              }
              className={`ml-1 h-11 items-center justify-center rounded-button ${
                isRunning ? 'bg-danger px-3' : 'px-2'
              } active:opacity-70`}
              style={{ minWidth: 36 }}
            >
              {isRunning ? (
                <Text className="text-small-caps uppercase text-background">
                  {t('workout.stopwatchStop')}
                </Text>
              ) : (
                <Ionicons
                  name="stopwatch-outline"
                  size={20}
                  color={colors.content.muted}
                />
              )}
            </Pressable>
          </Animated.View>

          {/* Complete-circle */}
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

        {/* Helper label (= m:ss) — left-padded to align with the
            seconds-input column. Only rendered when there's something
            to show (seconds > 0, or unilateral has any side logged).
            Same indent math as RepsOnlyRow's +kg hint (72pt). */}
        {helperLabel && !isRunning && (
          <View
            style={{ paddingLeft: 72, paddingTop: 2, paddingBottom: 6 }}
            accessible
            accessibilityLabel={
              unilateral
                ? helperLabel
                : t('workout.secondsEquivalent', {
                    formatted: formatSeconds(set.seconds),
                  })
            }
          >
            <Text className="text-small-caps uppercase text-content-muted">
              {helperLabel}
            </Text>
          </View>
        )}

        {/* Cancel-gesture hint (running only, long-press-cancel mode).
            Auto-hides on Stop/Cancel. */}
        {isRunning && (
          <View style={{ paddingLeft: 72, paddingTop: 2, paddingBottom: 6 }}>
            <Text className="text-small-caps uppercase text-content-muted">
              {t('workout.stopwatchCancelHint')}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default React.memo(TimeSecondsRowImpl);
