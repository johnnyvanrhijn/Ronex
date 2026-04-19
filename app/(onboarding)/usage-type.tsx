/**
 * app/(onboarding)/usage-type.tsx
 *
 * T-110 — Onboarding screen 3/5: loose vs. plan.
 *
 * Replaces the T-113 stub. Users pick how they want to train:
 *   - 'loose' → freeform logging; next step is injuries (T-112).
 *   - 'plan'  → structured schedule; next step is plan preferences (T-111).
 *
 * Design decisions (Johnny's approval notes, 2026-04-19):
 *   1. Stacked cards (not a pill-pair) — consistent visual rhythm with the
 *      experience-bucket screen, just larger. Same border-radius (input),
 *      same surface token, same 1→2px primary border on select. Cards are
 *      h-28 (vs h-16 on experience) because they stack a title + helper.
 *   2. No small-caps LABEL above the card group — the title + subtitle
 *      already claim the screen. Card structure is strictly:
 *        - title  (body semibold, normal case)
 *        - helper (small-caps-helper, one-line, muted)
 *   3. NO skip link. Continue stays disabled until a choice is made. No
 *      default selection — we do not want to nudge users toward one path.
 *   4. Switching from 'plan' to 'loose' clears plan-specific draft fields.
 *      Implemented in the store setter (see stores/onboardingDraft.ts
 *      setUsageType), NOT here — rationale in that file.
 *
 * Routing (conditional on choice):
 *   - 'loose' → /(onboarding)/injuries         (T-112)
 *   - 'plan'  → /(onboarding)/plan-preferences (T-111)
 *
 * Both next-routes exist from T-112 onwards — no more flush-and-go fallback.
 * The terminal screen (injuries) owns the flush + redirect.
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
import {
  useOnboardingDraft,
  type UsageType,
} from '@/stores/onboardingDraft';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Palette mirrors tailwind.config.js / lib/theme.ts — kept in sync manually
// for the reanimated interpolateColor transitions (shared-value land, no
// className).
const COLOR_SURFACE_ELEVATED = '#262626';
const COLOR_PRIMARY = '#22C55E';
const COLOR_BACKGROUND = '#0A0A0A';
const COLOR_CONTENT_MUTED = '#525252';

// Concrete options — null is the "no selection yet" state, not a third card.
type ConcreteUsage = Exclude<UsageType, null>;

// Literal-union keeps `t(option.titleKey)` strongly typed against the i18n
// resource types in `i18n/i18next.d.ts`.
type UsageTitleKey =
  | 'onboarding.usageTypeLooseTitle'
  | 'onboarding.usageTypePlanTitle';
type UsageHelperKey =
  | 'onboarding.usageTypeLooseHelper'
  | 'onboarding.usageTypePlanHelper';

const OPTIONS: ReadonlyArray<{
  value: ConcreteUsage;
  titleKey: UsageTitleKey;
  helperKey: UsageHelperKey;
}> = [
  {
    value: 'loose',
    titleKey: 'onboarding.usageTypeLooseTitle',
    helperKey: 'onboarding.usageTypeLooseHelper',
  },
  {
    value: 'plan',
    titleKey: 'onboarding.usageTypePlanTitle',
    helperKey: 'onboarding.usageTypePlanHelper',
  },
];

export default function UsageTypeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const storedUsage = useOnboardingDraft((s) => s.usageType);
  const setUsageType = useOnboardingDraft((s) => s.setUsageType);

  // Local state mirrors the store for the screen's lifetime — write-on-
  // continue pattern, same as identity/experience. Hydrating from the store
  // on mount means back-navigating from plan-preferences or injuries
  // restores the previous pick.
  const [selected, setSelected] = useState<ConcreteUsage | null>(
    storedUsage === null ? null : storedUsage,
  );

  const isValid = selected !== null;
  const enabled = isValid;

  // CTA color/text transition — 200ms ease-out, identical to identity.tsx
  // and experience.tsx so the CTA reads the same across the funnel.
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

  const handleSelect = (value: ConcreteUsage) => {
    Haptics.selectionAsync();
    setSelected(value);
  };

  const handleContinue = () => {
    if (!enabled || !selected) return;
    Haptics.selectionAsync();

    // Commit to the store. The setter itself enforces the
    // plan→loose clearing invariant — see stores/onboardingDraft.ts.
    setUsageType(selected);

    if (selected === 'plan') {
      // T-111 — plan-branch routes through the frequency/split picker first.
      router.push('/(onboarding)/plan-preferences');
      return;
    }

    // selected === 'loose' — T-112 loose-branch goes straight to injuries.
    router.push('/(onboarding)/injuries');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header — screen 3 of 5, back chevron slotted into progress. */}
        <OnboardingProgress step={3} total={5} leading={<BackChevron />} />

        {/* Content */}
        <View className="flex-1">
          <Text
            className="mt-8 px-6 text-display-lg text-content"
            accessibilityRole="header"
          >
            {t('onboarding.usageTypeTitle')}
          </Text>

          {/* Subtitle — small-caps-helper variant (normal case, not uppercase).
              See docs/design-system.md §Typography casing. */}
          <Text
            className="mt-2 px-6 text-small-caps text-content-muted"
            style={{ textTransform: 'none', lineHeight: 16 }}
          >
            {t('onboarding.usageTypeSubtitle')}
          </Text>

          {/* Option cards — 2 stacked, h-28 each. Same styling primitives as
              experience-bucket rows (surface bg, rounded-input, border 1→2px
              primary on select). Larger height absorbs title + helper. */}
          <View className="mt-8 px-6">
            {OPTIONS.map((option, index) => (
              <UsageCard
                key={option.value}
                value={option.value}
                title={t(option.titleKey)}
                helper={t(option.helperKey)}
                selected={selected === option.value}
                onSelect={handleSelect}
                // `mt-3` on all rows except the first — matches the
                // 12px rhythm used by bucket rows on experience.tsx.
                spacingTop={index > 0}
              />
            ))}
          </View>
        </View>

        {/* Bottom CTA — thumb zone. No skip link; users must pick. */}
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

