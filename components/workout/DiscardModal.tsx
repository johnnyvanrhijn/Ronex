/**
 * components/workout/DiscardModal.tsx
 *
 * Confirmation modal shown when the user taps the back-chevron on the
 * active-workout screen AND at least one completed set exists.
 *
 * Design choices
 * --------------
 *   - Full-width sheet pinned to the bottom half of the screen (not a
 *     centered dialog). Fits the thumb-zone rule and matches iOS Native
 *     action-sheet metaphors — even though we roll our own rather than
 *     using `Alert.alert` (for copy-tone control).
 *   - Two buttons, stacked on narrow widths, side-by-side otherwise.
 *     "Annuleer" = ghost, "Verwerp" = danger-tinted.
 */

import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type DiscardModalProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DiscardModal({
  visible,
  onCancel,
  onConfirm,
}: DiscardModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      {/* Scrim */}
      <Pressable
        className="flex-1 justify-end bg-black/60"
        onPress={onCancel}
      >
        {/* Sheet — stopPropagation by not forwarding onPress on inner View. */}
        <Pressable onPress={() => {}}>
          <View
            className="rounded-t-card bg-surface px-6 pt-6"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
          >
            <View className="h-1 w-10 self-center rounded-pill bg-surface-elevated" />
            <Text
              className="mt-5 text-display-lg text-content"
              accessibilityRole="header"
            >
              {t('workout.discardConfirmTitle')}
            </Text>
            <Text className="mt-2 font-inter text-body text-content-secondary">
              {t('workout.discardConfirmBody')}
            </Text>

            <View className="mt-6 flex-row gap-3">
              <Pressable
                onPress={onCancel}
                className="h-14 flex-1 items-center justify-center rounded-button border border-surface-elevated bg-transparent active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel={t('workout.discardConfirmCancel')}
              >
                <Text className="text-body font-inter-semibold text-content">
                  {t('workout.discardConfirmCancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                className="h-14 flex-1 items-center justify-center rounded-button bg-danger active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel={t('workout.discardConfirmDiscard')}
              >
                <Text className="text-body font-inter-semibold text-content">
                  {t('workout.discardConfirmDiscard')}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
