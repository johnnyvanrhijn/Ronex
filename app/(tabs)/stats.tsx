/**
 * app/(tabs)/stats.tsx
 *
 * Stub — Stats tab content arrives in a later phase. Dry placeholder
 * so the tab switch has something legible to show.
 */

import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@/lib/theme';

export default function StatsScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View className="flex-1 items-center justify-center px-6">
        <Ionicons name="stats-chart-outline" size={32} color={colors.content.muted} />
        <Text className="text-display-lg text-content mt-4">
          {t('tabs.stats')}
        </Text>
        <Text className="font-inter text-body text-content-secondary mt-2">
          {t('challenge.comingSoon')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
