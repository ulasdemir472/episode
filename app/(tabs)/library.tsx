import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { LibraryStatus } from '@/domain/media';
import { useLibraryStore } from '@/store/library-store';
import { colors, radius, spacing } from '@/theme/tokens';

const filters: { label: string; value: LibraryStatus }[] = [
  { label: 'İzliyorum', value: 'watching' },
  { label: 'İzleyeceğim', value: 'watchlist' },
  { label: 'Tamamlandı', value: 'completed' },
  { label: 'Bıraktım', value: 'dropped' },
];

export default function LibraryScreen() {
  const [filter, setFilter] = useState<LibraryStatus>('watching');
  const allItems = useLibraryStore((state) => state.items);
  const items = allItems.filter((item) => item.status === filter);

  return <Screen>
    <View style={styles.header}><Text style={styles.kicker}>KİŞİSEL ARŞİV</Text><Text style={styles.title}>Listem</Text><Text style={styles.summary}>{allItems.length} yapım · izleme durumuna göre düzenlendi</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {filters.map((item) => {
        const count = allItems.filter((libraryItem) => libraryItem.status === item.value).length;
        return <Pressable key={item.value} style={[styles.filter, filter === item.value && styles.active]} onPress={() => setFilter(item.value)}><Text style={[styles.filterText, filter === item.value && styles.activeText]}>{item.label}</Text><View style={[styles.count, filter === item.value && styles.activeCount]}><Text style={[styles.countText, filter === item.value && styles.activeCountText]}>{count}</Text></View></Pressable>;
      })}
    </ScrollView>
    <FlatList scrollEnabled={false} data={items} keyExtractor={(item) => `${item.status}-${item.media.id}`} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={styles.grid} renderItem={({ item }) => {
      const percent = item.progress?.total ? Math.min(100, item.progress.watched / item.progress.total * 100) : 0;
      return <View style={styles.card}><MediaCard media={item.media} width={158} />{item.progress && <><View style={styles.progressTrack}><View style={[styles.progress, { width: `${percent}%` }]} /></View><Text style={styles.progressLabel}>{item.progress.watched}/{item.progress.total} bölüm izlendi</Text></>}</View>;
    }} ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyTitle}>Burada henüz bir şey yok</Text><Text style={styles.empty}>Bir dizinin bölümünü işaretlediğinde otomatik olarak “İzliyorum” listesine taşınır.</Text></View>} />
  </Screen>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg }, kicker: { color: colors.primary, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' }, title: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.2, marginTop: 4 }, summary: { color: colors.muted, fontSize: 12, marginTop: 6 },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.sm }, filter: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, active: { backgroundColor: colors.text, borderColor: colors.text }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, activeText: { color: colors.background }, count: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, activeCount: { backgroundColor: colors.primary }, countText: { color: colors.muted, fontSize: 10, fontWeight: '800' }, activeCountText: { color: '#fff' },
  grid: { paddingHorizontal: spacing.lg }, row: { justifyContent: 'space-between', marginBottom: spacing.lg }, card: { width: 158 }, progressTrack: { width: 158, height: 4, backgroundColor: colors.elevated, marginTop: 8, borderRadius: 2, overflow: 'hidden' }, progress: { height: 4, backgroundColor: colors.primary }, progressLabel: { color: colors.muted, fontSize: 9, marginTop: 5 }, emptyBox: { marginTop: 70, paddingHorizontal: spacing.xl, alignItems: 'center' }, emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' }, empty: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: spacing.sm },
});
