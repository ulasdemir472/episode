import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme/tokens';
export function SectionHeader({ title, caption }: { title: string; caption?: string }) {
  return <View style={styles.row}><Text style={styles.title}>{title}</Text>{caption && <Text style={styles.caption}>{caption}</Text>}</View>;
}
const styles = StyleSheet.create({ row: { marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, title: { color: colors.text, fontSize: 20, fontWeight: '800' }, caption: { color: colors.primary, fontSize: 12, fontWeight: '700' } });

