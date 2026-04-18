import React, { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastProps = {
  visible: boolean;
  message: string;
  onHide: () => void;
};

/**
 * Minimal inline toast — absolute-positioned above the home indicator.
 * Slides up + fades in on visible=true, auto-hides after 3s.
 *
 * Designer note: kept intentionally simple. T-106 wires it as a placeholder
 * for future error paths (code validation in T-115).
 */
export default function Toast({ visible, message, onHide }: ToastProps) {
  const insets = useSafeAreaInsets();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.quad),
      });
      translateY.value = withTiming(0, {
        duration: 200,
        easing: Easing.out(Easing.quad),
      });

      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(20, { duration: 200 });
        // Fire onHide after the exit animation completes.
        setTimeout(onHide, 200);
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(20, { duration: 200 });
    }
  }, [visible, onHide, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Keep rendered while hidden so exit animation can run; the animated opacity
  // will be 0, which makes the view fully transparent.
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        {
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: insets.bottom + 24,
        },
        animatedStyle,
      ]}
      className="rounded-card bg-surface-elevated px-4 py-3"
    >
      <Text className="text-body font-inter text-content">{message}</Text>
    </Animated.View>
  );
}
