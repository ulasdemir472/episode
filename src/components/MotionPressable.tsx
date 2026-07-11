import { ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type MotionPressableProps = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export function MotionPressable({ children, style, pressedScale = 0.965, onPressIn, onPressOut, disabled, ...props }: MotionPressableProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const animate = (pressed: boolean) => {
    if (reduceMotion) {
      scale.setValue(1);
      opacity.setValue(pressed ? 0.86 : 1);
      return;
    }
    Animated.parallel([
      Animated.spring(scale, { toValue: pressed ? pressedScale : 1, speed: pressed ? 42 : 24, bounciness: pressed ? 0 : 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: pressed ? 0.88 : 1, duration: pressed ? 80 : 150, useNativeDriver: true }),
    ]).start();
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    animate(true);
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    animate(false);
    onPressOut?.(event);
  };

  return <Pressable {...props} disabled={disabled} onPressIn={handlePressIn} onPressOut={handlePressOut}>
    <Animated.View style={[style, { opacity: disabled ? 0.45 : opacity, transform: [{ scale }] }]}>{children}</Animated.View>
  </Pressable>;
}
