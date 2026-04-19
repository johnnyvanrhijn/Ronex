/**
 * components/workout/DeleteExerciseModal.tsx
 *
 * Confirmation modal shown when the user taps the × on an exercise-group
 * header on the active-workout screen (B-029). Deleting an entire exercise
 * bucket can wipe multiple logged sets at once — bigger destructive action
 * than single-set delete, so a modal is warranted.
 *
 * Structural clone of `DiscardModal.tsx`: bottom-sheet scrim, stacked title
 * + (optional) body, two buttons side-by-side. Kept as a separate component
 * rather than bending DiscardModal because:
 *   - title is interpolated with the exercise name (DiscardModal has a
 *     literal title)
 *   - body has a `{count}` plural branch (DiscardModal's body is static)
 *   - body is omitted entirely when `setCount === 0` (the 0-set case — no
 *     lost work to warn about; the title alone is enough commitment copy)
 *
 * Haptic on confirm mirrors DiscardModal's pattern:
 * `Haptics.notificationAsync(Warning)`.
 */

import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

type DeleteExerciseModalProps = {
  visible: boolean;
  exerciseName: string;
  setCount: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteExerciseModal({
  visible,
  exerciseName,
  setCount,
  onCancel,
  onConfirm,
}: DeleteExerciseModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onConfirm();
  };

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
              {t('workout.deleteExerciseTitle', { name: exerciseName })}
            </Text>

            {/* Body — suppressed when there's nothing to lose. */}
            {setCount > 0 && (
              <Text className="mt-2 font-inter text-body text-content-secondary">
                {t('workout.deleteExerciseBody', { count: setCount })}
              </Text>
            )}

            <View className="mt-6 flex-row gap-3">
              <Pressable
                onPress={onCancel}
                className="h-14 flex-1 items-center justify-center rounded-button border border-surface-elevated bg-transparent active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel={t('workout.deleteExerciseCancel')}
              >
                <Text className="text-body font-inter-semibold text-content">
                  {t('workout.deleteExerciseCancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                className="h-14 flex-1 items-center justify-center rounded-button bg-danger active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel={t('workout.deleteExerciseConfirm')}
              >
                <Text className="text-body font-inter-semibold text-content">
                  {t('workout.deleteExerciseConfirm')}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
