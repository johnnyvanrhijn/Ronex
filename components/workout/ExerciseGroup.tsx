/**
 * components/workout/ExerciseGroup.tsx
 *
 * One block per exercise on the active-workout screen.
 *
 * Structure
 * ---------
 *   Header   : exercise name (body-semibold)   |   equipment (muted)
 *   Columns  : × · # · (variant-specific) · ○
 *   Rows     : list of row-variants dispatched by `exercise.logging_type`:
 *                weight_reps    → WeightRepsRow
 *                reps_only      → RepsOnlyRow
 *                time_seconds   → TimeSecondsRow
 *                distance_weight→ (not in MVP — falls back to WeightRepsRow
 *                                 as a safety net; exercise library does
 *                                 not seed this type)
 *   Footer   : full-width `[+ set]` ghost button.
 *
 * UX-herziening 2026-04-19 integration
 * ------------------------------------
 *   - Commit-flash strip: on every set-commit, the group emits a summary
 *     string up to `onSetCommitted` (set by app/workout/active.tsx). The
 *     CommitFlashStrip component renders that line just above the keyboard.
 *   - Carry-forward: when a row transitions false→true AND that row is the
 *     LAST set in its bucket, we auto-spawn a new set via
 *     `addSetWithPrefill()` using the just-committed values. Imports from
 *     `stores/activeWorkout.ts` (getLastSetInStoreForExercise + store hook).
 *   - Pre-fill pulse: rows that were just spawned with pre-filled values
 *     (either historic on set-1 OR carry-forward on set-N>1) receive
 *     `shouldPulseOnMount={true}`. Tracked via a per-group Set of localIds
 *     that the group knows are pre-filled; each row's useRef guards
 *     fire-once.
 *   - Auto-spawn on last-set delete REMOVED (UX-herziening §3): delete is
 *     pure remove; bucket may end up with 0 rows, which renders fine
 *     (header + column-headers + "+ set" button). User regains an empty
 *     bucket's first set via tapping "+ set" OR removes the exercise via
 *     the header ×.
 *
 * Rest-timer policy
 * -----------------
 *   Unchanged from prior version.
 *
 * Active-row / edit-mode coordination
 * -----------------------------------
 *   Unchanged from prior version.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { colors } from '@/lib/theme';
import type { ActiveSet } from '@/types/workout';
import type { Exercise, LoggingType } from '@/lib/queries/useExercises';
import WeightRepsRow, { type WeightRepsRowHandle } from './WeightRepsRow';
import RepsOnlyRow, { type RepsOnlyRowHandle } from './RepsOnlyRow';
import TimeSecondsRow, { type TimeSecondsRowHandle } from './TimeSecondsRow';
import { formatCommitSummary } from './CommitFlashStrip';
import { useRestTimer } from '@/stores/restTimer';
import {
  useActiveWorkout,
  getLastSetInStoreForExercise,
} from '@/stores/activeWorkout';

type RowHandle = WeightRepsRowHandle | RepsOnlyRowHandle | TimeSecondsRowHandle;

type ExerciseGroupProps = {
  exercise: Exercise;
  equipmentLabel: string;
  sets: ActiveSet[]; // sorted in store-order
  onUpdateSet: (
    localId: string,
    patch: Partial<Omit<ActiveSet, 'localId'>>,
  ) => void;
  onAddSet: () => void;
  onRequestDelete: (localId: string) => void;
  onRequestDeleteExercise: (exerciseId: string) => void;
  autoFocusFirstLocalId?: string | null;
  /**
   * UX-herziening 2026-04-19 §C: Set of localIds that were spawned with
   * pre-filled values. Rows in this set fire the one-shot 400ms lime pulse
   * on mount (fire-once is enforced per-row via useRef internally).
   *
   * Passed in from the parent because historic-prefill (set 1, from
   * `useLastSetForExercise`) is orchestrated in `app/workout/active.tsx`,
   * while carry-forward (sets 2+) happens here. We consolidate both into
   * a single Set so the row doesn't have to care where the pulse came from.
   */
  prefilledLocalIds?: ReadonlySet<string>;
  /**
   * Fires whenever a row transitions from incomplete to complete. Parent
   * uses this to toggle the CommitFlashStrip. Summary is pre-formatted
   * by the group (via formatCommitSummary) so the strip stays logging-
   * type-agnostic.
   */
  onSetCommitted?: (summary: string, setNumber: number) => void;
  /**
   * UX-herziening §C: callback fired when the group auto-spawns a carry-
   * forward set (for the parent to track it as prefilled so it can pulse).
   * The parent reconciles this into `prefilledLocalIds` on next render.
   */
  onCarryForwardSpawned?: (localId: string) => void;
};

