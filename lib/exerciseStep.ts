/**
 * lib/exerciseStep.ts
 *
 * Equipment-aware stepper primitives for the set-logging UI.
 *
 * Why this module exists
 * ----------------------
 * Product decision 2026-04-19 (UX-herziening, ~75 → ~25 taps per workout):
 * the "+/-" weight-stepper buttons should increment by an amount that matches
 * what the user can physically change in the gym. Hardcoding "+2.5 kg" is
 * correct for a barbell (smallest standard plate is 1.25 kg, but you load
 * two sides so the effective jump is 2.5 kg) but wrong for dumbbells and
 * machines where the smallest physical increment is typically 1 kg — and
 * forcing 2.5-kg jumps there would add extra taps, defeating the whole point
 * of the redesign.
 *
 * Equipment → step mapping
 * ------------------------
 *   barbell, smith_machine     → 2.5 kg (plate-based: 2 × 1.25 kg plates)
 *   dumbbell, machine, cable,  → 1 kg  (finer-grained physical increments)
 *   kettlebell, bands, bodyweight
 *
 * Bodyweight caveat
 * -----------------
 * Bodyweight exercises normally don't surface a weight stepper (logging_type
 * is `reps_only`). The 1-kg default is only relevant if a future UI toggle
 * lets the user add "+ kg" to a bodyweight lift (weighted pull-ups, dips,
 * chin-ups). Finer-grained stepping is correct in that scenario — weighted
 * bodyweight typically uses a single belt-mounted plate + small add-ons.
 *
 * No schema changes
 * -----------------
 * This helper reads from `exercises.equipment`, which already exists. The
 * enum is sourced from `lib/queries/useExercises.ts → Equipment` so any
 * future addition to the enum triggers an exhaustiveness check here via the
 * `Equipment` type.
 *
 * Pure TS, no runtime deps. Safe to call from any layer (store, component,
 * server/edge-function).
 */

import type { Equipment } from '@/lib/queries/useExercises';

/**
 * Returns the step size (in kg) for weight-increment buttons based on
 * the exercise's equipment. See module doc for the full rationale.
 *
 * @param equipment  The exercise's `equipment` enum value.
 * @returns          Kilograms per tap on the +/- stepper.
 */
export function getWeightStep(equipment: Equipment): number {
  switch (equipment) {
    case 'barbell':
    case 'smith_machine':
      return 2.5;
    case 'dumbbell':
    case 'machine':
    case 'cable':
    case 'kettlebell':
    case 'bands':
    case 'bodyweight':
      return 1;
    default:
      // Exhaustiveness guard: if a new Equipment variant is added to the
      // enum in lib/queries/useExercises.ts, TypeScript will narrow the
      // type here to `never` only when every case above is covered. This
      // default is reachable only if someone casts an arbitrary string
      // into `Equipment` — returning 1 kg is the safest fallback.
      return 1;
  }
}

/**
 * Reps stepper is always 1 — no half-reps in the set-logging domain.
 * Exported for symmetry with `getWeightStep` so the UI can import both
 * from the same module rather than hardcoding `1` at the call site.
 */
export const REPS_STEP = 1;
