import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

type GreetingKey = 'home.greetingMorning' | 'home.greetingAfternoon' | 'home.greetingEvening';

function getGreetingKey(): GreetingKey {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 18) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

function getUserDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string } | null): string {
  if (!user) return '';
  const meta = user.user_metadata;
  if (meta && typeof meta.name === 'string' && meta.name.length > 0) {
    return meta.name;
  }
  if (meta && typeof meta.full_name === 'string' && meta.full_name.length > 0) {
    return meta.full_name;
  }
  return user.email ?? '';
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const greetingKey = useMemo(() => getGreetingKey(), []);
  const displayName = useMemo(() => getUserDisplayName(user), [user]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting section */}
        <View className="mb-6">
          <Text
            className="font-inter text-body text-content-secondary"
            accessibilityLabel={t(greetingKey)}
          >
            {t(greetingKey)}
          </Text>
          <Text
            className="text-display-lg text-content mt-0.5"
            numberOfLines={1}
            accessibilityLabel={displayName}
          >
            {displayName}
          </Text>
        </View>

        {/* Start Workout CTA */}
        <Pressable
          className="mb-6 overflow-hidden rounded-card active:opacity-90"
          accessibilityLabel={t('home.startWorkoutTitle')}
          accessibilityRole="button"
          onPress={() => {
            // Placeholder — will navigate to workout flow
          }}
        >
          <LinearGradient
            colors={[colors.primary.DEFAULT, colors.primary.dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="p-6 min-h-[120px] flex-row items-center justify-between"
          >
            {/* Decorative circle */}
            <View
              className="absolute -top-6 -right-6 w-24 h-24 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            />
            <View
              className="absolute -top-2 -right-2 w-16 h-16 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
            />

            <View className="flex-1 mr-4">
              <Text className="text-display-lg text-background">
                {t('home.startWorkoutTitle')}
              </Text>
              <Text className="font-inter text-body text-background mt-1 opacity-80">
                {t('home.startWorkoutSubtitle')}
              </Text>
            </View>

            <View className="w-11 h-11 rounded-full bg-background/20 items-center justify-center">
              <Ionicons
                name="chevron-forward"
                size={22}
                color={colors.background}
              />
            </View>
          </LinearGradient>
        </Pressable>

        {/* Stats row */}
        <View className="flex-row mb-6 gap-3">
          <View
            className="flex-1 bg-surface rounded-card p-4 border border-surface-elevated"
            accessibilityLabel={`0 ${t('home.statsWorkouts')}`}
          >
            <Text className="text-display-lg text-content">
              0
            </Text>
            <Text className="text-small-caps uppercase text-content-secondary mt-1">
              {t('home.statsWorkouts')}
            </Text>
          </View>

          <View
            className="flex-1 bg-surface rounded-card p-4 border border-surface-elevated"
            accessibilityLabel={`${t('home.statsNoPr')} ${t('home.statsBestPr')}`}
          >
            <Text className="text-display-lg text-primary">
              {t('home.statsNoPr')}
            </Text>
            <Text className="text-small-caps uppercase text-content-secondary mt-1">
              {t('home.statsBestPr')}
            </Text>
          </View>

          <View
            className="flex-1 bg-surface rounded-card p-4 border border-surface-elevated"
            accessibilityLabel={`0 kg ${t('home.statsVolume')}`}
          >
            <Text className="text-display-lg text-content">
              0 kg
            </Text>
            <Text className="text-small-caps uppercase text-content-secondary mt-1">
              {t('home.statsVolume')}
            </Text>
          </View>
        </View>

        {/* Recent workouts section */}
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-body font-inter-semibold text-content">
            {t('home.recentWorkoutsTitle')}
          </Text>
          <Pressable
            accessibilityLabel={t('home.recentWorkoutsAll')}
            accessibilityRole="button"
            className="py-1 px-2"
          >
            <Text className="text-small-caps uppercase text-primary">
              {t('home.recentWorkoutsAll')}
            </Text>
          </Pressable>
        </View>

        {/* Empty state */}
        <View className="rounded-card border border-dashed border-surface-elevated p-6 items-center">
          <Ionicons
            name="barbell-outline"
            size={32}
            color={colors.content.muted}
          />
          <Text className="text-body font-inter-semibold text-content mt-4">
            {t('home.recentEmptyTitle')}
          </Text>
          <Text className="text-small-caps uppercase text-content-secondary mt-1 text-center">
            {t('home.recentEmptySubtitle')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
