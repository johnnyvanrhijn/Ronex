/**
 * components/workout/KeyboardAccessory.tsx
 *
 * Sticky bar that sits above the numpad while the user is typing a set's
 * weight or reps. Carries the "last time" hint + Next/Done action keys.
 *
 * Why this lives on the JS tree (not iOS inputAccessoryView)
 * -----------------------------------------------------------
 * RN's `inputAccessoryViewID` is iOS-only and a bit fiddly with numeric
 * keyboards. The active-workout screen is already iOS-first, but mounting
 * the accessory as a regular View at the bottom of the screen (above the
 * software keyboard via `KeyboardAvoidingView`) gives us full styling
 * control, consistent behaviour between dev/web/native, and zero
 * interaction with iOS's autofill bar.
 *
 * Props
 * -----
 *   visible            — show / hide. Typically bound to TextInput focus.
 *   lastTime           — historical data for the current (exerciseId, set_order)
 *                        pair. `null` = no history (placeholder em-dash).
 *                        T-210 fills this; T-204 ships `null` everywhere.
 *   trend              — 'up' | 'same' | 'down' | null. Paints the arrow.
 *   actionLabel        — 'next' | 'done'. Labels the big right-hand button.
 *   onAction           — pressed when user taps the right-hand button.
 *                        Next = move to reps input. Done = auto-log + close
 *                        keyboard (the WeightRepsRow handles which).
 *
 * Trend indicator rationale
 * -------------------------
 *   up   = lime   (current attempt > last)  → "push for more"
 *   same = muted  (current attempt = last)  → neutral
 *   down = red-dim (current attempt < last)  → honest, not judgemental
 *
 * Color coding is ADDITIVE to the arrow glyph (not color-alone) per
 * accessibility guideline.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@/lib/theme';

export type LastTimeData = {
  weight: number | null; // null when exercise has no historic weight
  reps: number | null;
} | null;

export type TrendDirection = 'up' | 'same' | 'down' | null;

type KeyboardAccessoryProps = {
  visible: boolean;
  lastTime: LastTimeData;
  trend: TrendDirection;
  actionLabel: 'next' | 'done';
  onAction: () => void;
};

function trendIconName(trend: TrendDirection): keyof typeof Ionicons.glyphMap | null {
  switch (trend) {
    case 'up':
      return 'arrow-up';
    case 'down':
      return 'arrow-down';
    case 'same':
      return 'remove';
    default:
      return null;
  }
}

function trendColor(trend: TrendDirection): string {
  switch (trend) {
    case 'up':
      return colors.primary.DEFAULT;
    case 'down':
      return colors.danger;
    case 'same':
      return colors.content.muted;
    default:
      return colors.content.muted;
  }
}

export default function KeyboardAccessory({
  visible,
  lastTime,
  trend,
  actionLabel,
  onAction,
}: KeyboardAccessoryProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  // Build the "last" hint string. If there's no data yet (T-210 hasn't
  // landed), show the placeholder em-dash so the slot is still visible
  // and the real wiring is a drop-in later.
  const hasLastTime =
    lastTime !== null && lastTime.weight !== null && lastTime.reps !== null;

  const lastText = hasLastTime
    ? t('workout.lastTimeFormatted', {
        weight: lastTime!.weight,
        reps: lastTime!.reps,
      })
    : t('workout.lastTimePlaceholder');

  const trendIcon = trendIconName(trend);

  const actionText =
    actionLabel === 'next' ? t('common.continue') : t('common.done');

  return (
    <View className="h-12 flex-row items-center justify-between border-t border-surface-elevated bg-surface px-4">
      <View className="flex-1 flex-row items-center">
        <Text
          className="text-small-caps uppercase text-content-muted"
          numberOfLines={1}
        >
          {lastText}
        </Text>
        {trendIcon && (
          <Ionicons
            name={trendIcon}
            size={14}
            color={trendColor(trend)}
            style={{ marginLeft: 6 }}
          />
        )}
      </View>

      <Pressable
        onPress={onAction}
        className="h-9 items-center justify-center rounded-button bg-primary px-4 active:opacity-90"
        accessibilityRole="button"
        accessibilityLabel={actionText}
      >
        <Text className="text-small-caps uppercase text-background">
          {actionText}
        </Text>
      </Pressable>
    </View>
  );
}
