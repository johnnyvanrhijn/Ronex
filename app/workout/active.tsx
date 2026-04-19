/**
 * app/workout/active.tsx
 *
 * The active-workout screen.
 *
 * Anatomy
 * -------
 *   WorkoutHeader           — timer, name, volume, rest, sync indicator.
 *   ScrollView
 *     ExerciseGroup × N     — one block per exercise; each owns set-rows
 *                             and a "+ set" footer.
 *     "+ Oefening toevoegen" — full-width ghost; opens exercise picker.
 *   CommitFlashStrip        — transient lime small-caps banner above
 *                             the keyboard after a set-commit (1.2s).
 *   Floating Finish CTA     — lime pill pinned to the bottom-safe-area.
 *   DiscardModal            — back-chevron confirmation.
 *   DeleteExerciseModal     — B-029 bucket-level delete confirm.
 *   FinishSheet             — review sheet + confirm-voltooien.
 *
 * Logging-type coverage
 * ---------------------
 *   All three MVP logging_types render via ExerciseGroup's dispatcher:
 *     - weight_reps   → WeightRepsRow
 *     - reps_only     → RepsOnlyRow
 *     - time_seconds  → TimeSecondsRow
 *   distance_weight falls back to WeightRepsRow (not seeded in MVP).
 *
 * UX-herziening 2026-04-19 orchestration
 * --------------------------------------
 *   - On picker-return / +set / + exercise, we call `addSetWithPrefill()`
 *     with values drawn from EITHER the carry-forward (if an existing
 *     set in this bucket has been committed) OR historic data (via
 *     `fetchLastSetForExercise` cached through TanStack). The cache path
 *     uses `queryClient.ensureQueryData` rather than the useLastSetFor-
 *     Exercise hook directly because we need the data inside an imperative
 *     event handler, not a render pass.
 *   - Every localId spawned with pre-filled values is tracked in
 *     `prefilledLocalIds` (component state) and passed into ExerciseGroup,
 *     which then hands each row `shouldPulseOnMount`. A row's useRef
 *     guards fire-once semantics.
 *   - Carry-forward auto-spawn ALSO happens inside ExerciseGroup's commit
 *     detection path. That path calls `onCarryForwardSpawned(localId)` so
 *     we can add the spawned id to `prefilledLocalIds`.
 *   - Commit-flash: ExerciseGroup fires `onSetCommitted(summary, n)` on
 *     every false→true transition. We toggle a local `flashState` which
 *     drives `CommitFlashStrip`. The strip auto-hides after 1.2s.
 *
 * Integration with state
 * ----------------------
 *   - Reads/writes via `useActiveWorkout` (zustand).
 *   - TanStack Query client is used for `ensureQueryData` on history.
 *
 * Navigation
 * ----------
 *   On mount: if the store has no session, start one.
 *   When finished: completeWorkout() → scheduleImmediate() → reset()
 *   → navigate back to Challenge tab.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { useActiveWorkout } from '@/stores/activeWorkout';
import {
  useExercises,
  type Exercise,
} from '@/lib/queries/useExercises';
import {
  fetchLastSetForExercise,
  lastSetQueryKey,
  type LastSetForExercise,
} from '@/lib/queries/useLastSetForExercise';
import { queryClient } from '@/lib/queryClient';
import { useExercisePickerResult } from '@/stores/exercisePickerResult';
import { useElapsedTime } from '@/hooks/useElapsedTime';
import WorkoutHeader from '@/components/workout/WorkoutHeader';
import ExerciseGroup from '@/components/workout/ExerciseGroup';
import DiscardModal from '@/components/workout/DiscardModal';
import DeleteExerciseModal from '@/components/workout/DeleteExerciseModal';
import FinishSheet from '@/components/workout/FinishSheet';
import CommitFlashStrip, {
  COMMIT_FLASH_TOTAL_MS,
} from '@/components/workout/CommitFlashStrip';
import Toast from '@/components/Toast';
import { useRestTimer } from '@/stores/restTimer';
import { scheduleImmediate } from '@/lib/sync/syncActiveWorkout';

type ExerciseBucket = {
  exerciseId: string;
  exercise: Exercise;
  setLocalIds: string[];
};

/**
 * Bridge between raw history (from `fetchLastSetForExercise`) and the
 * store prefill contract (`addSetWithPrefill`). Keeps the call-site
 * one-liner tidy.
 */
