import React from 'react';
import { View, Text, Pressable, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />

      {/* Top spacer — pushes content to visual center */}
      <View className="flex-1" />

      {/* Logo + tagline block */}
      <View className="items-center px-6">
        <Text
          className="font-inter-extrabold text-content tracking-tight"
          style={{ fontSize: 52, lineHeight: 56 }}
          accessibilityRole="header"
        >
          {t('onboarding.welcomeTitle')}
        </Text>

        <Text className="mt-3 text-body font-inter text-content-secondary text-center">
          {t('onboarding.welcomeSubtitle')}
        </Text>
      </View>

      {/* Bottom spacer — twice as large as top for optical balance */}
      <View className="flex-[2]" />

      {/* Action buttons — thumb zone (bottom third) */}
      <View className="px-6 pb-4">
        <Pressable
          className="h-14 items-center justify-center rounded-button bg-primary active:bg-primary-dark"
          onPress={() => router.push('/(auth)/login')}
          accessibilityLabel={t('onboarding.wantToTrain')}
          accessibilityRole="button"
        >
          <Text className="text-subheading font-inter-semibold text-background">
            {t('onboarding.wantToTrain')}
          </Text>
        </Pressable>

        <Pressable
          className="mt-3 h-14 items-center justify-center rounded-button border border-surface-elevated active:bg-surface"
          onPress={() => router.push('/(auth)/login')}
          accessibilityLabel={t('onboarding.hasCode')}
          accessibilityRole="button"
        >
          <Text className="text-subheading font-inter-semibold text-content-secondary">
            {t('onboarding.hasCode')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
