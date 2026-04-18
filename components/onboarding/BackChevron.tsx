import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

/**
 * Back chevron for the onboarding header (screens 2..5).
 *
 * Designed to be handed to `<OnboardingProgress leading={<BackChevron />} />`
 * on screens 2-5 so the header-row layout stays consistent across the
 * onboarding stack.
 *
 * Behaviour:
 * - `Haptics.selectionAsync()` on press, then `router.back()`.
 * - Visual size is `h-10 w-10` (40pt); hit-slop widens the tap target to the
 *   iOS 44pt minimum without visually inflating the chevron.
 * - Icon is `ionicons chevron-back` at 24pt in `text-content-secondary` —
 *   matches the treatment in auth screens (login / verify / enter-code) so
 *   the whole app's back-chevrons share one visual language.
 *
 * Accessibility: uses `common.back` as the label. No hint — a back affordance
 * is the most universal pattern on iOS, further explanation would be noise.
 */
export default function BackChevron() {
  const router = useRouter();
  const { t } = useTranslation();

  const handlePress = () => {
    Haptics.selectionAsync();
    router.back();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className="ml-2 h-10 w-10 items-center justify-center rounded-full active:bg-surface"
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
    >
      <Ionicons name="chevron-back" size={24} color="#A3A3A3" />
    </Pressable>
  );
}
