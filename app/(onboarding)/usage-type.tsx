/**
 * app/(onboarding)/usage-type.tsx
 *
 * T-113 STUB SCREEN. This file will be replaced when T-110/T-111/T-112 ship
 * the real usage-type / plan preferences / injuries flow. For tonight it
 * exists only so Johnny can see the onboarding funnel connect end-to-end:
 *
 *   identity -> experience -> usage-type (this stub) -> (tabs)
 *
 * The Klaar-voor-vandaag CTA calls `flushOnboardingDraft()` which writes
 * display_name + biological_sex + experience_bucket + timezone +
 * onboarding_completed_at to the profiles row. On success it calls
 * `refreshProfile()` so the AuthProvider gate re-evaluates, then
 * `router.replace('/(tabs)')` so the onboarding stack is not retained in
 * the back-swipe history.
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
import Toast from '@/components/Toast';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import BackChevron from '@/components/onboarding/BackChevron';
import { flushOnboardingDraft } from '@/lib/onboarding';
import { useAuth } from '@/providers/AuthProvider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Palette mirrors tailwind.config.js / lib/theme.ts — kept in sync manually
// for reanimated interpolateColor transitions (shared-value land, no
// className).
const COLOR_SURFACE_ELEVATED = '#262626';
const COLOR_PRIMARY = '#22C55E';
const COLOR_BACKGROUND = '#0A0A0A';
const COLOR_CONTENT_MUTED = '#525252';

export default function UsageTypeStubScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refreshProfile } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Button state mirror of identity.tsx / experience.tsx: animated bg + text
  // color. Stub is always-enabled (no validation needed), but we still run
  // the transition to arrive at the "active" palette on mount — keeps the
  // visual language consistent across the funnel.
  const enabledProgress = useSharedValue(0);
  useEffect(() => {
    enabledProgress.value = withTiming(submitting ? 0 : 1, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [submitting, enabledProgress]);

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

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const handleDone = async () => {
    if (submitting) return;
    Haptics.selectionAsync();
    setSubmitting(true);

    const result = await flushOnboardingDraft();

    if (!result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // `result.error` is an i18n key returned by lib/onboarding.ts:mapError.
      // Fall back to the generic error toast if the key doesn't resolve.
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

    // Re-read the profile row so the gate picks up onboarding_completed_at
    // flipping from null → timestamp. `router.replace` afterward doubles as
    // a safety net — even if the gate reacts first, we land on (tabs).
    await refreshProfile();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header — stub sits at step 3 of 5, mirroring the real T-110 slot. */}
        <OnboardingProgress step={3} total={5} leading={<BackChevron />} />

        {/* Content */}
        <View className="flex-1">
          <Text
            className="mt-8 px-6 text-display-lg text-content"
            accessibilityRole="header"
          >
            {t('onboarding.stubTitle')}
          </Text>

          {/* Subtitle — small-caps-helper variant (normal case, not uppercase).
              See docs/design-system.md §Typography casing. */}
          <Text
            className="mt-2 px-6 text-small-caps text-content-muted"
            style={{ textTransform: 'none', lineHeight: 16 }}
          >
            {t('onboarding.stubSubtitle')}
          </Text>
        </View>

        {/* Bottom CTA — Klaar voor vandaag */}
        <View className="px-6 pb-4">
          <AnimatedPressable
            style={buttonAnimatedStyle}
            className="h-14 items-center justify-center rounded-button"
            onPress={handleDone}
            disabled={submitting}
            accessibilityLabel={t('onboarding.stubDone')}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting }}
          >
            <Animated.Text
              style={buttonTextAnimatedStyle}
              className="text-body font-inter-semibold"
            >
              {t('onboarding.stubDone')}
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
