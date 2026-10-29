import { ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleProp, ViewStyle } from 'react-native';

// Small content changes stay in place and fade/slide in; reduced motion disables movement.
export function ContentTransition({ changeKey, children, style }: { changeKey: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [progress] = useState(() => new Animated.Value(1));
  const previous = useRef(changeKey);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduceMotion(value); }).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (previous.current === changeKey) return;
    previous.current = changeKey;
    progress.stopAnimation();
    if (reduceMotion) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animation.start();
    return () => { animation.stop(); progress.setValue(1); };
  }, [changeKey, progress, reduceMotion]);
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>{children}</Animated.View>;
}
