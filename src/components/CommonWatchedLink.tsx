import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@/theme/tokens';

export function CommonWatchedLink({ profileId, count, language }: { profileId: string; count: number; language: 'tr' | 'en' }) {
  const en = language === 'en';
  const title = en ? 'Watched in common' : 'Ortak izlediklerimiz';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${count} ${en ? (count === 1 ? 'title' : 'titles') : 'yapım'}`} onPress={() => router.push({ pathname: '/common-watched/[id]', params: { id: profileId } })} style={styles.root}>
    <View style={styles.icon}><Ionicons name="checkmark-done-outline" size={23} color={colors.primary} /></View>
    <View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.description}>{en ? 'Movies and shows you have both watched.' : 'İkinizin de izlediği film ve diziler.'}</Text></View>
    <View style={styles.trailing}><Text style={styles.count}>{count}</Text><Ionicons name="chevron-forward" size={18} color={colors.muted} /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated },
  copy: { flex: 1 }, title: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 21 }, description: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 6 }, count: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
