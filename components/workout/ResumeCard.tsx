/**
 * components/workout/ResumeCard.tsx
 *
 * Compact card rendered on the Challenge-tab when an active-workout
 * session is detected in the zustand store (T-203 state:
 * `startedAt !== null && completedAt === null`).
 *
 * Rationale (from T-204 brief)
 * ----------------------------
 * Do NOT auto-redirect the user when they re-enter the app mid-workout.
 * Instead, show a prominent "resume" surface at the top of the Challenge
 * tab with two explicit actions: Verder (continue) and Verwerp (discard).
 *
 * Visual weight
 * -------------
 *   - Lime-bordered card, bg-surface, generous padding.
 *   - Title (body-semibold) + small-caps elapsed-time reading.
 *   - Two horizontal buttons: lime primary "Verder", ghost "Verwerp".
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

type ResumeCardProps = {
  elapsed: string;
  onContinue: () => void;
  onDiscard: () => void;
};

export default function ResumeCard({
  elapsed,
  onContinue,
  onDiscard,
}: ResumeCardProps) {
  const { t } = useTranslation();

  return (
    <View className="mb-8 rounded-card border border-primary bg-surface p-5">
      <View className="flex-row items-center">
        <View className="h-2 w-2 rounded-pill bg-primary" />
        <Text className="ml-2 text-small-caps uppercase text-primary">
          {t('workout.resumeCardTitle')}
        </Text>
      </View>

      <Text className="mt-2 text-body font-inter-semibold text-content">
        {t('workout.resumeCardBody', { elapsed })}
      </Text>

      <View className="mt-4 flex-row gap-3">
        <Pressable
          onPress={onContinue}
          className="h-14 flex-[2] flex-row items-center justify-center rounded-button bg-primary active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel={t('workout.resumeCardContinue')}
        >
          <Ionicons name="play" size={18} color={colors.background} />
          <Text className="ml-2 text-body font-inter-semibold text-background">
            {t('workout.resumeCardContinue')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDiscard}
          className="h-14 flex-1 items-center justify-center rounded-button border border-surface-elevated bg-transparent active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={t('workout.resumeCardDiscard')}
        >
          <Text className="text-body font-inter-semibold text-content-secondary">
            {t('workout.resumeCardDiscard')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
