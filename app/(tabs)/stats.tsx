import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function StatsScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-inter-bold text-heading text-content">
          {t('navigation.stats')}
        </Text>
        <Text className="font-inter text-body text-content-secondary mt-2">
          {t('home.comingSoon')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
