/**
 * stores/onboardingDraft.ts
 *
 * Purpose
 * -------
 * In-flight, client-only draft state for the 5-step onboarding funnel
 * (T-108 → T-112). Persists to AsyncStorage via zustand's `persist`
 * middleware so a user who kills the app mid-onboarding resumes where they
 * left off instead of starting over.
 *
 * Lifecycle
 * ---------
 * - **Written** by T-108 (displayName, biologicalSex), T-109 (experienceBucket),
 *   T-110 (usageType), T-111 (plan preferences: trainingFrequencyPerWeek,
 *   preferredSplit, focusMuscleGroups), and T-112 (injuries).
 * - **Read + flushed + cleared** by T-113 once the final step submits to
 *   Supabase. On successful profile insert T-113 calls `clear()`.
 *
 * Public interface
 * ----------------
 * Each field has a paired setter (`setXxx`). Each step screen writes ONLY
 * its own fields — never another step's. This keeps the "who owns what"
 * contract trivial to audit.
 *
 * Storage key
 * -----------
 * `'ronex-onboarding-draft'` in AsyncStorage. Deliberately prefixed so it's
 * trivial to grep / wipe during dev.
 *
 * Migration strategy
 * ------------------
 * Kept simple for now — no `version` field, no migrations. If the shape
 * changes before launch, bump the storage key name (e.g. `-v2`) and let old
 * drafts fall on the floor. Onboarding is a one-shot flow so stale drafts
 * are low-risk.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BiologicalSex = 'male' | 'female' | null;
export type ExperienceBucket = '<1y' | '1-3y' | '3-5y' | '5+y' | null;
export type UsageType = 'loose' | 'plan' | null;

// Aligned with supabase/migrations/20260418000000_profiles.sql injury_t enum
// (15 values, 14 anatomical + 'other').
export type Injury =
  | 'lower_back'
  | 'upper_back'
  | 'neck'
  | 'shoulder_left'
  | 'shoulder_right'
  | 'elbow'
  | 'wrist'
  | 'knee_left'
  | 'knee_right'
  | 'hip'
  | 'ankle'
  | 'hamstring'
  | 'groin'
  | 'achilles'
  | 'other';

interface OnboardingDraftState {
  // T-108 fields
  displayName: string;
  biologicalSex: BiologicalSex;

  // T-109 fields
  experienceBucket: ExperienceBucket;

  // T-110 fields
  usageType: UsageType;

  // T-111 fields (only relevant when usageType === 'plan')
  trainingFrequencyPerWeek: number | null;
  preferredSplit: string | null;
  focusMuscleGroups: string[];

  // T-112 fields
  injuries: Injury[];

  // Actions — each step writes only its own fields.
  setDisplayName: (name: string) => void;
  setBiologicalSex: (sex: BiologicalSex) => void;
  setExperienceBucket: (bucket: ExperienceBucket) => void;
  setUsageType: (type: UsageType) => void;
  setTrainingFrequencyPerWeek: (freq: number | null) => void;
  setPreferredSplit: (split: string | null) => void;
  setFocusMuscleGroups: (groups: string[]) => void;
  setInjuries: (injuries: Injury[]) => void;

  // T-113 calls this after a successful profile insert.
  clear: () => void;
}

const EMPTY_DRAFT: Omit<
  OnboardingDraftState,
  | 'setDisplayName'
  | 'setBiologicalSex'
  | 'setExperienceBucket'
  | 'setUsageType'
  | 'setTrainingFrequencyPerWeek'
  | 'setPreferredSplit'
  | 'setFocusMuscleGroups'
  | 'setInjuries'
  | 'clear'
> = {
  displayName: '',
  biologicalSex: null,
  experienceBucket: null,
  usageType: null,
  trainingFrequencyPerWeek: null,
  preferredSplit: null,
  focusMuscleGroups: [],
  injuries: [],
};

export const useOnboardingDraft = create<OnboardingDraftState>()(
  persist(
    (set) => ({
      ...EMPTY_DRAFT,

      setDisplayName: (name) => set({ displayName: name }),
      setBiologicalSex: (sex) => set({ biologicalSex: sex }),
      setExperienceBucket: (bucket) => set({ experienceBucket: bucket }),

      // T-110: when the user switches from 'plan' back to 'loose' (typically
      // via back-chevron + reselect), we clear the plan-only fields so a
      // later flush doesn't persist stale selections the user abandoned.
      // Setter-level is the correct seam because it's the single write-point
      // for usageType: any caller (screen, devtool, future deep-link) that
      // flips to 'loose' gets the invariant enforced automatically. Putting
      // it in the onContinue handler would split the rule across callsites
      // and let a future caller forget it.
      //
      // Note: we do NOT clear when switching 'loose' -> 'plan'. The plan
      // fields are written by T-111 AFTER that switch, so the existing
      // defaults (null, null, []) are already correct.
      setUsageType: (type) =>
        set((state) => {
          if (type === 'loose' && state.usageType === 'plan') {
            return {
              usageType: type,
              trainingFrequencyPerWeek: null,
              preferredSplit: null,
              focusMuscleGroups: [],
            };
          }
          return { usageType: type };
        }),
      setTrainingFrequencyPerWeek: (freq) =>
        set({ trainingFrequencyPerWeek: freq }),
      setPreferredSplit: (split) => set({ preferredSplit: split }),
      setFocusMuscleGroups: (groups) => set({ focusMuscleGroups: groups }),
      setInjuries: (injuries) => set({ injuries }),

      clear: () => set({ ...EMPTY_DRAFT }),
    }),
    {
      name: 'ronex-onboarding-draft',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
