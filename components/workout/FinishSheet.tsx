/**
 * components/workout/FinishSheet.tsx
 *
 * Bottom-sheet shown when the user taps the big floating "Klaar · X kg"
 * CTA on the active-workout screen. Presents a summary + confirms.
 *
 * Layout
 * ------
 *   [grabber]
 *   TITLE   Training afronden?
 *   SMALLCAPS  {elapsed} · N oefeningen · X sets
 *
 *   [TOTAAL label]
 *   [huge lime number]    1.840 kg
 *
 *   [PR section — placeholder copy until T-214]
 *
 *   [Terug]  [Voltooien]
 *
 * Behaviour
 * ---------
 *   - `visible` drives the Modal.
 *   - "Terug" calls onCancel (close sheet, stay on screen).
 *   - "Voltooien" calls onConfirm — parent kicks off completeWorkout
 *     + sync-helper invocation + navigate-away.
 */

import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FinishSheetProps = {
  visible: boolean;
  elapsed: string;
  exerciseCount: number;
  setCount: number;
  volumeKg: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function FinishSheet({
  visible,
  elapsed,
  exerciseCount,
  setCount,
  volumeKg,
  onCancel,
  onConfirm,
}: FinishSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const formattedVolume = Math.round(volumeKg).toLocaleString('nl-NL');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable
        className="flex-1 justify-end bg-black/70"
        onPress={onCancel}
      >
        <Pressable onPress={() => {}}>
          <View
            className="rounded-t-card bg-surface px-6 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
          >
            {/* Handle-bar */}
            <View className="h-1 w-10 self-center rounded-pill bg-surface-elevated" />

            {/* Title */}
            <Text
              className="mt-5 text-display-lg text-content"
              accessibilityRole="header"
            >
              {t('workout.finishSheetTitle')}
            </Text>

            {/* Subtitle small-caps */}
            <Text className="mt-2 text-small-caps uppercase text-content-secondary">
              {t('workout.finishSheetSubtitle', {
                elapsed,
                exercises: exerciseCount,
                sets: setCount,
              })}
            </Text>

            {/* Total block */}
            <View className="mt-6">
              <Text className="text-small-caps uppercase text-content-muted">
                {t('workout.finishSheetTotal')}
              </Text>
              <Text className="mt-2 text-display-lg text-primary">
                {formattedVolume}
                <Text className="text-body font-inter-semibold text-primary">
                  {' '}
                  kg
                </Text>
              </Text>
            </View>

            {/*
              PR section placeholder — T-214 fills with real detection.
              For now we surface a tiny neutral line so the space is
              visibly reserved in the layout.
            */}
            <Text className="mt-4 text-small-caps text-content-muted">
              {t('workout.finishSheetPrsNone')}
            </Text>

            {/* Actions */}
            <View className="mt-8 flex-row gap-3">
              <Pressable
                onPress={onCancel}
                className="h-14 flex-1 items-center justify-center rounded-button border border-surface-elevated bg-transparent active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel={t('workout.finishSheetCancel')}
              >
                <Text className="text-body font-inter-semibold text-content">
                  {t('workout.finishSheetCancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                className="h-14 flex-1 items-center justify-center rounded-button bg-primary active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel={t('workout.finishSheetConfirm')}
              >
                <Text className="text-body font-inter-semibold text-background">
                  {t('workout.finishSheetConfirm')}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
