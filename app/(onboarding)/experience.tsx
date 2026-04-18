import React, { useState, useEffect } from 'react';
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
  type ExperienceBucket,
} from '@/stores/onboardingDraft';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Palette mirrors tailwind.config.js / lib/theme.ts — kept in sync manually
// for the reanimated interpolateColor transitions (shared-value land, no
// className).
const COLOR_SURFACE_ELEVATED = '#262626';
const COLOR_PRIMARY = '#22C55E';
const COLOR_BACKGROUND = '#0A0A0A';
const COLOR_CONTENT_MUTED = '#525252';

// The 4 concrete buckets (nullable skip is handled separately via the skip
// link, not as a 5th bucket — see proposal §6).
type ConcreteBucket = Exclude<ExperienceBucket, null>;

// Literal-union keeps `t(bucket.labelKey)` strongly typed against the i18n
// resource types in `i18n/i18next.d.ts`.
type BucketLabelKey =
  | 'onboarding.experienceBucketLt1y'
  | 'onboarding.experienceBucket1to3y'
  | 'onboarding.experienceBucket3to5y'
  | 'onboarding.experienceBucketGte5y';

const BUCKETS: ReadonlyArray<{ value: ConcreteBucket; labelKey: BucketLabelKey }> = [
  { value: '<1y', labelKey: 'onboarding.experienceBucketLt1y' },
  { value: '1-3y', labelKey: 'onboarding.experienceBucket1to3y' },
  { value: '3-5y', labelKey: 'onboarding.experienceBucket3to5y' },
  { value: '5+y', labelKey: 'onboarding.experienceBucketGte5y' },
];

export default function ExperienceScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const storedBucket = useOnboardingDraft((s) => s.experienceBucket);
  const setExperienceBucket = useOnboardingDraft((s) => s.setExperienceBucket);

  // Local state mirrors the store during the screen's lifetime (write-on-
  // continue pattern, same as identity.tsx). Reading from the store on init
  // restores prior selection when the user navigates back from screen 3.
  const [selected, setSelected] = useState<ConcreteBucket | null>(
    storedBucket === null ? null : storedBucket,
  );

  const isValid = selected !== null;

  // CTA color/text transition — 200ms ease-out, identical to identity.tsx.
  const enabledProgress = useSharedValue(0);
  useEffect(() => {
    enabledProgress.value = withTiming(isValid ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [isValid, enabledProgress]);

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

  const handleSelect = (value: ConcreteBucket) => {
    Haptics.selectionAsync();
    setSelected(value);
  };

  // TODO(T-110): replace with the typed `/(onboarding)/usage-type` route
  // once that screen exists. Typed-routes (`experiments.typedRoutes: true` in
  // `app.json`) can't resolve a file that doesn't exist yet, so we cast
  // through `any` as a deliberate forward-reference.
  const nextRoute = '/(onboarding)/usage-type' as any;

  const handleContinue = () => {
    if (!isValid) return;
    Haptics.selectionAsync();
    setExperienceBucket(selected);
    router.push(nextRoute);
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    setExperienceBucket(null);
    router.push(nextRoute);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header — back chevron slotted into progress via leading prop. */}
        <OnboardingProgress step={2} total={5} leading={<BackChevron />} />

        {/* Content */}
        <View className="flex-1">
          <Text
            className="mt-8 px-6 text-display-lg text-content"
            accessibilityRole="header"
          >
            {t('onboarding.experienceTitle')}
          </Text>

          {/* Subtitle — small-caps-helper variant (normal case, not uppercase).
              See docs/design-system.md §Typography casing. */}
          <Text
            className="mt-2 px-6 text-small-caps text-content-muted"
            style={{ textTransform: 'none', lineHeight: 16 }}
          >
            {t('onboarding.experienceSubtitle')}
          </Text>

          {/* Bucket list — 4 stacked full-width rows. */}
          <View className="mt-8 px-6">
            {BUCKETS.map((bucket, index) => (
              <BucketRow
                key={bucket.value}
                value={bucket.value}
                label={t(bucket.labelKey)}
                selected={selected === bucket.value}
                onSelect={handleSelect}
                // `mt-3` on all rows except the first gives the same 12px
                // rhythm as the sex-pill row on identity, just vertical.
                spacingTop={index > 0}
              />
            ))}
          </View>
        </View>

        {/* Bottom CTA — thumb zone. `mt-auto` isn't needed here because
            `flex-1` on the content `View` above absorbs the slack. */}
        <View className="px-6">
          <AnimatedPressable
            style={buttonAnimatedStyle}
            className="h-14 items-center justify-center rounded-button"
            onPress={handleContinue}
            disabled={!isValid}
            accessibilityLabel={t('common.continue')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isValid }}
          >
            <Animated.Text
              style={buttonTextAnimatedStyle}
              className="text-body font-inter-semibold"
            >
              {t('common.continue')}
            </Animated.Text>
          </AnimatedPressable>
        </View>

        {/* Skip link — subtle, anchored near safe-area bottom with visible
            gap from the Continue CTA (Johnny: "NIET direct onder Continue").
            Direct-navigates: bypasses the Continue gate. */}
        <Pressable
          onPress={handleSkip}
          className="mb-4 mt-8 h-12 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.experienceSkipLink')}
        >
          <Text
            className="text-small-caps text-content-muted"
            style={{ textTransform: 'none' }}
          >
            {t('onboarding.experienceSkipLink')}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type BucketRowProps = {
  value: ConcreteBucket;
  label: string;
  selected: boolean;
  onSelect: (value: ConcreteBucket) => void;
  /** When true, adds `mt-3` — rows 2..4 only. */
  spacingTop: boolean;
};

/**
 * Single bucket row. Border shifts 1px → 2px and surface-elevated → primary
 * on select; label text-content-secondary → text-content. Tap animation is
 * handled by React's re-render (200ms not required here — the border-width
 * change is instantaneous-on-tap per Johnny's decision 4: "confirmation
 * moment, consistency with identity screen").
 *
 * Typography: `text-body font-inter-semibold` (NOT `small-caps uppercase`)
 * per Johnny's decision 2 — consistency with sex-pills on identity, ranges
 * read cleaner in normal case.
 */
function BucketRow({
  value,
  label,
  selected,
  onSelect,
  spacingTop,
}: BucketRowProps) {
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
