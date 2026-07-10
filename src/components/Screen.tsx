import { PropsWithChildren } from 'react';
import { ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';

export function Screen({ children, scroll = true, ...props }: PropsWithChildren<ScrollViewProps & { scroll?: boolean }>) {
  return <SafeAreaView style={styles.safe} edges={['top']}>{scroll ? <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} {...props}>{children}</ScrollView> : <View style={styles.fill}>{children}</View>}</SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, content: { paddingBottom: 120 }, fill: { flex: 1 } });

