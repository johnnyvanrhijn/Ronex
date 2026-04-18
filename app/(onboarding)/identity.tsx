import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
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
import {
  useOnboardingDraft,
  type BiologicalSex,
} from '@/stores/onboardingDraft';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Palette mirrors tailwind.config.js / lib/theme.ts — kept in sync manually for
// the reanimated interpolateColor transitions (shared-value land, no className).
const COLOR_SURFACE_ELEVATED = '#262626';
const COLOR_PRIMARY = '#22C55E';
const COLOR_BACKGROUND = '#0A0A0A';
const COLOR_CONTENT_MUTED = '#525252';

const MAX_NAME_LENGTH = 40;
const COUNTER_REVEAL_THRESHOLD = 30;

// TODO(T-113): replace client-side blocklist with server response handling.
// The authoritative block happens via the check_display_name_allowed()
// trigger on profiles (T-101). This local list exists ONLY so Johnny can
// exercise the error path during dev before T-113 wires the real save.
const DEV_BLOCKLIST = [
  'admin',
  'administrator',
  'moderator',
  'mod',
  'root',
  'system',
  'bot',
  'official',
  'ronex',
  'claude',
];

function hitsDevBlocklist(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  // Word-boundary match — mirrors the server-side \m...\M regex semantics
  // so dev behavior matches production behavior.
  const tokens = normalized.split(/[\s_-]+/).filter(Boolean);
  return tokens.some((token) => DEV_BLOCKLIST.includes(token));
}

