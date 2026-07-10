import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { LibraryStatus } from '@/domain/media';
import { useLibraryStore } from '@/store/library-store';
import { colors, radius, spacing } from '@/theme/tokens';

const filters: { label: string; value: LibraryStatus }[] = [{ label: 'İzliyorum', value: 'watching' }, { label: 'İzleyeceğim', value: 'watchlist' }, { label: 'Tamamlandı', value: 'completed' }];
export default function LibraryScreen() {
  const [filter, setFilter] = useState<LibraryStatus>('watching');
  const items = useLibraryStore((state) => state.items).filter((item) => item.status === filter);
  return <Screen><View style={styles.header}><Text style={styles.kicker}>KİŞİSEL ARŞİV</Text><Text style={styles.title}>Listem</Text></View><View style={styles.filters}>{filters.map((item) => <Pressable key={item.value} style={[styles.filter, filter === item.value && styles.active]} onPress={() => setFilter(item.value)}><Text style={[styles.filterText, filter === item.value && styles.activeText]}>{item.label}</Text></Pressable>)}</View>
    <FlatList scrollEnabled={false} data={items} keyExtractor={(item) => String(item.media.id)} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={styles.grid} renderItem={({ item }) => <View><MediaCard media={item.media} width={158} />{item.progress && <View style={styles.progressTrack}><View style={[styles.progress, { width: `${item.progress.watched / item.progress.total * 100}%` }]} /></View>}</View>} ListEmptyComponent={<Text style={styles.empty}>Bu listede henüz bir yapım yok.</Text>} />
  </Screen>;
}
const styles = StyleSheet.create({ header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg }, kicker: { color: colors.primary, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' }, title: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.2, marginTop: 4 }, filters: { margin: spacing.lg, flexDirection: 'row', padding: 4, backgroundColor: colors.surface, borderRadius: radius.pill }, filter: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill }, active: { backgroundColor: colors.text }, filterText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, activeText: { color: colors.background }, grid: { paddingHorizontal: spacing.lg }, row: { justifyContent: 'space-between', marginBottom: spacing.lg }, progressTrack: { width: 158, height: 3, backgroundColor: colors.elevated, marginTop: 7, borderRadius: 2, overflow: 'hidden' }, progress: { height: 3, backgroundColor: colors.primary }, empty: { color: colors.muted, textAlign: 'center', marginTop: 80 } });

