/**
 * stores/exercisePickerResult.ts
 *
 * One-shot channel for handing a selected exerciseId back from the
 * exercise picker modal (T-206) to whichever screen opened it.
 *
 * Why a store (and not a query-param or navigation-param)?
 * --------------------------------------------------------
 * The picker is used from multiple entry points: active workout (T-203+
 * T-204), workout-setup (T-207), and later template creation (Phase 5).
 * Each caller has different lifecycle needs. A store:
 *   - survives the modal slide-down animation (query-params disappear
 *     with the route, so the caller would have to poll `useLocalSearchParams`
 *     which is brittle),
 *   - is de-coupled from the future Zustand workout store (T-203) so we
 *     don't create a cross-dependency this sprint,
 *   - is a single-reader pattern: the caller drains the value on mount
 *     / on focus and immediately clears it.
 *
 * Contract
 * --------
 * 1. Picker writes `selectedExerciseId` then calls `router.back()`.
 * 2. Caller, on focus (use `useFocusEffect`), reads the value. If
 *    present, it consumes it (e.g. adds the exercise to the active
 *    workout) and calls `clear()`.
 * 3. Value is transient — never persisted. Deliberately.
 */

import { create } from 'zustand';

type ExercisePickerResultState = {
  selectedExerciseId: string | null;
  setSelectedExerciseId: (id: string) => void;
  clear: () => void;
};

export const useExercisePickerResult = create<ExercisePickerResultState>(
  (set) => ({
    selectedExerciseId: null,
    setSelectedExerciseId: (id) => set({ selectedExerciseId: id }),
    clear: () => set({ selectedExerciseId: null }),
  }),
);