export default function IdentityScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const storedName = useOnboardingDraft((s) => s.displayName);
  const storedSex = useOnboardingDraft((s) => s.biologicalSex);
  const setDisplayName = useOnboardingDraft((s) => s.setDisplayName);
  const setBiologicalSex = useOnboardingDraft((s) => s.setBiologicalSex);

  // Local state mirrors the store during the screen's lifetime. We commit to
  // the store on Continue (not on every keystroke) to avoid AsyncStorage churn.
  const [name, setName] = useState(storedName);
  const [sex, setSex] = useState<BiologicalSex>(storedSex);
  const [focused, setFocused] = useState(false);
  const [blocklistError, setBlocklistError] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const nameInputRef = useRef<TextInput>(null);

  const trimmedName = name.trim();
  const isValid = trimmedName.length >= 1 && sex !== null;

  // Auto-focus the name field after the transition settles — matches
  // enter-code.tsx timing so cross-screen behaviour stays consistent.
  useEffect(() => {
    const timer = setTimeout(() => nameInputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // CTA color/text transition — 200ms ease-out, identical to enter-code.tsx.
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

  // Counter visibility — invisible-but-laid-out until 30+ chars OR error state.
  const counterVisible =
    name.length >= COUNTER_REVEAL_THRESHOLD || blocklistError;
  const counterOpacity = useSharedValue(0);
  useEffect(() => {
    counterOpacity.value = withTiming(counterVisible ? 1 : 0, {
      duration: 150,
      easing: Easing.out(Easing.quad),
    });
  }, [counterVisible, counterOpacity]);
  const counterAnimatedStyle = useAnimatedStyle(() => ({
    opacity: counterOpacity.value,
  }));

  const handleNameChange = (text: string) => {
    setName(text);
    if (blocklistError) setBlocklistError(false);
  };

  const handleNameBlur = () => {
    setFocused(false);
    // Trim on blur, not on keystroke — users typing "John  Smith" with a
    // pause deserve their space.
    if (name !== name.trim()) setName(name.trim());
  };

  const handleSelectSex = (value: BiologicalSex) => {
    Haptics.selectionAsync();
    setSex(value);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const handleContinue = () => {
    if (!isValid) return;

    // Client-side dev blocklist check (TODO(T-113) above).
    if (hitsDevBlocklist(trimmedName)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setBlocklistError(true);
      showToast(t('onboarding.nameNotAvailable'));
      return;
    }

    Haptics.selectionAsync();
    setDisplayName(trimmedName);
    setBiologicalSex(sex);

    router.push('/(onboarding)/experience');
  };

  const counterLabel = useMemo(
    () => `${name.length}/${MAX_NAME_LENGTH}`,
    [name.length],
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header — no back chevron on screen 1. Progress claims this slot. */}
        <OnboardingProgress step={1} total={5} />

        {/* Content */}
        <View className="flex-1">
          <Text
            className="mt-8 px-6 text-display-lg text-content"
            accessibilityRole="header"
          >
            {t('onboarding.identityTitle')}
          </Text>

          <Text className="mt-2 px-6 text-body font-inter text-content-secondary">
            {t('onboarding.identitySubtitle')}
          </Text>

          {/* Field 1 — NAME */}
          <View className="mt-10">
            <Text className="mb-2 px-6 text-small-caps uppercase text-content-secondary">
              {t('onboarding.nameLabel')}
            </Text>
            <View className="px-6">
              <TextInput
                ref={nameInputRef}
                className={`h-14 rounded-input border bg-surface px-4 text-body font-inter-semibold text-content ${
                  blocklistError
                    ? 'border-danger'
                    : focused
                      ? 'border-primary'
                      : 'border-surface-elevated'
                }`}
                value={name}
                onChangeText={handleNameChange}
                onFocus={() => setFocused(true)}
                onBlur={handleNameBlur}
                placeholder={t('onboarding.namePlaceholder')}
                placeholderTextColor={COLOR_CONTENT_MUTED}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name-given"
                textContentType="givenName"
                maxLength={MAX_NAME_LENGTH}
                returnKeyType="next"
                accessibilityLabel={t('onboarding.nameLabel')}
                accessibilityHint={t('onboarding.nameHint', {
                  max: MAX_NAME_LENGTH,
                  defaultValue: `Max ${MAX_NAME_LENGTH} tekens`,
                })}
              />
              {/* Counter — visible only at 30+ chars or on blocklist error. */}
              <Animated.Text
                style={counterAnimatedStyle}
                className={`mt-1 self-end text-small-caps ${
                  blocklistError ? 'text-danger' : 'text-content-muted'
                }`}
                accessibilityLiveRegion={blocklistError ? 'polite' : 'none'}
              >
                {counterLabel}
              </Animated.Text>
            </View>
          </View>

          {/* Field 2 — BIOLOGICAL SEX */}
          <View className="mt-8">
            <Text className="mb-2 px-6 text-small-caps uppercase text-content-secondary">
              {t('onboarding.sexLabel')}
            </Text>
            <View className="flex-row gap-3 px-6">
              <SexPill
                value="male"
                label={t('onboarding.sexMale')}
                selected={sex === 'male'}
                onSelect={handleSelectSex}
              />
              <SexPill
                value="female"
                label={t('onboarding.sexFemale')}
                selected={sex === 'female'}
                onSelect={handleSelectSex}
              />
            </View>

            {/* Privacy helper — persistent, inline, small-caps-helper casing
                (no uppercase). See docs/design-system.md §Typography casing. */}
            <View className="mt-2 px-6">
              <Text
                className="text-small-caps text-content-muted"
                style={{ textTransform: 'none', lineHeight: 16 }}
              >
                {t('onboarding.sexPrivacyLine1')}
              </Text>
              <Text
                className="text-small-caps text-content-muted"
                style={{ textTransform: 'none', lineHeight: 16 }}
              >
                {t('onboarding.sexPrivacyLine2')}
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom CTA — thumb zone */}
        <View className="px-6 pb-4">
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

type SexPillProps = {
  value: Exclude<BiologicalSex, null>;
  label: string;
  selected: boolean;
  onSelect: (value: Exclude<BiologicalSex, null>) => void;
};

function SexPill({ value, label, selected, onSelect }: SexPillProps) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      className={`h-14 flex-1 items-center justify-center rounded-input bg-surface ${
        selected ? 'border-2 border-primary' : 'border border-surface-elevated'
      }`}
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
