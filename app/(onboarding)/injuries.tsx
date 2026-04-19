/**
 * app/(onboarding)/injuries.tsx
 *
 * T-112 — Onboarding screen 5/5: injuries / pain points. TERMINAL screen.
 *
 * Reached from either branch of usage-type:
 *   - loose-branch → straight here (no plan-preferences detour)
 *   - plan-branch  → after plan-preferences
 *
 * Scope (Johnny's approval, 2026-04-19):
 *   - 15 enum-values from `public.injury_t` (14 anatomical + 'other')
 *   - Multi-select, each tap toggles a pill in/out of the array
 *   - Exclusive "Geen blessures" card — taps wipe the array AND mark a local
 *     `noneSelected` UI flag. Tapping any injury pill while in that state
 *     clears the flag and toggles the pill in the normal way.
 *   - Continue ("Start") is ALWAYS enabled — empty array is a legitimate
 *     state (no injuries on record). Haptic on tap, then flush + redirect.
 *
 * Layout — 3 categories (not 4), asymmetrically balanced 7-7-1:
 *   - RUG & BOVENLICHAAM (7): lower_back, upper_back, neck,
 *     shoulder_left, shoulder_right, elbow, wrist
 *   - ONDERLICHAAM (7): knee_left, knee_right, hip, ankle,
 *     hamstring, groin, achilles
 *   - OVERIG (1): other
 *
 * Category labels reuse the same token as `frequencyLabel` / `splitLabel` on
 * plan-preferences (small-caps uppercase, text-content-secondary) — NOT a
 * tappable pill. The "Geen blessures" card is visually distinguished from
 * injury pills:
 *   - Unselected: bg-surface, 1px surface-elevated border, text-content
 *     (darker than the pill's text-content-secondary — this card reads as a
 *     primary affordance, not a neutral option).
 *   - Selected: bg-primary/10 tint + 1px primary/40 border + text-primary.
 *     Intentionally SOFTER than the 2px primary border used by selected
 *     injury pills — that strong treatment signals "you added an injury";
 *     this tinted state signals "you confirmed nothing to flag".
 *
 * Separator — small-caps-muted "— OF —" centered between the Geen-blessures
 * card and the category list. Doubles as a visual beat break.
 *
 * Flush + redirect:
 *   On Start: haptic, commit to store, flushOnboardingDraft() writes the
 *   profile row, AuthProvider.refreshProfile() re-reads the profile so the
 *   onboarding gate opens, router.replace('/(tabs)') drops the user on home.
 *   The store's `clear()` is called from inside flushOnboardingDraft() on
 *   success (see lib/onboarding.ts), so this screen does NOT need to wipe
 *   the draft itself.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
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
import Toast from '@/components/Toast';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import BackChevron from '@/components/onboarding/BackChevron';
import {
  useOnboardingDraft,
  type Injury,
} from '@/stores/onboardingDraft';
import { flushOnboardingDraft } from '@/lib/onboarding';
import { useAuth } from '@/providers/AuthProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Palette mirrors tailwind.config.js / lib/theme.ts — kept in sync manually
// for the reanimated interpolateColor transitions (shared-value land, no
// className).
const COLOR_SURFACE_ELEVATED = '#262626';
const COLOR_PRIMARY = '#22C55E';
const COLOR_BACKGROUND = '#0A0A0A';
const COLOR_CONTENT_MUTED = '#525252';

// Literal-union for strongly-typed i18n lookups.
type InjuryLabelKey =
  | 'onboarding.injury.lowerBack'
  | 'onboarding.injury.upperBack'
  | 'onboarding.injury.neck'
  | 'onboarding.injury.shoulderLeft'
  | 'onboarding.injury.shoulderRight'
  | 'onboarding.injury.elbow'
  | 'onboarding.injury.wrist'
  | 'onboarding.injury.kneeLeft'
  | 'onboarding.injury.kneeRight'
  | 'onboarding.injury.hip'
  | 'onboarding.injury.ankle'
  | 'onboarding.injury.hamstring'
  | 'onboarding.injury.groin'
  | 'onboarding.injury.achilles'
  | 'onboarding.injury.other';

type InjuryOption = { value: Injury; labelKey: InjuryLabelKey };

// Upper group — rug & bovenlichaam (7 entries).
const UPPER_INJURIES: ReadonlyArray<InjuryOption> = [
  { value: 'lower_back', labelKey: 'onboarding.injury.lowerBack' },
  { value: 'upper_back', labelKey: 'onboarding.injury.upperBack' },
  { value: 'neck', labelKey: 'onboarding.injury.neck' },
  { value: 'shoulder_left', labelKey: 'onboarding.injury.shoulderLeft' },
  { value: 'shoulder_right', labelKey: 'onboarding.injury.shoulderRight' },
  { value: 'elbow', labelKey: 'onboarding.injury.elbow' },
  { value: 'wrist', labelKey: 'onboarding.injury.wrist' },
];

// Lower group — onderlichaam (7 entries).
const LOWER_INJURIES: ReadonlyArray<InjuryOption> = [
  { value: 'knee_left', labelKey: 'onboarding.injury.kneeLeft' },
  { value: 'knee_right', labelKey: 'onboarding.injury.kneeRight' },
  { value: 'hip', labelKey: 'onboarding.injury.hip' },
  { value: 'ankle', labelKey: 'onboarding.injury.ankle' },
  { value: 'hamstring', labelKey: 'onboarding.injury.hamstring' },
  { value: 'groin', labelKey: 'onboarding.injury.groin' },
  { value: 'achilles', labelKey: 'onboarding.injury.achilles' },
];

// Other group — catch-all (1 entry).
const OTHER_INJURIES: ReadonlyArray<InjuryOption> = [
  { value: 'other', labelKey: 'onboarding.injury.other' },
];

export default function InjuriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refreshProfile } = useAuth();

  const storedInjuries = useOnboardingDraft((s) => s.injuries);

  // Local state mirrors the store for the screen's lifetime — write-on-
  // continue pattern, same as every other onboarding screen. Hydrating from
  // the store on mount restores prior multi-select when the user back-
  // navigates (e.g. from a future screen or via swipe-back in the stack).
  const [selected, setSelected] = useState<Injury[]>(storedInjuries);

  // "Geen blessures" is pure UI state — the store simply holds `[]` for both
  // "user confirmed no injuries" AND "user hasn't interacted yet". This flag
  // is what distinguishes the two visuals (tinted card vs. plain card).
  // Starts `false` on first mount even if the persisted draft has an empty
  // array — we do NOT assume an empty draft means the user tapped the card.
  const [noneSelected, setNoneSelected] = useState(false);

  // Submit state — gates the Start button while the network round-trip is in
  // flight so a double-tap doesn't fire two writes.
  const [submitting, setSubmitting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Continue is ALWAYS valid — empty array is a legitimate terminal state.
  // `submitting` is the only thing that disables it.
  const enabled = !submitting;

  // CTA color/text transition — identical timing to every other onboarding
  // screen (200ms ease-out) so the primary action reads consistent. The
  // `enabled` gate here is only submit-debounce, so the CTA lights up lime
  // immediately on mount.
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

  // --- Tap handlers ---------------------------------------------------------
  //
  // Mutually-exclusive logic:
  //   - Tap "Geen blessures"    → wipe array + flip `noneSelected = true`.
  //   - Tap any injury pill     → flip `noneSelected = false` (if set) +
  //                               toggle that pill in the array.
  // The array and the flag are never both non-empty/true simultaneously.

  const handleNoneToggle = () => {
    Haptics.selectionAsync();
    if (noneSelected) {
      // Second tap on an already-selected "Geen blessures" card deselects it
      // — this mirrors the toggle semantics of every other selection on the
      // funnel. Both array and flag are now empty → Continue still valid.
      setNoneSelected(false);
      return;
    }
    // First tap: clear any previously-picked injuries AND mark the flag.
    setSelected([]);
    setNoneSelected(true);
  };

  const handleInjuryToggle = (value: Injury) => {
    Haptics.selectionAsync();
    // Any injury tap unconditionally clears the "Geen blessures" flag —
    // the two states are mutually exclusive.
    if (noneSelected) setNoneSelected(false);
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  // --- Flush + redirect -----------------------------------------------------
  const handleStart = async () => {
    if (!enabled) return;
    Haptics.selectionAsync();
    setSubmitting(true);

    // B-016 fix: pass `selected` EXPLICITLY as an override so the payload
    // reflects the exact UI state at tap time, regardless of whether a store
    // setter has committed yet. The previous implementation called
    // `setInjuries(selected)` and then immediately read the store via
    // `getState()` inside flushOnboardingDraft — that worked because zustand
    // `set()` is synchronous today, but it would break silently if the setter
    // were ever refactored to be async. Overrides make the intent explicit
    // and remove the ordering dependency entirely.
    //
    // We also skip the store write: on success, flushOnboardingDraft() calls
    // clear() which wipes the draft anyway; on error, `selected` lives in
    // local state and is re-used on retry.
    const result = await flushOnboardingDraft({ injuries: selected });
    if (!result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      let message: string;
      if (result.error === 'nameNotAvailable') {
        message = t('onboarding.nameNotAvailable');
      } else if (result.error === 'network') {
        message = t('errors.network');
      } else {
        message = t('common.errorToast');
      }
      showToast(message);
      setSubmitting(false);
      return;
    }

    // Success: pull the fresh profile so the onboarding gate re-evaluates
    // and opens, then replace the route so back-swipe can't re-enter
    // onboarding. The draft store was already cleared inside
    // flushOnboardingDraft() on success.
    await refreshProfile();
    router.replace('/(tabs)/challenge');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header — step 5/5. All five dots render filled. */}
        <OnboardingProgress step={5} total={5} leading={<BackChevron />} />

        {/* Scrollable content — the 7-7-1 grid + "Geen blessures" card can
            overflow the viewport on iPhone SE. Horizontal padding is applied
            on inner views rather than on the ScrollView itself so the
            scrollbar hugs the edge if it ever appears. */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            className="mt-8 px-6 text-display-lg text-content"
            accessibilityRole="header"
          >
            {t('onboarding.injuriesTitle')}
          </Text>

          {/* Subtitle — same small-caps-helper variant (normal case, not
              uppercase) as every other onboarding subtitle. */}
          <Text
            className="mt-2 px-6 text-small-caps text-content-muted"
            style={{ textTransform: 'none', lineHeight: 16 }}
          >
            {t('onboarding.injuriesSubtitle')}
          </Text>

          {/* -----------------------------------------------------------------
              "Geen blessures" card — dominant tap target, top of the list.
              Visual treatment is intentionally DIFFERENT from a selected
              injury pill:
                - Selected injury pill → 2px primary border, bright & loud.
                - Selected "Geen blessures" → bg-primary/10 tint + 1px
                  primary/40 border + text-primary. Softer, confirmatory.
              ----------------------------------------------------------------- */}
          <View className="mt-8 px-6">
            <Pressable
              onPress={handleNoneToggle}
              className={`h-14 items-center justify-center rounded-input px-5 ${
                noneSelected
                  ? 'border border-primary/40 bg-primary/10'
                  : 'border border-surface-elevated bg-surface'
              }`}
              accessibilityRole="radio"
              accessibilityState={{ selected: noneSelected }}
              accessibilityLabel={t('onboarding.injuriesNoneCard')}
            >
              <Text
                className={`text-body font-inter-semibold ${
                  noneSelected ? 'text-primary' : 'text-content'
                }`}
              >
                {t('onboarding.injuriesNoneCard')}
              </Text>
            </Pressable>
          </View>

          {/* -----------------------------------------------------------------
              Separator — thin rule + centered "— OF —" label. Marks the
              beat break between the exclusive "Geen blessures" card and the
              multi-select category grid.
              ----------------------------------------------------------------- */}
          <View className="mt-6 flex-row items-center px-6">
            <View className="h-px flex-1 bg-surface-elevated" />
            <Text
              className="mx-3 text-small-caps text-content-muted"
              style={{ textTransform: 'none' }}
            >
              {t('onboarding.injuriesSeparator')}
            </Text>
            <View className="h-px flex-1 bg-surface-elevated" />
          </View>

          {/* -----------------------------------------------------------------
              SECTION — RUG & BOVENLICHAAM (7 pills)
              Pills are rendered in a wrapping flex-row so the layout self-
              balances on different widths. Each pill is h-14 with px-5 for
              Apple HIG 44pt tap-target compliance; pill widths adapt to label
              length (no forced grid cells — Dutch and English labels differ
              enough that a fixed grid produces awkward whitespace).
              ----------------------------------------------------------------- */}
          <View className="mt-6">
            <Text className="mb-3 px-6 text-small-caps uppercase text-content-secondary">
              {t('onboarding.injuriesCategoryUpper')}
            </Text>
            <View className="flex-row flex-wrap gap-2 px-6">
              {UPPER_INJURIES.map((option) => (
                <InjuryPill
                  key={option.value}
                  value={option.value}
                  label={t(option.labelKey)}
                  selected={selected.includes(option.value)}
                  onSelect={handleInjuryToggle}
                />
              ))}
            </View>
          </View>

          {/* SECTION — ONDERLICHAAM (7 pills). Same layout primitives. */}
          <View className="mt-6">
            <Text className="mb-3 px-6 text-small-caps uppercase text-content-secondary">
              {t('onboarding.injuriesCategoryLower')}
            </Text>
            <View className="flex-row flex-wrap gap-2 px-6">
              {LOWER_INJURIES.map((option) => (
                <InjuryPill
                  key={option.value}
                  value={option.value}
                  label={t(option.labelKey)}
                  selected={selected.includes(option.value)}
                  onSelect={handleInjuryToggle}
                />
              ))}
            </View>
          </View>

          {/* SECTION — OVERIG (1 pill). Single-pill group, same treatment. */}
          <View className="mt-6">
            <Text className="mb-3 px-6 text-small-caps uppercase text-content-secondary">
              {t('onboarding.injuriesCategoryOther')}
            </Text>
            <View className="flex-row flex-wrap gap-2 px-6">
              {OTHER_INJURIES.map((option) => (
                <InjuryPill
                  key={option.value}
                  value={option.value}
                  label={t(option.labelKey)}
                  selected={selected.includes(option.value)}
                  onSelect={handleInjuryToggle}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Bottom CTA — "Start". Always enabled (except during submit). */}
        <View className="px-6 pb-4">
          <AnimatedPressable
            style={buttonAnimatedStyle}
            className="h-14 items-center justify-center rounded-button"
            onPress={handleStart}
            disabled={!enabled}
            accessibilityLabel={t('common.start')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !enabled }}
          >
            <Animated.Text
              style={buttonTextAnimatedStyle}
              className="text-body font-inter-semibold"
            >
              {t('common.start')}
            </Animated.Text>
          </AnimatedPressable>
        </View>

        <Toast
          visible={toastVisible}
          message={toastMessage}
          onHide={() => {
            setToastVisible(false);
            setToastMessage('');
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---- Sub-components ---------------------------------------------------------

type InjuryPillProps = {
  value: Injury;
  label: string;
  selected: boolean;
  onSelect: (value: Injury) => void;
};

/**
 * Single injury pill. h-14 (56pt) for gym-friendly tap, px-5 horizontal
 * padding so the label breathes inside the pill. Width is content-driven
 * (not flex-1) so pills wrap cleanly across two or three rows depending on
 * label length in the active locale.
 *
 * Styling parity with SexPill on identity.tsx and SplitRow on
 * plan-preferences.tsx:
 *   - surface bg
 *   - rounded-input corners
 *   - 1→2px primary border flip on select
 *   - text-content-secondary → text-content colour flip on select
 */
function InjuryPill({ value, label, selected, onSelect }: InjuryPillProps) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      className={`h-14 items-center justify-center rounded-input bg-surface px-5 ${
        selected ? 'border-2 border-primary' : 'border border-surface-elevated'
      }`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
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
