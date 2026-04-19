/**
 * stores/restTimer.ts
 *
 * In-memory rest-timer state for the active workout screen.
 *
 * Why a dedicated store
 * ---------------------
 * The rest timer is triggered from a WeightRepsRow (when the user flips
 * a set to completed) and READ from the WorkoutHeader. Threading a
 * callback through 3 component layers just to start a timer is noisier
 * than a tiny zustand store — and the timer value doesn't belong on the
 * workout draft itself (it's ephemeral, not part of what we sync).
 *
 * Contract
 * --------
 *   start()   — call when a set is just completed. Sets startedAtMs=now.
 *   stop()    — call when the user taps the next row's kg input (the
 *               "I'm lifting again" signal). Clears startedAtMs.
 *   reset()   — same as stop(), nicer alias from a caller perspective.
 *
 * Persistence
 * -----------
 * Deliberately NONE. If the app is killed mid-rest the timer is gone,
 * which is fine — resting is a real-world activity the user can re-
 * initiate by eyeballing a clock. Persisting it would require syncing
 * with wall-clock drift and that's not worth the complexity.
 */

import { create } from 'zustand';

type RestTimerState = {
  /** `null` = no active rest. Milliseconds since epoch otherwise. */
  startedAtMs: number | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

export const useRestTimer = create<RestTimerState>((set) => ({
  startedAtMs: null,
  start: () => set({ startedAtMs: Date.now() }),
  stop: () => set({ startedAtMs: null }),
  reset: () => set({ startedAtMs: null }),
}));
