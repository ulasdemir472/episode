import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { t } from '@/i18n/strings';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { MediaType, mediaKey } from '@/domain/media';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { catalogService } from '@/services/tmdb';
import { colors, radius, spacing } from '@/theme/tokens';
import { useProfileStore } from '@/store/profile-store';
import { MotionPressable } from '@/components/MotionPressable';
import { ChoicePicker } from '@/components/ChoicePicker';
import { NotificationButton } from '@/components/NotificationButton';

type TypeFilter = 'all' | MediaType;
type Genre = { tr: string; en: string; movie: number; tv: number };

const typeFilters: { value: TypeFilter; tr: string; en: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'all', tr: 'Tümü', en: 'All', icon: 'sparkles-outline' },
  { value: 'movie', tr: 'Filmler', en: 'Movies', icon: 'film-outline' },
  { value: 'tv', tr: 'Diziler', en: 'Shows', icon: 'tv-outline' },
];

const genres: Genre[] = [
  { tr: 'Aksiyon', en: 'Action', movie: 28, tv: 10759 },
  { tr: 'Macera', en: 'Adventure', movie: 12, tv: 10759 },
  { tr: 'Komedi', en: 'Comedy', movie: 35, tv: 35 },
  { tr: 'Drama', en: 'Drama', movie: 18, tv: 18 },
  { tr: 'Animasyon', en: 'Animation', movie: 16, tv: 16 },
  { tr: 'Suç', en: 'Crime', movie: 80, tv: 80 },
  { tr: 'Gizem', en: 'Mystery', movie: 9648, tv: 9648 },
  { tr: 'Romantik', en: 'Romance', movie: 10749, tv: 0 },
  { tr: 'Korku', en: 'Horror', movie: 27, tv: 0 },
  { tr: 'Aile', en: 'Family', movie: 10751, tv: 10751 },
  { tr: 'Belgesel', en: 'Documentary', movie: 99, tv: 99 },
  { tr: 'Bilim Kurgu', en: 'Sci-Fi', movie: 878, tv: 10765 },
  { tr: 'Fantastik', en: 'Fantasy', movie: 14, tv: 10765 },
];

