/**
 * components/challenge/ActiveChallengeRow.tsx
 *
 * Single row in the "Active challenges" section of the Challenge tab (T-117).
 *
 * Behaviour
 * ---------
 * - Full-width pressable, 64pt tall (exceeds the 44pt gym-friendly
 *   minimum; inset matches the stacked-row rhythm on experience.tsx).
 * - Row-tap opens a quick-peek modal (wired in a later task — T-117
 *   scaffold just logs the intent via onPress).
 * - Status label uses small-caps-label (level 3). Opponent name uses
 *   body-semibold.
 * - Chevron sits right for affordance.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

export type ChallengeStatus =
  | 'waitingForOpponent'
  | 'waitingForReveal'
  | 'yourTurn';

type ActiveChallengeRowProps = {
  opponentName: string;
  statusLabel: string;
  /** When true, the status dot goes lime (awaits YOU action). */
  actionable: boolean;
  onPress: () => void;
  /** First row in a stack = no top divider; used by the parent. */
  first?: boolean;
};

export default function ActiveChallengeRow({
  opponentName,
  statusLabel,
  actionable,
  onPress,
  first,
}: ActiveChallengeRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${opponentName}. ${statusLabel}`}
      className={`flex-row items-center justify-between py-4 active:opacity-70 ${
        first ? '' : 'border-t border-surface-elevated'
      }`}
    >
      <View className="flex-row items-center flex-1 pr-3">
        {/* Status dot — lime when actionable, muted otherwise. */}
        <View
          className={`h-2 w-2 rounded-pill mr-3 ${
            actionable ? 'bg-primary' : 'bg-content-muted'
          }`}
        />
        <View className="flex-1">
          <Text
            className="text-body font-inter-semibold text-content"
            numberOfLines={1}
          >
            {opponentName}
          </Text>
          <Text className="mt-0.5 text-small-caps uppercase text-content-secondary">
            {statusLabel}
          </Text>
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.content.muted}
      />
    </Pressable>
  );
}
