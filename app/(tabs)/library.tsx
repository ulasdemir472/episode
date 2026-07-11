import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { LibraryItem, LibraryStatus } from '@/domain/media';
import { catalogService } from '@/services/tmdb';
import { useLibraryStore } from '@/store/library-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { useProfileStore } from '@/store/profile-store';
import { MotionPressable } from '@/components/MotionPressable';

type LibraryFilter = LibraryStatus | 'favorites';

const filters: { tr: string; en: string; value: LibraryFilter }[] = [
  { tr: 'Favorilerim', en: 'Favorites', value: 'favorites' },
  { tr: 'İzliyorum', en: 'Watching', value: 'watching' },
  { tr: 'İzleyeceğim', en: 'Watchlist', value: 'watchlist' },
  { tr: 'Tamamlandı', en: 'Completed', value: 'completed' },
  { tr: 'Bıraktım', en: 'Dropped', value: 'dropped' },
];

function LibraryMediaCard({ item }: { item: LibraryItem }) {
  const en = useProfileStore((state) => state.language) === 'en';
  const watchedEpisodes = useLibraryStore((state) => state.watchedEpisodes);
  const series = useQuery({ queryKey: ['series', item.media.id], queryFn: () => catalogService.seriesDetails(item.media.id), enabled: item.media.type === 'tv' && item.status === 'watching', staleTime: 60 * 60_000 });
  const nextEpisode = series.data?.seasons.flatMap((season) => Array.from({ length: season.episodeCount }, (_, index) => ({ season: season.number, episode: index + 1 }))).find((episode) => !watchedEpisodes[`${item.media.id}:${episode.season}:${episode.episode}`]);
  const percent = item.progress?.total ? Math.min(100, item.progress.watched / item.progress.total * 100) : 0;
  return <View style={styles.card}><MediaCard media={item.media} width={158} />{item.progress && <><View style={styles.progressTrack}><View style={[styles.progress, { width: `${percent}%` }]} /></View><Text style={styles.progressLabel}>{item.progress.watched}/{item.progress.total} {en ? 'episodes watched' : 'bölüm izlendi'}</Text>{item.status === 'watching' && (nextEpisode ?? item.progress.nextEpisode) && <Text style={styles.nextLabel}>{en ? 'Next' : 'Sıradaki'} · S{(nextEpisode ?? item.progress.nextEpisode)!.season} E{(nextEpisode ?? item.progress.nextEpisode)!.episode}</Text>}</>}</View>;
}

export default function LibraryScreen() {
  const [filter, setFilter] = useState<LibraryFilter>('watching');
  const en = useProfileStore((state) => state.language) === 'en';
  const favorites = useProfileStore((state) => state.favorites);
  const allItems = useLibraryStore((state) => state.items);
  const items: LibraryItem[] = filter === 'favorites'
    ? favorites.map((media) => allItems.find((item) => item.media.id === media.id && item.media.type === media.type) ?? { media, status: 'watchlist' })
    : allItems.filter((item) => item.status === filter);

  return <Screen>
    <View style={styles.header}><Text style={styles.kicker}>{en ? 'PERSONAL ARCHIVE' : 'KİŞİSEL ARŞİV'}</Text><Text style={styles.title}>{en ? 'My library' : 'Listem'}</Text><Text style={styles.summary}>{allItems.length} {en ? 'titles · organized by status' : 'yapım · izleme durumuna göre düzenlendi'}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {filters.map((item) => {
        const count = item.value === 'favorites' ? favorites.length : allItems.filter((libraryItem) => libraryItem.status === item.value).length;
        return <MotionPressable key={item.value} style={[styles.filter, filter === item.value && styles.active]} onPress={() => setFilter(item.value)}><Text style={[styles.filterText, filter === item.value && styles.activeText]}>{en ? item.en : item.tr}</Text><View style={[styles.count, filter === item.value && styles.activeCount]}><Text style={[styles.countText, filter === item.value && styles.activeCountText]}>{count}</Text></View></MotionPressable>;
      })}
    </ScrollView>
    <FlatList scrollEnabled={false} data={items} keyExtractor={(item) => `${item.status}-${item.media.id}`} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={styles.grid} renderItem={({ item }) => <LibraryMediaCard item={item} />} ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyTitle}>Burada henüz bir şey yok</Text><Text style={styles.empty}>Bir dizinin bölümünü işaretlediğinde otomatik olarak “İzliyorum” listesine taşınır.</Text></View>} />
  </Screen>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg }, kicker: { color: colors.primary, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' }, title: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.2, marginTop: 4 }, summary: { color: colors.muted, fontSize: 12, marginTop: 6 },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.sm }, filter: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, active: { backgroundColor: colors.text, borderColor: colors.text }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, activeText: { color: colors.background }, count: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, activeCount: { backgroundColor: colors.primary }, countText: { color: colors.muted, fontSize: 10, fontWeight: '800' }, activeCountText: { color: '#fff' },
  grid: { paddingHorizontal: spacing.lg }, row: { justifyContent: 'space-between', marginBottom: spacing.lg }, card: { width: 158 }, progressTrack: { width: 158, height: 4, backgroundColor: colors.elevated, marginTop: 8, borderRadius: 2, overflow: 'hidden' }, progress: { height: 4, backgroundColor: colors.primary }, progressLabel: { color: colors.muted, fontSize: 9, marginTop: 5 }, nextLabel: { color: colors.success, fontSize: 10, fontWeight: '800', marginTop: 4 }, emptyBox: { marginTop: 70, paddingHorizontal: spacing.xl, alignItems: 'center' }, emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' }, empty: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: spacing.sm },
});
