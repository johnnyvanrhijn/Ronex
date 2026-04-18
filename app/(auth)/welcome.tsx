import React, { useEffect } from 'react';
import { View, Text, Pressable, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const FADE_DURATION = 150;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  // Fade-in orchestration — staggered opacity per element.
  const glowOpacity = useSharedValue(0);
  const wordmarkOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  useEffect(() => {
    const timing = { duration: FADE_DURATION, easing: Easing.out(Easing.quad) };
    glowOpacity.value = withTiming(1, timing);
    wordmarkOpacity.value = withDelay(150, withTiming(1, timing));
    taglineOpacity.value = withDelay(300, withTiming(1, timing));
    buttonsOpacity.value = withDelay(450, withTiming(1, timing));
  }, [glowOpacity, wordmarkOpacity, taglineOpacity, buttonsOpacity]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));
  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  const handlePrimary = () => {
    Haptics.selectionAsync();
    router.push('/(auth)/login');
  };

  const handleSecondary = () => {
    Haptics.selectionAsync();
    router.push('/(auth)/enter-code');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />

      {/* Top spacer — pushes content to visual center */}
      <View className="flex-1" />

      {/* Logo + tagline block */}
      <View className="items-center px-6">
        {/* Lime glow — decorative, sits behind the wordmark */}
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            {
              position: 'absolute',
              width: 280,
              height: 280,
              top: -114, // vertically centers the glow behind the 52px wordmark
              alignSelf: 'center',
              borderRadius: 140,
              overflow: 'hidden',
            },
            glowStyle,
          ]}
        >
          {/* Primary-tinted disc provides the color; BlurView layered on top
              softens the edge so it reads as a glow rather than a solid blob. */}
          <View className="absolute inset-0 rounded-full bg-primary/20" />
          <BlurView
            intensity={80}
            tint="dark"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        </Animated.View>

        <Animated.View style={wordmarkStyle}>
          {/* Documented typography exception — see docs/design-system.md */}
          <Text
            className="font-inter-extrabold text-content tracking-tight"
            style={{ fontSize: 52, lineHeight: 56 }}
            accessibilityRole="header"
          >
            {t('onboarding.welcomeTitle')}
          </Text>
        </Animated.View>

        {/* Two-line value prop — tightly stacked, line 2 is the dry punch */}
        <Animated.View style={[{ marginTop: 16, alignItems: 'center' }, taglineStyle]}>
          <Text className="text-body font-inter text-content text-center">
            {t('onboarding.welcomeHookLine1')}
          </Text>
          <Text
            className="text-body font-inter text-content-secondary text-center"
            style={{ marginTop: 2 }}
          >
            {t('onboarding.welcomeHookLine2')}
          </Text>
        </Animated.View>
      </View>

      {/* Bottom spacer — twice as large as top for optical balance */}
      <View className="flex-[2]" />

      {/* Action buttons — thumb zone (bottom third) */}
      <Animated.View style={buttonsStyle} className="px-6 pb-4">
        <Pressable
          className="h-14 items-center justify-center rounded-button bg-primary active:bg-primary-dark"
          onPress={handlePrimary}
          accessibilityLabel={t('onboarding.ctaStart')}
          accessibilityRole="button"
        >
          <Text className="text-body font-inter-semibold text-background">
            {t('onboarding.ctaStart')}
          </Text>
        </Pressable>

        {/* Ghost CTA — borderless, demoted, the "side door" */}
        <Pressable
          className="mt-3 h-12 items-center justify-center active:opacity-70"
          onPress={handleSecondary}
          accessibilityLabel={t('onboarding.ctaChallenged')}
          accessibilityRole="button"
        >
          <Text className="text-small-caps uppercase text-content-secondary">
            {t('onboarding.ctaChallenged')}
          </Text>
        </Pressable>

        {/* Version label — build metadata, not brand copy */}
        <Text
          className="mt-4 text-small-caps uppercase text-content-secondary text-center"
          style={{ opacity: 0.4 }}
          accessibilityLabel="version 0.1.0 beta"
        >
          v0.1.0 · beta
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}
