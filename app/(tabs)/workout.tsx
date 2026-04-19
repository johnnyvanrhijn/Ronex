/**
 * app/(tabs)/workout.tsx
 *
 * Stub — the Workout tab ships real content in a later phase. For T-016
 * we just present a dry "Komt nog" placeholder so the tab-bar switch
 * resolves to a readable screen.
 */

import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@/lib/theme';

export default function WorkoutScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View className="flex-1 items-center justify-center px-6">
        <Ionicons name="barbell-outline" size={32} color={colors.content.muted} />
        <Text className="text-display-lg text-content mt-4">
          {t('tabs.workout')}
        </Text>
        <Text className="font-inter text-body text-content-secondary mt-2">
          {t('challenge.comingSoon')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