function prefillFromHistory(
  history: LastSetForExercise | null,
): { weightKg: number | null; reps: number | null; seconds: number | null } {
  return {
    weightKg: history?.weightKg ?? null,
    reps: history?.reps ?? null,
    seconds: history?.seconds ?? null,
  };
}

/**
 * Decide whether carry-forward applies for a given exerciseId. Carry-
 * forward only fires when there's already at least ONE set in the
 * bucket for this exercise (meaning the user has a prior-set reference
 * point in this session). Otherwise we fall through to history lookup.
 */
function hasExistingBucket(
  sets: { exerciseId: string }[],
  exerciseId: string,
): boolean {
  for (const s of sets) if (s.exerciseId === exerciseId) return true;
  return false;
}

export default function ActiveWorkoutScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  // ── Store bindings ──────────────────────────────────────────────────
  const startedAt = useActiveWorkout((s) => s.startedAt);
  const completedAt = useActiveWorkout((s) => s.completedAt);
  const name = useActiveWorkout((s) => s.name);
  const sets = useActiveWorkout((s) => s.sets);
  const startWorkout = useActiveWorkout((s) => s.startWorkout);
  const addSetWithPrefill = useActiveWorkout((s) => s.addSetWithPrefill);
  const updateSet = useActiveWorkout((s) => s.updateSet);
  const removeSet = useActiveWorkout((s) => s.removeSet);
  const removeExercise = useActiveWorkout((s) => s.removeExercise);
  const completeWorkout = useActiveWorkout((s) => s.completeWorkout);
  const resetWorkout = useActiveWorkout((s) => s.reset);

  const { data: exercises } = useExercises();

  const pickerResult = useExercisePickerResult((s) => s.selectedExerciseId);
  const clearPickerResult = useExercisePickerResult((s) => s.clear);
  const resetRestTimer = useRestTimer((s) => s.reset);

  // ── Local UI state ──────────────────────────────────────────────────
  const [discardVisible, setDiscardVisible] = useState(false);
  const [finishVisible, setFinishVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [autoFocusLocalId, setAutoFocusLocalId] = useState<string | null>(null);
  const [deleteExerciseTarget, setDeleteExerciseTarget] = useState<{
    exerciseId: string;
    name: string;
    setCount: number;
  } | null>(null);

  // UX-herziening §B+C: tracks which localIds should pulse on mount.
  // Populated when we spawn a set with pre-filled values (from either
  // history or carry-forward). Rows self-guard the fire-once via useRef,
  // so we never clean up entries; the Set grows but doesn't leak (reset
  // on workout discard/finish).
  const [prefilledLocalIds, setPrefilledLocalIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const markPrefilled = useCallback((localId: string) => {
    setPrefilledLocalIds((prev) => {
      if (prev.has(localId)) return prev;
      const next = new Set(prev);
      next.add(localId);
      return next;
    });
  }, []);

  // UX-herziening §C: commit-flash state. `message` is null when the
  // strip is hidden; the CommitFlashStrip component calls `onHide` when
  // its fade-out finishes to clear state. A small debounce guard prevents
  // back-to-back commits from re-triggering the animation mid-fade.
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const flashLockUntilRef = useRef<number>(0);
  const handleSetCommitted = useCallback(
    (summary: string, setNumber: number) => {
      const now = Date.now();
      if (now < flashLockUntilRef.current) {
        // Previous flash still animating — skip to avoid visual stutter.
        return;
      }
      flashLockUntilRef.current = now + COMMIT_FLASH_TOTAL_MS;
      // i18n-key workout.commitFlash: "Set {{n}} vastgelegd · {{summary}}"
      const msg = t('workout.commitFlash', { n: setNumber, summary });
      setFlashMessage(msg);
    },
    [t],
  );
  const handleFlashHide = useCallback(() => setFlashMessage(null), []);

  // ── Bootstrap REMOVED (UX-herziening 2026-04-19) ───────────────────
  // Previously we fired `startWorkout('manual')` on mount, which set
  // `startedAt` immediately and kicked off the TRAINING timer the moment
  // the user opened the screen — even on an empty "Nog niks gelogd" shell.
  // Johnny's device-test flagged this: "there's a stopwatch ticking on a
  // workout I haven't started yet."
  //
  // New behavior: the session starts implicitly on the first `addSet` /
  // `addSetWithPrefill` — the store auto-sets `startedAt` at that moment.
  // An empty active-workout screen therefore has `startedAt === null`,
  // and the WorkoutHeader knows to hide its TRAINING · mm:ss label in
  // that state. Resume-flow is unaffected (an already-started session has
  // `startedAt` set, which persists via zustand's AsyncStorage layer).
  //
  // If the user finishes or discards a session the store resets back to
  // EMPTY_STATE (startedAt=null), and if they re-enter the screen fresh,
  // the new pattern applies again. No explicit bootstrap needed.

  // ── Group sets per exercise ────────────────────────────────────────
  const buckets: ExerciseBucket[] = useMemo(() => {
    if (!exercises) return [];
    const byId = new Map<string, Exercise>();
    for (const e of exercises) byId.set(e.id, e);

    const result: ExerciseBucket[] = [];
    let current: ExerciseBucket | null = null;
    for (const s of sets) {
      const ex = byId.get(s.exerciseId);
      if (!ex) continue;
      if (!current || current.exerciseId !== s.exerciseId) {
        current = { exerciseId: s.exerciseId, exercise: ex, setLocalIds: [] };
        result.push(current);
      }
      current.setLocalIds.push(s.localId);
    }
    return result;
  }, [sets, exercises]);

  // ── Volume calculation (weight × reps on completed sets only) ──────
  const volumeKg = useMemo(() => {
    let total = 0;
    for (const s of sets) {
      if (
        s.completed &&
        s.weightKg !== null &&
        s.reps !== null &&
        s.weightKg > 0 &&
        s.reps > 0
      ) {
        total += s.weightKg * s.reps;
      }
    }
    return total;
  }, [sets]);

  const completedSetCount = useMemo(
    () => sets.reduce((acc, s) => acc + (s.completed ? 1 : 0), 0),
    [sets],
  );

  // ── Dynamic H1: muscle-group summary of current buckets ─────────────
  // Builds a list like "Borst · Triceps" from the unique primary_muscle
  // values of exercises in this session. `null` when the workout is
  // empty (first-open, no exercises yet) — WorkoutHeader then hides the
  // H1 slot entirely so the empty-state reads as a blank canvas.
  const muscleTitle = useMemo<string | null>(() => {
    if (buckets.length === 0) return null;
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const b of buckets) {
      const m = b.exercise.primary_muscle;
      if (seen.has(m)) continue;
      seen.add(m);
      parts.push(t(`picker.muscleGroups.${m}` as never));
    }
    return t('workout.muscleGroupsTitle', { groups: parts.join(' · ') });
  }, [buckets, t]);

  const elapsed = useElapsedTime(startedAt);

  // ── Prefill-aware add-set helper ───────────────────────────────────
  // Centralizes the three code paths (picker-return, +set in a bucket,
  // programmatic add). Each path decides what values to seed:
  //   1. If the bucket already has sets in this workout → carry-forward
  //      from the last set (read synchronously via store getState).
  //   2. Otherwise → historic lookup via queryClient.ensureQueryData.
  //
  // The function is async because it may await the TanStack cache; the
  // store write + auto-focus state update happen after the promise
  // settles. Callers receive the spawned localId (or null on failure).
  const spawnPrefilledSet = useCallback(
    async (exerciseId: string): Promise<string | null> => {
      const storeSnapshot = useActiveWorkout.getState();

      let prefill: {
        weightKg: number | null;
        reps: number | null;
        seconds: number | null;
      };

      if (hasExistingBucket(storeSnapshot.sets, exerciseId)) {
        // Carry-forward: read the most-recent set in this bucket. Prefer
        // a completed set if present; otherwise fall back to the last
        // placeholder's (possibly null) typed values.
        const bucketSets = storeSnapshot.sets.filter(
          (s) => s.exerciseId === exerciseId,
        );
        const mostRecentCompleted = [...bucketSets]
          .reverse()
          .find((s) => s.completed);
        const source = mostRecentCompleted ?? bucketSets[bucketSets.length - 1];
        prefill = {
          weightKg: source?.weightKg ?? null,
          reps: source?.reps ?? null,
          seconds: source?.seconds ?? null,
        };
      } else {
        // Historic: prime the cache if needed, then read.
        try {
          const history = await queryClient.ensureQueryData<LastSetForExercise | null>({
            queryKey: lastSetQueryKey(exerciseId),
            queryFn: () => fetchLastSetForExercise(exerciseId),
          });
          prefill = prefillFromHistory(history);
        } catch {
          // No history (offline, first-ever session, RLS hiccup) — degrade
          // to empty placeholder. The user just ends up with an empty row;
          // that's strictly no worse than the pre-redesign behavior.
          prefill = { weightKg: null, reps: null, seconds: null };
        }
      }

      addSetWithPrefill(exerciseId, prefill);
      const latest =
        useActiveWorkout.getState().sets[
          useActiveWorkout.getState().sets.length - 1
        ];
      if (!latest) return null;

      const hasPrefillValues =
        prefill.weightKg !== null ||
        prefill.reps !== null ||
        prefill.seconds !== null;
      if (hasPrefillValues) {
        markPrefilled(latest.localId);
      }
      return latest.localId;
    },
    [addSetWithPrefill, markPrefilled],
  );

  // ── Picker return wiring ───────────────────────────────────────────
  // When the picker modal closes, it writes into the picker-result store.
  // We drain on focus: spawn a placeholder with history/carry-forward
  // prefill, then auto-focus the first input.
  useFocusEffect(
    useCallback(() => {
      if (!pickerResult || !exercises) return;
      const chosen = exercises.find((e) => e.id === pickerResult);
      if (!chosen) {
        clearPickerResult();
        return;
      }
      // Fire-and-forget the async spawn; the auto-focus runs after it
      // resolves. The keyboard appears a moment later than with the
      // synchronous path, but only when there's actual history to fetch
      // (cache-miss). On cache-hit this is effectively instant.
      (async () => {
        const localId = await spawnPrefilledSet(chosen.id);
        if (localId) setAutoFocusLocalId(localId);
        clearPickerResult();
      })();
    }, [pickerResult, exercises, spawnPrefilledSet, clearPickerResult]),
  );

  // ── Handlers ────────────────────────────────────────────────────────
  const handleBackPress = () => {
    const hasWork = sets.some((s) => s.completed) || sets.length > 1;
    if (hasWork) {
      setDiscardVisible(true);
    } else {
      resetWorkout();
      resetRestTimer();
      setPrefilledLocalIds(new Set());
      Keyboard.dismiss();
      router.back();
    }
  };

  const handleDiscardConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDiscardVisible(false);
    resetWorkout();
    resetRestTimer();
    setPrefilledLocalIds(new Set());
    Keyboard.dismiss();
    router.back();
  };

  const handleAddExercise = () => {
    Haptics.selectionAsync();
    Keyboard.dismiss();
    router.push('/picker/exercises' as never);
  };

  const handleAddSetToBucket = useCallback(
    (exerciseId: string) => {
      Haptics.selectionAsync();
      (async () => {
        const localId = await spawnPrefilledSet(exerciseId);
        if (localId) setAutoFocusLocalId(localId);
      })();
    },
    [spawnPrefilledSet],
  );

  const handleUpdateSet = useCallback(
    (localId: string, patch: Partial<Parameters<typeof updateSet>[1]>) => {
      updateSet(localId, patch);
    },
    [updateSet],
  );

  const handleRequestDelete = useCallback(
    (localId: string) => {
      removeSet(localId);
    },
    [removeSet],
  );

  const handleRequestDeleteExercise = useCallback(
    (exerciseId: string) => {
      const bucket = buckets.find((b) => b.exerciseId === exerciseId);
      if (!bucket) return;
      const setCount = sets.reduce(
        (acc, s) => acc + (s.exerciseId === exerciseId ? 1 : 0),
        0,
      );
      setDeleteExerciseTarget({
        exerciseId,
        name: bucket.exercise.name,
        setCount,
      });
    },
    [buckets, sets],
  );

  const handleConfirmDeleteExercise = useCallback(() => {
    if (!deleteExerciseTarget) return;
    removeExercise(deleteExerciseTarget.exerciseId);
    setAutoFocusLocalId(null);
    setDeleteExerciseTarget(null);
  }, [deleteExerciseTarget, removeExercise]);

  const handleOpenFinish = () => {
    if (completedSetCount === 0) {
      setToastMessage(t('workout.emptyTitle'));
      return;
    }
    Haptics.selectionAsync();
    Keyboard.dismiss();
    setFinishVisible(true);
  };

  const handleConfirmFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeWorkout();
    scheduleImmediate();

    const formattedVolume = Math.round(volumeKg).toLocaleString('nl-NL');
    setToastMessage(t('workout.finishToast', { volume: formattedVolume }));
    setFinishVisible(false);
    setTimeout(() => {
      resetWorkout();
      resetRestTimer();
      setPrefilledLocalIds(new Set());
      router.back();
    }, 500);
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <WorkoutHeader
          name={name}
          startedAt={startedAt}
          exerciseCount={buckets.length}
          volumeKg={volumeKg}
          muscleTitle={muscleTitle}
          onPressBack={handleBackPress}
        />

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pt-4 pb-32"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {buckets.map((bucket) => {
            const bucketSets = sets.filter(
              (s) => s.exerciseId === bucket.exerciseId,
            );
            return (
              <ExerciseGroup
                key={bucket.exerciseId + (bucket.setLocalIds[0] ?? 'empty')}
                exercise={bucket.exercise}
                equipmentLabel={t(`picker.equipment.${bucket.exercise.equipment}` as never)}
                sets={bucketSets}
                onUpdateSet={handleUpdateSet}
                onAddSet={() => handleAddSetToBucket(bucket.exerciseId)}
                onRequestDelete={handleRequestDelete}
                onRequestDeleteExercise={handleRequestDeleteExercise}
                autoFocusFirstLocalId={autoFocusLocalId}
                prefilledLocalIds={prefilledLocalIds}
                onSetCommitted={handleSetCommitted}
                onCarryForwardSpawned={markPrefilled}
              />
            );
          })}

          {buckets.length === 0 && (
            <View className="mt-4 rounded-card border border-dashed border-surface-elevated bg-surface p-5">
              <Text className="text-body font-inter-semibold text-content">
                {t('workout.emptyTitle')}
              </Text>
              <Text className="mt-1 font-inter text-body text-content-secondary">
                {t('workout.emptySubtitle')}
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleAddExercise}
            className="mt-2 h-14 items-center justify-center rounded-button border border-surface-elevated bg-transparent active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={t('workout.addExerciseCta')}
          >
            <Text className="text-body font-inter-semibold text-content">
              {t('workout.addExerciseCta')}
            </Text>
          </Pressable>
        </ScrollView>

        {/* CommitFlashStrip — transient lime ack above the keyboard.
            Sits above the Finish CTA so the keyboard-avoiding-view lifts
            it with the keyboard. */}
        <View className="absolute bottom-20 left-0 right-0">
          <CommitFlashStrip
            visible={flashMessage !== null}
            message={flashMessage}
            onHide={handleFlashHide}
          />
        </View>

        {/* Floating Finish CTA */}
        <View className="absolute bottom-4 left-5 right-5">
          <Pressable
            onPress={handleOpenFinish}
            disabled={completedSetCount === 0}
            className={`h-14 items-center justify-center rounded-pill ${
              completedSetCount === 0
                ? 'bg-surface-elevated'
                : 'bg-primary active:opacity-90'
            }`}
            accessibilityRole="button"
            accessibilityLabel={
              completedSetCount === 0
                ? t('workout.finishCtaEmpty')
                : t('workout.finishCta')
            }
            accessibilityState={{ disabled: completedSetCount === 0 }}
          >
            <Text
              className={`text-body font-inter-semibold ${
                completedSetCount === 0
                  ? 'text-content-muted'
                  : 'text-background'
              }`}
            >
              {completedSetCount === 0
                ? t('workout.finishCtaEmpty')
                : t('workout.finishCta')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <DiscardModal
        visible={discardVisible}
        onCancel={() => setDiscardVisible(false)}
        onConfirm={handleDiscardConfirm}
      />

      <DeleteExerciseModal
        visible={deleteExerciseTarget !== null}
        exerciseName={deleteExerciseTarget?.name ?? ''}
        setCount={deleteExerciseTarget?.setCount ?? 0}
        onCancel={() => setDeleteExerciseTarget(null)}
        onConfirm={handleConfirmDeleteExercise}
      />

      <FinishSheet
        visible={finishVisible}
        elapsed={elapsed}
        exerciseCount={buckets.length}
        setCount={completedSetCount}
        volumeKg={volumeKg}
        onCancel={() => setFinishVisible(false)}
        onConfirm={handleConfirmFinish}
      />

      <Toast
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => setToastMessage(null)}
      />
    </SafeAreaView>
  );
}
