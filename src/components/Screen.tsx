import { createContext, PropsWithChildren, useCallback, useContext, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';

type ScreenScrollContextValue = {
  scrollToEnd: () => void;
  scrollToY: (y: number) => void;
};

const ScreenScrollContext = createContext<ScreenScrollContextValue>({ scrollToEnd: () => undefined, scrollToY: () => undefined });

export function useScrollToScreenEnd() {
  return useContext(ScreenScrollContext).scrollToEnd;
}

export function useScrollToScreenY() {
  return useContext(ScreenScrollContext).scrollToY;
}

export function Screen({ children, scroll = true, ...props }: PropsWithChildren<ScrollViewProps & { scroll?: boolean }>) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 180);
  }, []);
  const scrollToY = useCallback((y: number) => {
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true }), 180);
  }, []);

  return <SafeAreaView style={styles.safe} edges={['top']}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScreenScrollContext.Provider value={{ scrollToEnd, scrollToY }}>{scroll ? <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} {...props}>{children}</ScrollView> : <View style={styles.fill}>{children}</View>}</ScreenScrollContext.Provider>
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { paddingBottom: 120 }, fill: { flex: 1 } });