export default function DiscoverScreen() {
  const language = useProfileStore((state) => state.language);
  const en = language === 'en';
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 450);
  const [type, setType] = useState<TypeFilter>('all');
  const [genreName, setGenreName] = useState('');
  const genre = genres.find((item) => item.en === genreName);
  const [year, setYear] = useState('');
  const [minRating, setMinRating] = useState(0);
  const selectedYear = year;
  const latestYear = new Date().getFullYear() + 1;
  const { width } = useWindowDimensions();
  const columns = Math.max(2, Math.min(4, Math.floor((width - 48) / 158)));
  const cardWidth = (width - 48 - (columns - 1) * 12) / columns;
  const searching = query.trim().length > 1;
  const waitingForSearch = searching && query.trim() !== debouncedQuery;

  const search = useInfiniteQuery({ queryKey: ['search', debouncedQuery, language], initialPageParam: 1, queryFn: ({ pageParam }) => catalogService.searchPage(debouncedQuery, pageParam, language), getNextPageParam: (last) => last.nextPage, enabled: searching && debouncedQuery.length > 1 });
  const trending = useQuery({ queryKey: ['trending', language], queryFn: () => catalogService.trending(language), enabled: !searching && type === 'all' });
  const genreId = type === 'movie' ? genre?.movie : type === 'tv' ? genre?.tv : undefined;
  const discovery = useInfiniteQuery({ queryKey: ['discover', type, genreId, selectedYear, minRating, language], initialPageParam: 1, queryFn: ({ pageParam }) => catalogService.discoverPage(type as MediaType, { genreId, year: selectedYear, minRating, page: pageParam }, language), getNextPageParam: (last) => last.nextPage, enabled: !searching && type !== 'all' });
  const activeQuery = searching ? search : type === 'all' ? trending : discovery;
  const moreQuery = searching ? search : type === 'all' ? undefined : discovery;
  const rawData = searching ? search.data?.pages.flatMap((page) => page.items) ?? [] : type === 'all' ? trending.data ?? [] : discovery.data?.pages.flatMap((page) => page.items) ?? [];
  const data = waitingForSearch ? [] : [...new Map(rawData.filter((item) => !searching || type === 'all' || item.type === type).map((item) => [mediaKey(item), item])).values()];

  const changeType = (next: TypeFilter) => {
    setType(next);
    if (next === 'all' || (next === 'tv' && genre?.tv === 0)) setGenreName('');
  };

  const header = <>
    <View style={styles.header}>
      <Text style={styles.kicker}>{en ? 'FIND A NEW STORY' : 'YENİ BİR HİKÂYE BUL'}</Text>
      <View style={styles.titleRow}><Text style={styles.title}>{en ? 'Discover' : 'Keşfet'}</Text><NotificationButton /></View>
      <View style={styles.search}><Ionicons name="search" size={20} color={colors.muted} /><TextInput accessibilityLabel={en ? 'Search movies or shows' : 'Dizi veya film ara'} value={query} onChangeText={setQuery} placeholder={en ? 'Search movies or shows...' : 'Dizi veya film ara...'} placeholderTextColor={colors.muted} style={styles.input} autoCorrect={false} returnKeyType="search" />{query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Clear search' : 'Aramayı temizle'} onPress={() => setQuery('')} hitSlop={10}><Ionicons name="close-circle" size={19} color={colors.muted} /></Pressable>}</View>
    </View>

    <View style={styles.filterRow}>
      <ChoicePicker label={en ? 'Content' : 'İçerik'} value={type} onChange={changeType} closeLabel={en ? 'Close' : 'Kapat'} options={typeFilters.map((item) => ({ value: item.value, label: en ? item.en : item.tr }))} />
      {!searching && type !== 'all' && <ChoicePicker label={en ? 'Genre' : 'Tür'} value={genreName} onChange={setGenreName} closeLabel={en ? 'Close' : 'Kapat'} options={[{ value: '', label: en ? 'All genres' : 'Tüm türler' }, ...genres.filter((item) => type !== 'tv' || item.tv > 0).map((item) => ({ value: item.en, label: en ? item.en : item.tr }))]} />}
    </View>
    {!searching && type !== 'all' && <View style={styles.filterRow}>
      <ChoicePicker label={t(language, 'year')} value={year} onChange={setYear} closeLabel={en ? 'Close' : 'Kapat'} options={[{ value: '', label: t(language, 'anyYear') }, ...Array.from({ length: latestYear - 1874 + 1 }, (_, index) => ({ value: String(latestYear - index), label: String(latestYear - index) }))]} />
      <ChoicePicker label={t(language, 'minRating')} value={minRating} onChange={setMinRating} closeLabel={en ? 'Close' : 'Kapat'} options={[{ value: 0, label: en ? 'Any rating' : 'Tüm puanlar' }, ...Array.from({ length: 20 }, (_, index) => ({ value: (index + 1) / 2, label: `${((index + 1) / 2).toLocaleString(en ? 'en-US' : 'tr-TR')}+` }))]} />
    </View>}
  </>;
  return <Screen scroll={false}><FlatList keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" key={columns} data={data} keyExtractor={mediaKey} numColumns={columns} ListHeaderComponent={header} columnWrapperStyle={[styles.row, { paddingHorizontal: spacing.lg }]} contentContainerStyle={{ paddingBottom: 120 }} renderItem={({ item }) => <MediaCard media={item} width={cardWidth} inGrid />} onEndReached={() => { if (!waitingForSearch && moreQuery?.hasNextPage && !moreQuery.isFetchingNextPage) void moreQuery.fetchNextPage(); }} onEndReachedThreshold={0.4} refreshing={activeQuery.isRefetching && !moreQuery?.isFetchingNextPage} onRefresh={() => { void activeQuery.refetch(); }} ListFooterComponent={moreQuery?.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null} ListEmptyComponent={waitingForSearch || activeQuery.isLoading ? <ActivityIndicator accessibilityLabel={en ? 'Searching' : 'Aranıyor'} color={colors.primary} style={styles.loader} /> : activeQuery.isError ? <MotionPressable onPress={() => activeQuery.refetch()}><Text style={styles.empty}>{en ? 'Content could not be loaded.' : 'İçerikler yüklenemedi.'} {t(language, 'retry')}</Text></MotionPressable> : <Text style={styles.empty}>{en ? 'No results found.' : 'Sonuç bulunamadı.'}</Text>} /></Screen>;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, filterRow: { flexDirection: 'row', gap: 8, marginHorizontal: spacing.lg, marginBottom: 8 },
  header: { padding: spacing.lg }, kicker: { color: colors.primary, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' }, title: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.2, marginTop: 3 }, search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, height: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: spacing.lg }, input: { color: colors.text, flex: 1, fontSize: 15 },
  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm }, typeFilter: { height: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 15, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, filterActive: { backgroundColor: colors.primary, borderColor: colors.primary }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, filterTextActive: { color: '#fff' },
  genres: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 7 }, genre: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.elevated }, genreActive: { backgroundColor: colors.text }, genreText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, genreTextActive: { color: colors.background },
  loader: { marginTop: spacing.xl }, grid: { paddingHorizontal: spacing.lg }, row: { justifyContent: 'space-between', marginBottom: spacing.lg }, empty: { color: colors.muted, textAlign: 'center', marginTop: 80 },
});
