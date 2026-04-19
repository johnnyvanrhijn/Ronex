/**
 * components/picker/ExerciseRow.tsx
 *
 * One row in the exercise picker list (T-206).
 *
 * Layout
 * ------
 *   [ name  L/R? ]                                   [ logging label ]
 *   [ muscle · equipment · compound? ]
 *
 * Row height is driven by content (h-16 minimum = 64pt) with 12px
 * vertical padding. With two text lines (body + body) the rendered
 * height lands around 70-76pt — well below the 88pt ceiling the
 * viewport-hierarchy rule demands (feedback_viewport_hierarchy).
 * Separator between rows is a 2pt spacer (see picker list),
 * yielding ~76pt effective stride. That gives ~5 rows visible on
 * iPhone SE above the fold after the compact header + filters.
 *
 * Tap target: the whole row — 64pt+ tall which exceeds the 44pt gym
 * minimum and comes close to the 56pt workout threshold. Picker browsing
 * is a calm interaction so we don't need the full 56pt.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Exercise } from '@/lib/queries/useExercises';

type ExerciseRowProps = {
  exercise: Exercise;
  muscleLabel: string; // translated primary muscle (e.g. "Borst")
  equipmentLabel: string; // translated equipment (e.g. "Barbell")
  compoundLabel: string; // translated "Compound" marker
  unilateralLabel: string; // translated "L/R" marker
  loggingLabel: string; // small-caps logging type ("WEIGHT × REPS")
  onPress: (exerciseId: string) => void;
};

function ExerciseRowImpl({
  exercise,
  muscleLabel,
  equipmentLabel,
  compoundLabel,
  unilateralLabel,
  loggingLabel,
  onPress,
}: ExerciseRowProps) {
  // Metadata line: muscle · equipment · (Compound)?. Interpunct U+00B7
  // matches challenge.tsx summary formatting.
  const metaParts = [muscleLabel, equipmentLabel];
  if (exercise.is_compound) metaParts.push(compoundLabel);
  const metaLine = metaParts.join(' \u00B7 ');

  return (
    <Pressable
      onPress={() => onPress(exercise.id)}
      className="min-h-16 flex-row items-center rounded-card bg-surface px-4 py-3 active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}. ${metaLine}. ${loggingLabel}.`}
    >
      {/* LEFT: name + metadata ------------------------------------ */}
      <View className="flex-1 pr-3">
        <View className="flex-row items-baseline">
          <Text
            className="text-body font-inter-semibold text-content"
            numberOfLines={1}
          >
            {exercise.name}
          </Text>
          {exercise.is_unilateral && (
            <Text className="ml-2 text-small-caps uppercase text-content-muted">
              {unilateralLabel}
            </Text>
          )}
        </View>
        <Text
          className="mt-1 font-inter text-body text-content-secondary"
          numberOfLines={1}
        >
          {metaLine}
        </Text>
      </View>

      {/* RIGHT: logging-type label -------------------------------- */}
      <Text className="text-small-caps uppercase text-content-muted">
        {loggingLabel}
      </Text>
    </Pressable>
  );
}

export default React.memo(ExerciseRowImpl);
