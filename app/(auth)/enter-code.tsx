import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import Toast from '@/components/Toast';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Accepts 6-8 char alphanumeric codes, optionally hyphenated (e.g. ABC-123 or ABC-1234).
const CODE_REGEX = /^[A-Z0-9]{3}-?[A-Z0-9]{3,4}$/i;
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 8;

// Palette values — kept in sync with tailwind.config.js / lib/theme.ts
const COLOR_SURFACE_ELEVATED = '#262626';
const COLOR_PRIMARY = '#22C55E';
const COLOR_BACKGROUND = '#0A0A0A';
const COLOR_CONTENT_MUTED = '#525252';

export default function EnterCodeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [clipboardCode, setClipboardCode] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [focused, setFocused] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isValid = code.trim().length >= MIN_CODE_LENGTH;

  // Smooth button enabled-state transition — 200ms ease-out on a 0→1 shared value.
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

  // Auto-focus input after transition settles.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Clipboard auto-detect — single read on mount (iOS 14+ shows its own permission toast).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const text = await Clipboard.getStringAsync();
        if (cancelled) return;
        const trimmed = text.trim();
        if (trimmed && CODE_REGEX.test(trimmed)) {
          setClipboardCode(trimmed.toUpperCase());
          // Auto-dismiss banner after 10s
          bannerTimerRef.current = setTimeout(() => {
            setClipboardCode(null);
          }, 10000);
        }
      } catch {
        // Clipboard access failed — silently skip, the user can type manually.
      }
    })();
    return () => {
      cancelled = true;
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const dismissBanner = () => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setClipboardCode(null);
  };

  const handlePasteFromBanner = () => {
    if (!clipboardCode) return;
    Haptics.selectionAsync();
    setCode(clipboardCode);
    dismissBanner();
  };

  const handleChangeText = (text: string) => {
    // Dismiss the banner on any input interaction.
    if (clipboardCode) dismissBanner();
    setCode(text.toUpperCase());
  };

  const handleFocus = () => {
    setFocused(true);
    if (clipboardCode) dismissBanner();
  };

  const handleSubmit = () => {
    if (!isValid) return;
    Haptics.selectionAsync();
    // TODO(T-115): replace with real code validation + minimal-onboarding routing.
    Alert.alert('Code validation komt in T-115', `Code: ${code}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header — back chevron */}
        <View className="px-4 pt-2">
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-full active:bg-surface"
            onPress={() => router.back()}
            accessibilityLabel={t('common.back')}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color="#FAFAFA" />
          </Pressable>
        </View>

        {/* Clipboard banner */}
        {clipboardCode && (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mx-6 mt-2 flex-row items-center justify-between rounded-card bg-surface-elevated px-4 py-3"
          >
            <Text
              className="flex-1 text-body font-inter text-content"
              numberOfLines={1}
            >
              {t('onboarding.clipboardBanner', { code: clipboardCode })}
            </Text>
            <Pressable
              onPress={handlePasteFromBanner}
              accessibilityLabel={t('common.paste')}
              accessibilityRole="button"
              className="ml-3 h-11 items-center justify-center px-2 active:opacity-70"
            >
              <Text className="text-small-caps uppercase text-primary">
                {t('common.paste')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Content */}
        <View className="flex-1 px-6 pt-8">
          <Text
            className="text-display-lg text-content"
            accessibilityRole="header"
          >
            {t('onboarding.enterCode')}
          </Text>

          <Text className="mt-2 text-body font-inter text-content-secondary">
            {t('onboarding.enterCodeSubtitle')}
          </Text>

          {/* Code input block */}
          <View className="mt-10">
            {/* TODO(Copy, T-114): no i18n key for the literal field label "CODE".
                Same word in NL and EN, so a hardcoded literal is safe for now. */}
            <Text className="mb-1 text-small-caps uppercase text-content-secondary">
              CODE
            </Text>
            <Text
              className="mb-2 text-small-caps text-content-secondary"
              style={{ opacity: 0.6 }}
            >
              {t('onboarding.enterCodeHint')}
            </Text>
            <TextInput
              ref={inputRef}
              className={`h-14 rounded-input border bg-surface px-4 text-body font-inter-semibold text-content ${
                focused ? 'border-primary' : 'border-surface-elevated'
              }`}
              style={{ letterSpacing: 1.5 }}
              value={code}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={() => setFocused(false)}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              maxLength={MAX_CODE_LENGTH}
              accessibilityLabel={t('onboarding.enterCode')}
            />
          </View>
        </View>

        {/* Bottom button — thumb zone */}
        <View className="px-6 pb-4">
          <AnimatedPressable
            style={buttonAnimatedStyle}
            className="h-14 items-center justify-center rounded-button"
            onPress={handleSubmit}
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
