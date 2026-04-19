/**
 * components/picker/FilterPill.tsx
 *
 * Single horizontally-scrollable filter chip used in the exercise picker
 * (T-206). Two visual states:
 *   - active   → lime bg, background text
 *   - inactive → surface bg, secondary text
 *
 * Height: 32pt visual, with hitSlop vertical +8pt so the effective tap
 * target stays above the 44pt gym minimum. The compact height is part
 * of the viewport-hierarchy rule (feedback_viewport_hierarchy): chrome
 * ≤40% of viewport, which required shrinking the two filter rows to
 * h-9 containers with h-8 pills inside.
 */

import React from 'react';
import { Pressable, Text } from 'react-native';
import * as Haptics from 'expo-haptics';

type FilterPillProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
};

function FilterPillImpl({
  label,
  active,
  onPress,
  accessibilityLabel,
}: FilterPillProps) {
  const handlePress = () => {
    void Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      className={`h-8 items-center justify-center rounded-pill px-3 ${
        active ? 'bg-primary' : 'bg-surface'
      }`}
      hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text
        className={`text-small-caps uppercase ${
          active ? 'text-background' : 'text-content-secondary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default React.memo(FilterPillImpl);
