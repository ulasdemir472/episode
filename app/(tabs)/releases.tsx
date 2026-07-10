import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { demoReleases } from '@/data/demo';
import { enableNotifications } from '@/services/notifications';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ReleasesScreen() {
  return <Screen>
    <View style={styles.header}><Text style={styles.kicker}>TAKVİMİN</Text><Text style={styles.title}>Yeni bölümler</Text><Text style={styles.subtitle}>Takip ettiğin dizilerden kaçırmaman gerekenler.</Text><Pressable style={styles.notify} onPress={() => enableNotifications()}><Ionicons name="notifications-outline" size={18} color={colors.text} /><Text style={styles.notifyText}>Bildirimleri aç</Text></Pressable></View>
    <View style={styles.dateRow}><Text style={styles.date}>BUGÜN</Text><View style={styles.line} /></View>
    {demoReleases.map((release, index) => <View key={release.id} style={styles.item}>
      <Image source={{ uri: release.show.posterUrl }} style={styles.poster} />
      <View style={styles.info}><Text style={styles.show}>{release.show.title}</Text><Text style={styles.episode}>S{release.season} · B{release.episode}  “{release.title}”</Text><Text style={styles.time}>{index === 0 ? 'Bugün yayınlandı' : 'Dün yayınlandı'}</Text></View>
      <Pressable accessibilityLabel="İzlendi işaretle" style={styles.check}><Ionicons name="checkmark" size={20} color={colors.muted} /></Pressable>
    </View>)}
  </Screen>;
}
const styles = StyleSheet.create({ header: { padding: spacing.lg }, kicker: { color: colors.primary, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' }, title: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 4 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: spacing.sm }, notify: { alignSelf: 'flex-start', marginTop: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, notifyText: { color: colors.text, fontWeight: '700', fontSize: 12 }, dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginVertical: spacing.md }, date: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, line: { height: 1, backgroundColor: colors.border, flex: 1 }, item: { marginHorizontal: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, poster: { width: 58, height: 82, borderRadius: radius.sm }, info: { flex: 1, paddingHorizontal: spacing.md }, show: { color: colors.text, fontWeight: '800', fontSize: 15 }, episode: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 }, time: { color: colors.success, fontSize: 10, fontWeight: '700', marginTop: 6 }, check: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' } });

