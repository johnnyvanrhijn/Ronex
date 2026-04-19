/**
 * components/challenge/LogPreviewRow.tsx
 *
 * Single stacked row in the "Recent training" section of the Challenge
 * tab (T-117). Tap opens read-only workout detail at /workout/[id]
 * (route lands in a later task).
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';

type LogPreviewRowProps = {
  dateLabel: string;
  /** e.g. "Push A", "Loose" — the workout name or kind. */
  title: string;
  summary: string;
  onPress: () => void;
  first?: boolean;
};

export default function LogPreviewRow({
  dateLabel,
  title,
  summary,
  onPress,
  first,
}: LogPreviewRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${summary}. ${dateLabel}`}
      className={`flex-row items-center justify-between py-4 active:opacity-70 ${
        first ? '' : 'border-t border-surface-elevated'
      }`}
    >
      <View className="flex-1 pr-3">
        <Text className="text-small-caps uppercase text-content-secondary">
          {dateLabel}
        </Text>
        <Text
          className="mt-1 text-body font-inter-semibold text-content"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className="mt-0.5 font-inter text-body text-content-secondary"
          numberOfLines={1}
        >
          {summary}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.content.muted}
      />
    </Pressable>
  );
}
