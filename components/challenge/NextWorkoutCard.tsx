/**
 * components/challenge/NextWorkoutCard.tsx
 *
 * The "logging dominance via content" card for the Challenge tab (T-117).
 *
 * Why this card is prominent
 * --------------------------
 * Decision 2026-04-19 (Johnny): tab-bar is uniform (all 4 icons 24pt, no
 * size or tint dominance). Logging-importance is instead communicated
 * via CONTENT on the Challenge tab. This card is the anchor of that
 * intent: full-width, lime CTA, surfaces in the top-third of the screen
 * BEFORE the social sections.
 *
 * Variants
 * --------
 * - `plan`    — user has a plan. Show day title + exercise count
 *               preview (e.g. "Push A · 5 exercises"), lime Start.
 * - `loose`   — user trains loose (no plan). Single prompt line +
 *               lime Start. No fake suggestion.
 * - `empty`   — no plan and no previous workout yet. Dashed border,
 *               ghost-styled Start. Same tap-target, lighter visual
 *               weight so the user's eye still tries the primary
 *               challenge CTA below.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

export type NextWorkoutVariant =
  | { kind: 'plan'; title: string; summary: string }
  | { kind: 'loose' }
  | { kind: 'empty' };

type NextWorkoutCardProps = {
  variant: NextWorkoutVariant;
  onStart: () => void;
};

export default function NextWorkoutCard({
  variant,
  onStart,
}: NextWorkoutCardProps) {
  const { t } = useTranslation();

  // Empty state: dashed border, helper text above button, ghost button.
  // Still single tap to start — we don't want "no plan" to mean "no
  // workout". Johnny's loose-users decision: show the button, softer
  // visual weight, no fake suggestion.
  if (variant.kind === 'empty') {
    return (
      <View className="rounded-card border border-dashed border-surface-elevated bg-surface p-5">
        <Text className="text-small-caps uppercase text-content-secondary mb-2">
          {t('challenge.nextWorkoutLabel')}
        </Text>
        <Text className="text-body font-inter-semibold text-content">
          {t('challenge.nextWorkoutEmptyTitle')}
        </Text>
        <Text className="mt-1 font-inter text-body text-content-secondary">
          {t('challenge.nextWorkoutEmptyHelper')}
        </Text>

        <Pressable
          onPress={onStart}
          className="mt-4 h-14 items-center justify-center rounded-button border border-primary bg-transparent active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={t('challenge.nextWorkoutStartCta')}
        >
          <Text className="text-body font-inter-semibold text-primary">
            {t('challenge.nextWorkoutStartCta')}
          </Text>
        </Pressable>
      </View>
    );
  }

  // Populated: surface card, lime solid Start (this IS the "logging
  // dominance via content" moment).
  return (
    <View className="rounded-card bg-surface p-5">
      <Text className="text-small-caps uppercase text-content-secondary mb-2">
        {t('challenge.nextWorkoutLabel')}
      </Text>

      {variant.kind === 'plan' ? (
        <>
          <Text className="text-body font-inter-semibold text-content">
            {variant.title}
          </Text>
          <Text className="mt-1 font-inter text-body text-content-secondary">
            {variant.summary}
          </Text>
        </>
      ) : (
        <Text className="text-body font-inter-semibold text-content">
          {t('challenge.nextWorkoutLoosePrompt')}
        </Text>
      )}

      <Pressable
        onPress={onStart}
        className="mt-4 h-14 flex-row items-center justify-center rounded-button bg-primary active:opacity-90"
        accessibilityRole="button"
        accessibilityLabel={t('challenge.nextWorkoutStartCta')}
      >
        <Ionicons name="play" size={18} color={colors.background} />
        <Text className="ml-2 text-body font-inter-semibold text-background">
          {t('challenge.nextWorkoutStartCta')}
        </Text>
      </Pressable>
    </View>
  );
}
