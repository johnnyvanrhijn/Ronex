/**
 * app/(onboarding)/plan-preferences.tsx
 *
 * T-111 — Onboarding screen 4/5: training frequency + split.
 *
 * Only rendered when the user picked `usage_type === 'plan'` on screen 3.
 * Loose-path users skip this screen entirely (see usage-type.tsx routing).
 *
 * Scope (Johnny's approval, 2026-04-19):
 *   - frequency (1-7 days/week) + preferred_split (enum of 4)
 *   - focus_muscle_groups is OUT OF MVP — stays in schema default `{}`.
 *   - No validation between the two fields. All combos allowed; T-304's AI
 *     plan-generator adapts to whatever the user picks.
 *   - No defaults. Both fields unset → Continue disabled.
 *
 * Styling primitives are intentionally reused from identity.tsx /
 * experience.tsx / usage-type.tsx: bg-surface cards, rounded-input, 1→2px
 * primary border on select, 200ms ease-out CTA interpolate, same h-14 CTA,
 * same Haptics.selectionAsync on every tap.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import BackChevron from '@/components/onboarding/BackChevron';
import { useOnboardingDraft } from '@/stores/onboardingDraft';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Palette mirrors tailwind.config.js / lib/theme.ts — kept in sync manually
// for the reanimated interpolateColor transitions (shared-value land, no
// className).
const COLOR_SURFACE_ELEVATED = '#262626';
const COLOR_PRIMARY = '#22C55E';
const COLOR_BACKGROUND = '#0A0A0A';
const COLOR_CONTENT_MUTED = '#525252';

// ---- Preferred split enum ---------------------------------------------------
// Schema column is currently `text` (migration 20260418000000_profiles.sql
// line 135). A later migration will promote it to a Postgres enum; these four
// values are the contract that migration must respect.
type PreferredSplit = 'ppl' | 'upper_lower' | 'full_body' | 'custom';

type SplitLabelKey =
  | 'onboarding.splitPPL'
  | 'onboarding.splitUpperLower'
  | 'onboarding.splitFullBody'
  | 'onboarding.splitCustom';

const SPLITS: ReadonlyArray<{ value: PreferredSplit; labelKey: SplitLabelKey }> = [
  { value: 'ppl', labelKey: 'onboarding.splitPPL' },
  { value: 'upper_lower', labelKey: 'onboarding.splitUpperLower' },
  { value: 'full_body', labelKey: 'onboarding.splitFullBody' },
  { value: 'custom', labelKey: 'onboarding.splitCustom' },
];

// Frequency values — schema check: training_frequency_per_week between 1-7.
const FREQUENCIES: ReadonlyArray<1 | 2 | 3 | 4 | 5 | 6 | 7> = [
  1, 2, 3, 4, 5, 6, 7,
];

export default function PlanPreferencesScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const storedFreq = useOnboardingDraft((s) => s.trainingFrequencyPerWeek);
  const storedSplit = useOnboardingDraft((s) => s.preferredSplit);
  const setTrainingFrequencyPerWeek = useOnboardingDraft(
    (s) => s.setTrainingFrequencyPerWeek,
  );
  const setPreferredSplit = useOnboardingDraft((s) => s.setPreferredSplit);

  // Local state mirrors the store for the screen's lifetime — write-on-
  // continue pattern, same as every other onboarding screen. Hydrating from
  // the store on mount restores prior selection when the user back-navigates
  // from injuries (T-112).
  const [freq, setFreq] = useState<number | null>(storedFreq);
  // Narrow the stored string to our enum. If the persisted value isn't one of
  // our four (shouldn't happen, but be defensive about a stale draft), treat
  // it as unset rather than crashing the screen.
  const [split, setSplit] = useState<PreferredSplit | null>(() => {
    const known = SPLITS.find((s) => s.value === storedSplit);
    return known ? known.value : null;
  });

  const isValid = freq !== null && split !== null;
  const enabled = isValid;

  // CTA color/text transition — 200ms ease-out, identical timing to every
  // other onboarding screen so the primary action reads consistent.
  const enabledProgress = useSharedValue(0);
  useEffect(() => {
    enabledProgress.value = withTiming(enabled ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [enabled, enabledProgress]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      enabledProgress.value,
      [0, 1],
      [COLOR_SURFACE_ELEVATED, COLOR_PRIMARY],
    ),
  }));

  const buttonTextAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      enabledProgress.value,
      [0, 1],
      [COLOR_CONTENT_MUTED, COLOR_BACKGROUND],
    ),
  }));

  const handleSelectFreq = (value: number) => {
    Haptics.selectionAsync();
    setFreq(value);
  };

  const handleSelectSplit = (value: PreferredSplit) => {
    Haptics.selectionAsync();
    setSplit(value);
  };

  const handleContinue = () => {
    if (!enabled || freq === null || split === null) return;
    Haptics.selectionAsync();

    // Commit to the store. The setters are plain assignments — the store's
    // plan→loose clearing invariant lives on setUsageType (T-110), not here.
    setTrainingFrequencyPerWeek(freq);
    setPreferredSplit(split);

    // T-112 — plan-branch Continue pushes to the terminal injuries screen,
    // which owns the flush + redirect to /(tabs).
    router.push('/(onboarding)/injuries');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header — screen 4 of 5, back chevron slotted into progress. */}
        <OnboardingProgress step={4} total={5} leading={<BackChevron />} />

        {/* Content */}
        <View className="flex-1">
          <Text
            className="mt-8 px-6 text-display-lg text-content"
            accessibilityRole="header"
          >
            {t('onboarding.planPreferencesTitle')}
          </Text>

          {/* Subtitle — small-caps-helper variant (normal case, not uppercase). */}
          <Text
            className="mt-2 px-6 text-small-caps text-content-muted"
            style={{ textTransform: 'none', lineHeight: 16 }}
          >
            {t('onboarding.planPreferencesSubtitle')}
          </Text>

          {/* ---------------------------------------------------------------
              SECTION 1 — FREQUENCY
              ---------------------------------------------------------------
              Device-test result: on iPhone SE (375pt wide, px-6 → 327pt
              content), a 7-up segmented row produces ~41.6pt cells — under
              Apple's 44pt HIG minimum and genuinely hard to hit with sweaty
              hands. Swapped to a 4-up grid (row 1: 1-4, row 2: 5-7 + empty
              slot). Each cell becomes ~75pt wide × 56pt tall — clean HIG pass
              and gym-friendly. 8pt gap between cells keeps the rhythm tight.
              Per spec: this is the Designer's call, no approval needed.
              --------------------------------------------------------------- */}
          <View className="mt-8">
            <Text className="mb-3 px-6 text-small-caps uppercase text-content-secondary">
              {t('onboarding.frequencyLabel')}
            </Text>
            <View className="px-6">
              {/* Row 1 — freq 1..4 */}
              <View className="flex-row gap-2">
                {FREQUENCIES.slice(0, 4).map((value) => (
                  <FrequencyCell
                    key={value}
                    value={value}
                    selected={freq === value}
                    onSelect={handleSelectFreq}
                  />
                ))}
              </View>
              {/* Row 2 — freq 5..7 + empty 4th slot to hold grid alignment.
                  Empty slot is a non-interactive spacer View (flex-1 keeps
                  cell widths identical to row 1). */}
              <View className="mt-2 flex-row gap-2">
                {FREQUENCIES.slice(4, 7).map((value) => (
                  <FrequencyCell
                    key={value}
                    value={value}
                    selected={freq === value}
                    onSelect={handleSelectFreq}
                  />
                ))}
                <View className="flex-1" accessibilityElementsHidden />
              </View>

              {/* Helper — informational, not blocking. Same casing as other
                  subtitles on this screen. */}
              <Text
                className="mt-3 text-small-caps text-content-muted"
                style={{ textTransform: 'none', lineHeight: 16 }}
              >
                {t('onboarding.frequencyHelper')}
              </Text>
            </View>
          </View>

          {/* ---------------------------------------------------------------
              SECTION 2 — SPLIT
              ---------------------------------------------------------------
              4 stacked cards, h-16 each. Title-only — no helper (per spec
              §4 approval: "scherper dan usage-type"). Styling mirrors the
              BucketRow on experience.tsx.
              --------------------------------------------------------------- */}
          <View className="mt-8">
            <Text className="mb-3 px-6 text-small-caps uppercase text-content-secondary">
              {t('onboarding.splitLabel')}
            </Text>
            <View className="px-6">
              {SPLITS.map((option, index) => (
                <SplitRow
                  key={option.value}
                  value={option.value}
                  label={t(option.labelKey)}
                  selected={split === option.value}
                  onSelect={handleSelectSplit}
                  spacingTop={index > 0}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Bottom CTA — thumb zone. */}
        <View className="px-6 pb-4">
          <AnimatedPressable
            style={buttonAnimatedStyle}
            className="h-14 items-center justify-center rounded-button"
            onPress={handleContinue}
            disabled={!enabled}
            accessibilityLabel={t('common.continue')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !enabled }}
          >
            <Animated.Text
              style={buttonTextAnimatedStyle}
              className="text-body font-inter-semibold"
            >
              {t('common.continue')}
            </Animated.Text>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---- Sub-components ---------------------------------------------------------

type FrequencyCellProps = {
  value: number;
  selected: boolean;
  onSelect: (value: number) => void;
};

/**
 * Single frequency cell in the 4-up grid. h-14 (56pt) for gym-friendly tap,
 * flex-1 to fill its column. Styling parity with SexPill on identity.tsx and
 * BucketRow on experience.tsx: surface bg, rounded-input, 1→2px primary
 * border on select, text-content-secondary → text-content flip.
 *
 * Digit-only content uses `text-display-lg` for weight — larger number reads
 * well at the grid scale and matches the numeric-hero pattern used on the
 * home-screen stats cards.
 */
function FrequencyCell({ value, selected, onSelect }: FrequencyCellProps) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      className={`h-14 flex-1 items-center justify-center rounded-input bg-surface ${
        selected ? 'border-2 border-primary' : 'border border-surface-elevated'
      }`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={String(value)}
    >
      <Text
        className={`text-body font-inter-semibold ${
          selected ? 'text-content' : 'text-content-secondary'
        }`}
      >
        {value}
      </Text>
    </Pressable>
  );
}

type SplitRowProps = {
  value: PreferredSplit;
  label: string;
  selected: boolean;
  onSelect: (value: PreferredSplit) => void;
  /** When true, adds `mt-3` — rows 2..4 only. */
  spacingTop: boolean;
};

/**
 * Single split row. h-16 (64pt), title-only (no helper — that's what
 * distinguishes this from the usage-type cards, which are h-28 and carry a
 * helper line). All other primitives identical to BucketRow on
 * experience.tsx.
 */
function SplitRow({
  value,
  label,
  selected,
  onSelect,
  spacingTop,
}: SplitRowProps) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      className={`h-16 items-start justify-center rounded-input bg-surface px-5 ${
        spacingTop ? 'mt-3' : ''
      } ${selected ? 'border-2 border-primary' : 'border border-surface-elevated'}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text
        className={`text-body font-inter-semibold ${
          selected ? 'text-content' : 'text-content-secondary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