export default function ExerciseGroup({
  exercise,
  equipmentLabel,
  sets,
  onUpdateSet,
  onAddSet,
  onRequestDelete,
  onRequestDeleteExercise,
  autoFocusFirstLocalId,
  prefilledLocalIds,
  onSetCommitted,
  onCarryForwardSpawned,
}: ExerciseGroupProps) {
  const { t } = useTranslation();

  const [activeLocalId, setActiveLocalId] = useState<string | null>(null);
  const [editModeLocalId, setEditModeLocalId] = useState<string | null>(null);

  // Per-group kg-expanded flag for reps_only variant.
  const [kgExpanded, setKgExpanded] = useState<boolean>(() =>
    sets.some((s) => s.weightKg !== null && s.weightKg > 0),
  );
  useEffect(() => {
    if (!kgExpanded && sets.some((s) => s.weightKg !== null && s.weightKg > 0)) {
      setKgExpanded(true);
    }
  }, [sets, kgExpanded]);

  // Remember prior completed-state so we can detect the false→true
  // transition (which starts the rest timer and fires commit-flash).
  const prevCompleted = useRef<Map<string, boolean>>(new Map());

  const startRest = useRestTimer((s) => s.start);
  const resetRest = useRestTimer((s) => s.reset);

  const rowHandles = useRef<Map<string, RowHandle>>(new Map());

  useEffect(() => {
    if (!autoFocusFirstLocalId) return;
    const handle = rowHandles.current.get(autoFocusFirstLocalId);
    if (handle) {
      const id = setTimeout(() => handle.focusWeight(), 120);
      return () => clearTimeout(id);
    }
  }, [autoFocusFirstLocalId]);

  // ── Commit detect: false → true transition ─────────────────────────
  // We want to run BOTH effects: (a) start rest timer, (b) optionally
  // spawn a carry-forward set + fire the commit-flash summary. These
  // happen synchronously in `handleUpdate` so the store write ordering
  // stays predictable.
  const handleUpdate = useCallback(
    (localId: string, patch: Partial<Omit<ActiveSet, 'localId'>>) => {
      const prior = prevCompleted.current.get(localId) ?? false;
      onUpdateSet(localId, patch);

      // Rest-timer signal.
      if (patch.completed === true && !prior) {
        startRest();

        // Commit-flash: read the just-updated set back from the store
        // (patch may be partial; we want the fully-merged state for the
        // summary). Zustand getState() is synchronous — the update above
        // has already landed.
        const merged = useActiveWorkout
          .getState()
          .sets.find((s) => s.localId === localId);
        if (merged && onSetCommitted) {
          // Compute the setNumber: 1-based index within this bucket.
          const bucketSets = useActiveWorkout
            .getState()
            .sets.filter((s) => s.exerciseId === exercise.id);
          const setNumber =
            bucketSets.findIndex((s) => s.localId === localId) + 1;
          const summary = formatCommitSummary(merged, exercise.logging_type);
          onSetCommitted(summary, setNumber);
        }

        // Carry-forward: if this was the LAST set in the bucket, spawn a
        // fresh set seeded with the just-committed values. The set we
        // just committed is now at bucketSets.length - 1; if that matches
        // `localId`, we're at the tail.
        const bucketSets = useActiveWorkout
          .getState()
          .sets.filter((s) => s.exerciseId === exercise.id);
        const isLast =
          bucketSets.length > 0 &&
          bucketSets[bucketSets.length - 1].localId === localId;
        if (isLast) {
          const last = getLastSetInStoreForExercise(exercise.id);
          // Capture next-localId: the store's generateLocalId is not exposed,
          // so we call addSetWithPrefill and read back the tail.
          useActiveWorkout
            .getState()
            .addSetWithPrefill(exercise.id, {
              weightKg: last?.weightKg ?? null,
              reps: last?.reps ?? null,
              seconds: last?.seconds ?? null,
            });
          const spawnedSet =
            useActiveWorkout.getState().sets[
              useActiveWorkout.getState().sets.length - 1
            ];
          if (spawnedSet && onCarryForwardSpawned) {
            onCarryForwardSpawned(spawnedSet.localId);
          }
        }
      }
      if (patch.completed === false && prior) {
        resetRest();
      }
      if (patch.completed !== undefined) {
        prevCompleted.current.set(localId, patch.completed);
      }
    },
    [
      onUpdateSet,
      startRest,
      resetRest,
      exercise.id,
      exercise.logging_type,
      onSetCommitted,
      onCarryForwardSpawned,
    ],
  );

  useEffect(() => {
    for (const s of sets) {
      if (!prevCompleted.current.has(s.localId)) {
        prevCompleted.current.set(s.localId, s.completed);
      }
    }
  }, [sets]);

  const handleFocusWeight = useCallback(
    (localId: string) => {
      resetRest();
      setActiveLocalId(localId);
      setEditModeLocalId(null);
    },
    [resetRest],
  );

  const registerRowRef = useCallback(
    (localId: string) => (ref: RowHandle | null) => {
      if (ref) {
        rowHandles.current.set(localId, ref);
      } else {
        rowHandles.current.delete(localId);
      }
    },
    [],
  );

  // UX-herziening §3: auto-spawn-on-delete REMOVED. Delete is pure-remove.
  // If the user deletes the last row in a bucket, the bucket renders with
  // 0 rows (header + column-headers + "+ set" button remain visible). User
  // can re-start by tapping "+ set" OR remove the exercise entirely via
  // the header ×. Carry-forward already ensures a spawned row exists on
  // every commit, so the previous "last-set delete silently respawns" hack
  // would double-up with carry-forward and produce the "can never be empty"
  // bug the redesign explicitly calls out.
  const handleDelete = useCallback(
    (localId: string) => {
      setEditModeLocalId(null);
      onRequestDelete(localId);
    },
    [onRequestDelete],
  );

  const handleLongPress = useCallback((localId: string) => {
    setEditModeLocalId(localId);
  }, []);

  const handleDismissEditMode = useCallback(() => {
    setEditModeLocalId(null);
  }, []);

  // ── Header × tap animation (B-029) ─────────────────────────────────
  const headerCloseScale = useSharedValue(1);
  const headerCloseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerCloseScale.value }],
  }));

  const handleHeaderDeletePress = useCallback(() => {
    Haptics.selectionAsync();
    headerCloseScale.value = withSequence(
      withTiming(0.95, { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) }),
    );
    onRequestDeleteExercise(exercise.id);
  }, [exercise.id, headerCloseScale, onRequestDeleteExercise]);

  // ── Column headers — variant-specific ───────────────────────────────
  // NOTE: with inline steppers (UX-herziening §A), each numeric cell
  // is now 36pt stepper + flex input + 36pt stepper. The column-label
  // "kg" / "reps" / "tijd" still centers over the whole flex region,
  // which naturally centers over the input since the two stepper
  // buttons are symmetric. No math changes needed for labels.
  const columnsHeader = useMemo(() => {
    const loggingType: LoggingType = exercise.logging_type;
    return (
      <View className="flex-row items-center px-1 pb-2">
        <View style={{ width: 40 }} />
        <View className="w-8 items-center">
          <Text className="text-small-caps uppercase text-content-muted">
            {t('workout.setsHeaderNumber')}
          </Text>
        </View>

        {loggingType === 'weight_reps' && (
          <>
            <View className="flex-1 items-center">
              <Text className="text-small-caps uppercase text-content-muted">
                {t('workout.setsHeaderWeight')}
              </Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-small-caps uppercase text-content-muted">
                {t('workout.setsHeaderReps')}
              </Text>
            </View>
          </>
        )}

        {loggingType === 'reps_only' && (
          <>
            {kgExpanded ? (
              <>
                <View className="flex-1 items-center">
                  <Text className="text-small-caps uppercase text-content-muted">
                    {t('workout.setsHeaderWeight')}
                  </Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-small-caps uppercase text-content-muted">
                    {t('workout.setsHeaderReps')}
                  </Text>
                </View>
              </>
            ) : (
              <View className="flex-1 items-center">
                <Text className="text-small-caps uppercase text-content-muted">
                  {t('workout.setsHeaderReps')}
                </Text>
              </View>
            )}
          </>
        )}

        {loggingType === 'time_seconds' && (
          <View className="flex-1 items-center">
            <Text className="text-small-caps uppercase text-content-muted">
              {t('workout.setsHeaderTime')}
            </Text>
          </View>
        )}

        {loggingType === 'distance_weight' && (
          <>
            <View className="flex-1 items-center">
              <Text className="text-small-caps uppercase text-content-muted">
                {t('workout.setsHeaderWeight')}
              </Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-small-caps uppercase text-content-muted">
                {t('workout.setsHeaderReps')}
              </Text>
            </View>
          </>
        )}

        <View className="w-12" />
      </View>
    );
  }, [t, exercise.logging_type, kgExpanded]);

  const hasArmedRow = editModeLocalId !== null;

  // ── Row renderer — dispatches on logging_type ──────────────────────
  const renderRow = (s: ActiveSet, idx: number) => {
    const shouldPulse = prefilledLocalIds?.has(s.localId) ?? false;
    const common = {
      set: s,
      setNumber: idx + 1,
      active: activeLocalId === s.localId,
      isInEditMode: editModeLocalId === s.localId,
      shouldPulseOnMount: shouldPulse,
      onActivate: () => setActiveLocalId(s.localId),
      onUpdate: (patch: Partial<Omit<ActiveSet, 'localId'>>) =>
        handleUpdate(s.localId, patch),
      onRequestDelete: () => handleDelete(s.localId),
      onFocusWeight: () => handleFocusWeight(s.localId),
      onLongPress: () => handleLongPress(s.localId),
    };

    switch (exercise.logging_type) {
      case 'reps_only':
        return (
          <RepsOnlyRow
            key={s.localId}
            {...common}
            equipment={exercise.equipment}
            kgExpanded={kgExpanded}
            onToggleKg={setKgExpanded}
            unilateral={exercise.is_unilateral}
            registerRef={registerRowRef(s.localId)}
          />
        );
      case 'time_seconds':
        return (
          <TimeSecondsRow
            key={s.localId}
            {...common}
            unilateral={exercise.is_unilateral}
            registerRef={registerRowRef(s.localId)}
          />
        );
      case 'weight_reps':
      case 'distance_weight':
      default:
        return (
          <WeightRepsRow
            key={s.localId}
            {...common}
            equipment={exercise.equipment}
            registerRef={registerRowRef(s.localId)}
          />
        );
    }
  };

  return (
    <View className="mb-8">
      <View className="mb-3 flex-row items-center">
        <Text
          className="flex-1 text-body font-inter-semibold text-content"
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        <Text
          className="ml-3 text-small-caps uppercase text-content-muted"
          numberOfLines={1}
        >
          {equipmentLabel}
        </Text>
        <Pressable
          onPress={handleHeaderDeletePress}
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('workout.deleteExercise', { name: exercise.name })}
          className="ml-3 h-11 w-8 items-center justify-center"
        >
          <Animated.View style={[{ opacity: 0.6 }, headerCloseAnimStyle]}>
            <Ionicons name="close" size={18} color={colors.content.secondary} />
          </Animated.View>
        </Pressable>
      </View>

      {columnsHeader}

      {/* Set rows ------------------------------------------------------- */}
      <Pressable
        onPress={hasArmedRow ? handleDismissEditMode : undefined}
        disabled={!hasArmedRow}
        android_disableSound
      >
        <View className="gap-2">{sets.map(renderRow)}</View>
      </Pressable>

      {/* Add-set button ------------------------------------------------- */}
      <Pressable
        onPress={() => {
          if (hasArmedRow) setEditModeLocalId(null);
          onAddSet();
        }}
        className="mt-3 h-12 items-center justify-center rounded-button border border-surface-elevated bg-transparent active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={t('workout.addSet')}
      >
        <Text className="text-small-caps uppercase text-content-secondary">
          {t('workout.addSetCta')}
        </Text>
      </Pressable>
    </View>
  );
}