type UsageCardProps = {
  value: ConcreteUsage;
  title: string;
  helper: string;
  selected: boolean;
  onSelect: (value: ConcreteUsage) => void;
  /** When true, adds `mt-3` — applied to the second card only. */
  spacingTop: boolean;
};

/**
 * Stacked selection card. Taller than a bucket row (h-28 vs h-16) to hold a
 * title + helper line. Styling primitives are intentionally identical to
 * BucketRow on experience.tsx:
 *   - surface background (bg-surface)
 *   - rounded-input corners
 *   - 1px surface-elevated border, flips to 2px primary on select
 *   - left-aligned text, px-5 horizontal padding
 * The selected/unselected title colour flip (text-content-secondary →
 * text-content) mirrors the bucket row as well.
 *
 * Typography:
 *   - Title: `text-body font-inter-semibold`, normal case.
 *   - Helper: small-caps-helper variant (same token as experience subtitle —
 *     fontSize 12, lineHeight 16, letter-spacing default (not uppercase)),
 *     muted colour. One line, `numberOfLines={1}` to enforce the contract.
 */
function UsageCard({
  value: _value,
  title,
  helper,
  selected,
  onSelect,
  spacingTop,
}: UsageCardProps) {
  return (
    <Pressable
      onPress={() => onSelect(_value)}
      className={`h-28 justify-center rounded-input bg-surface px-5 ${
        spacingTop ? 'mt-3' : ''
      } ${selected ? 'border-2 border-primary' : 'border border-surface-elevated'}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${helper}`}
    >
      <Text
        className={`text-body font-inter-semibold ${
          selected ? 'text-content' : 'text-content-secondary'
        }`}
      >
        {title}
      </Text>
      <Text
        className="mt-1 text-small-caps text-content-muted"
        style={{ textTransform: 'none', lineHeight: 16 }}
        numberOfLines={1}
      >
        {helper}
      </Text>
    </Pressable>
  );
}
