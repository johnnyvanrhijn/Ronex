/**
 * lib/queries/useExercises.ts
 *
 * TanStack Query hook that fetches the canonical exercise library (T-105
 * seed, 118 rows). Used by the exercise picker (T-206).
 *
 * Caching strategy
 * ----------------
 * `staleTime: Infinity` + `gcTime: Infinity` — the exercise library is
 * *canonical*: read-only per RLS policy and only ever changes via a new
 * migration + redeploy. Fetching once per app session is correct.
 * A user who cold-starts the app incurs one round-trip; from then on
 * the picker opens instantly.
 *
 * Sort
 * ----
 * Client-side: compound DESC, then name ASC. Matches T-206 decision 8.
 * Doing it client-side (118 rows is nothing) keeps the Supabase query
 * flat and lets the picker reorder freely if we ever add per-muscle or
 * per-equipment sub-sorts without round-tripping.
 *
 * Shape
 * -----
 * We select only the fields the picker needs. Full-fat rows (gender bias,
 * movement pattern, difficulty, secondary muscles) are added lazily when
 * downstream screens require them (T-207, T-304 AI prompt).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'smith_machine'
  | 'bands';

export type LoggingType =
  | 'weight_reps'
  | 'reps_only'
  | 'time_seconds'
  | 'distance_weight';

export type Exercise = {
  id: string;
  name: string;
  primary_muscle: MuscleGroup;
  equipment: Equipment;
  logging_type: LoggingType;
  is_compound: boolean;
  is_unilateral: boolean;
};

const EXERCISE_FIELDS =
  'id, name, primary_muscle, equipment, logging_type, is_compound, is_unilateral';

export const exercisesQueryKey = ['exercises'] as const;

async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select(EXERCISE_FIELDS);

  if (error) {
    throw new Error(`Failed to load exercises: ${error.message}`);
  }

  const rows = (data ?? []) as Exercise[];

  // Compound-first, then alphabetical by name (T-206 decision 8).
  // `localeCompare` keeps Dutch/English collation predictable.
  return [...rows].sort((a, b) => {
    if (a.is_compound !== b.is_compound) {
      return a.is_compound ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Fetches + caches the canonical exercise library.
 *
 * Usage:
 *   const { data, isLoading, error } = useExercises();
 *
 * Callers get a pre-sorted array (compound DESC, name ASC).
 */
export function useExercises() {
  return useQuery({
    queryKey: exercisesQueryKey,
    queryFn: fetchExercises,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
