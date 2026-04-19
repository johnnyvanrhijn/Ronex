/**
 * components/workout/WorkoutHeader.tsx
 *
 * Fixed header for the active-workout screen (T-204 / FASE 1).
 *
 * Layout (top to bottom)
 * ----------------------
 *   row 1: [back chevron]   [TRAINING · mm:ss]   [cloud-sync]   [rest: 0:45?]
 *   row 2: Workout name (display-lg, editable = Phase 3; MVP renders a
 *          fallback placeholder).
 *   row 3: "N oefeningen · X kg getild" subtitle, bounce-animated on
 *          volume change.
 *
 * Bounce animation
 * ----------------
 * A reanimated `scale` value runs 1.0 → 1.05 → 1.0 over 200ms whenever
 * `volumeKg` changes. We key the effect on the integer volume so typing
 * partial numbers into the numpad doesn't fire the bounce (updates only
 * commit to the store when a set flips to completed, per WeightRepsRow).
 *
 * Rest timer
 * ----------
 * Read-only consumer of `useRestTimer`. Shows the count-up when
 * `startedAtMs !== null`. Background tint when active so the eye
 * naturally lands on it.
 *
 * Sync indicator
 * --------------
 * Cloud icon, one of three states (synced/pending/error). Color-coded.
 * Source = `useSyncStatus()` (placeholder — T-212 fills).
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { colors } from '@/lib/theme';
import { useElapsedTime, useStopwatch } from '@/hooks/useElapsedTime';
import { useRestTimer } from '@/stores/restTimer';
import { useSyncStatus, type SyncStatus } from '@/hooks/useSyncStatus';

type WorkoutHeaderProps = {
  name: string | null;
  startedAt: string | null;
  exerciseCount: number;
  volumeKg: number;
  /**
   * UX-herziening 2026-04-19: dynamic H1 built from muscle-groups of the
   * current buckets (e.g. "Borst · Triceps"). `null` means no exercises
   * yet — the header hides its H1 slot so the empty-state screen reads
   * as a blank canvas instead of a flat "Workout" placeholder.
   */
  muscleTitle?: string | null;
  onPressBack: () => void;
};

function syncIconName(status: SyncStatus): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case 'synced':
      return 'cloud-done-outline';
    case 'pending':
      return 'cloud-upload-outline';
    case 'error':
      return 'cloud-offline-outline';
  }
}

function syncIconColor(status: SyncStatus): string {
  switch (status) {
    case 'synced':
      return colors.content.muted;
    case 'pending':
      return colors.warning;
    case 'error':
      return colors.danger;
  }
}

function syncLabelKey(status: SyncStatus) {
  switch (status) {
    case 'synced':
      return 'workout.syncSynced' as const;
    case 'pending':
      return 'workout.syncPending' as const;
    case 'error':
      return 'workout.syncError' as const;
  }
}

export default function WorkoutHeader({
  name,
  startedAt,
  exerciseCount,
  volumeKg,
  muscleTitle,
  onPressBack,
}: WorkoutHeaderProps) {
  const { t } = useTranslation();

  const elapsed = useElapsedTime(startedAt);

  const restStartedAt = useRestTimer((s) => s.startedAtMs);
  const restElapsed = useStopwatch(restStartedAt);

  // T-212: useSyncStatus now returns a rich object. We only need `uiStatus`
  // for the header icon (tri-state 'synced' | 'pending' | 'error').
  const { uiStatus: syncStatus } = useSyncStatus();

  // Format volume with Dutch thousand separator (`.`).
  const formattedVolume = useMemo(
    () => Math.round(volumeKg).toLocaleString('nl-NL'),
    [volumeKg],
  );

  // Bounce animation on volume change. Keyed on the integer so partial
  // numpad typing doesn't pulse (store only commits on set-complete).
  const bounceScale = useSharedValue(1);
  useEffect(() => {
    bounceScale.value = withSequence(
      withTiming(1.05, { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 100, easing: Easing.in(Easing.quad) }),
    );
  }, [formattedVolume, bounceScale]);

  const subtitleAnim = useAnimatedStyle(() => ({
    transform: [{ scale: bounceScale.value }],
  }));

  // UX-herziening 2026-04-19: H1 is now dynamic (muscle-groups). If the
  // parent passes a `muscleTitle`, it wins over the user's manual `name`
  // (which remains unused in MVP; Phase 3 restores user-editable names).
  // If both are absent/null, we don't render the H1 at all.
  const h1Text = muscleTitle ?? name;

  return (
    <View className="px-5 pb-3 pt-2">
      {/* Row 1: back · elapsed · sync · rest */}
      <View className="flex-row items-center">
        <Pressable
          onPress={onPressBack}
          className="h-11 w-11 -ml-2 items-center justify-center"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={colors.content.DEFAULT}
          />
        </Pressable>

        <View className="flex-1 items-center">
          {/* UX-herziening 2026-04-19: only show the TRAINING · mm:ss timer
              once the session has actually started (first set added). When
              `startedAt` is still null the slot stays empty — the empty-
              state "Nog niks gelogd" screen shouldn't be ticking a timer. */}
          {startedAt !== null && (
            <Text
              className="text-small-caps uppercase text-content-secondary"
              accessibilityLiveRegion="polite"
            >
              {t('workout.elapsedLabel', { elapsed })}
            </Text>
          )}
        </View>

        <View className="flex-row items-center gap-2">
          {restStartedAt != null && (
            <View className="h-9 flex-row items-center rounded-pill bg-surface-elevated px-3">
              <Text className="text-small-caps uppercase text-primary">
                {t('workout.restLabel', { time: restElapsed })}
              </Text>
            </View>
          )}
          <View
            className="h-11 w-11 items-center justify-center"
            accessibilityRole="image"
            accessibilityLabel={t(syncLabelKey(syncStatus))}
          >
            <Ionicons
              name={syncIconName(syncStatus)}
              size={20}
              color={syncIconColor(syncStatus)}
            />
          </View>
        </View>
      </View>

      {/* Row 2: dynamic H1 (muscle-group summary). Hidden entirely when
          no exercises have been added yet — the empty-state shouldn't
          anchor to a placeholder title. */}
      {h1Text !== null && h1Text.length > 0 && (
        <Text
          className="mt-3 text-display-lg text-content"
          accessibilityRole="header"
        >
          {h1Text}
        </Text>
      )}

      {/* Row 3: exercise count · total volume, bounce-animated on change. */}
      <Animated.View style={subtitleAnim} className="mt-1">
        {exerciseCount === 0 ? (
          <Text className="font-inter text-body text-content-secondary">
            {t('workout.volumeLabelZero')}
          </Text>
        ) : (
          <Text
            className="font-inter text-body text-content-secondary"
            accessibilityLabel={t('workout.volumeTooltip')}
          >
            {t('workout.volumeLabel', {
              count: exerciseCount,
              volume: formattedVolume,
            })}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}
