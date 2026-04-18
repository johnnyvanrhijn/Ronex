import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

type OnboardingProgressProps = {
  /** 1-based index of the current step. */
  step: number;
  /** Total number of onboarding steps. */
  total: number;
  /**
   * Optional leading slot — typically a back chevron on screens 2..5. When
   * provided it is rendered to the left of the progress dots, and the dots'
   * left margin is trimmed so the row reads balanced.
   *
   * When omitted (screen 1 — `identity.tsx`), the layout is unchanged from the
   * original T-108 rendering: dots hug the left edge at `ml-6`, step-label
   * hugs the right at `mr-6`.
   */
  leading?: React.ReactNode;
};

/**
 * Onboarding step indicator — progress dots + right-aligned small-caps label
 * "STAP X VAN Y".
 *
 * Reused across T-108..T-112. Callers pass `step` as the 1-based index.
 * First `step` dots render filled (`bg-primary`), the rest render hollow
 * (`bg-surface-elevated`).
 *
 * Header layouts:
 * - Screen 1 (no `leading`): `[dots_____________step-label]`
 * - Screens 2..5 (`leading={<BackChevron />}`): `[chevron][dots][____][step-label]`
 *
 * Accessibility: the dots themselves are decorative (hidden from VoiceOver);
 * the container exposes a semantic label via i18n so screen readers hear
 * e.g. "Step 1 of 5". The `leading` node is expected to manage its own
 * accessibility (e.g. BackChevron sets its own role + label).
 */
export default function OnboardingProgress({
  step,
  total,
  leading,
}: OnboardingProgressProps) {
  const { t } = useTranslation();

  const label = t('onboarding.progressLabel', { current: step, total });

  return (
    <View
      className="mt-2 flex-row items-center justify-between"
      accessibilityLabel={label}
      accessibilityRole="progressbar"
    >
      {/* Left cluster: optional leading slot + dots. When `leading` is present
          the chevron replaces the `ml-6` left indent and the dots shift to
          `ml-2` so the two elements read as a paired unit. */}
      <View className="flex-row items-center">
        {leading}
        <View
          className={`flex-row items-center ${leading ? 'ml-2' : 'ml-6'}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: total }).map((_, index) => {
            const filled = index < step;
            return (
              <View
                key={index}
                className={`h-1.5 w-1.5 rounded-full ${
                  filled ? 'bg-primary' : 'bg-surface-elevated'
                } ${index > 0 ? 'ml-1' : ''}`}
              />
            );
          })}
        </View>
      </View>

      {/* Step label — the only small-caps element in the header slot. */}
      <Text className="mr-6 text-small-caps uppercase text-content-muted">
        {label}
      </Text>
    </View>
  );
}
