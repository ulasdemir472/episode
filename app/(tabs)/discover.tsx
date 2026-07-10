import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { MediaType } from '@/domain/media';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { catalogService } from '@/services/tmdb';
import { colors, radius, spacing } from '@/theme/tokens';
import { useProfileStore } from '@/store/profile-store';

type TypeFilter = 'all' | MediaType;
type Genre = { tr: string; en: string; movie: number; tv: number };

const typeFilters: { value: TypeFilter; tr: string; en: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'all', tr: 'Tümü', en: 'All', icon: 'sparkles-outline' },
  { value: 'movie', tr: 'Filmler', en: 'Movies', icon: 'film-outline' },
  { value: 'tv', tr: 'Diziler', en: 'Shows', icon: 'tv-outline' },
];

const genres: Genre[] = [
  { tr: 'Aksiyon', en: 'Action', movie: 28, tv: 10759 },
  { tr: 'Komedi', en: 'Comedy', movie: 35, tv: 35 },
  { tr: 'Drama', en: 'Drama', movie: 18, tv: 18 },
  { tr: 'Animasyon', en: 'Animation', movie: 16, tv: 16 },
  { tr: 'Suç', en: 'Crime', movie: 80, tv: 80 },
  { tr: 'Belgesel', en: 'Documentary', movie: 99, tv: 99 },
  { tr: 'Bilim Kurgu', en: 'Sci-Fi', movie: 878, tv: 10765 },
];

export default function DiscoverScreen() {
  const en = useProfileStore((state) => state.language) === 'en';
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 450);
  const [type, setType] = useState<TypeFilter>('all');
  const [genre, setGenre] = useState<Genre>();
  const searching = query.trim().length > 1;

  const search = useQuery({ queryKey: ['search', debouncedQuery], queryFn: () => catalogService.search(debouncedQuery), enabled: debouncedQuery.length > 1 });
  const trending = useQuery({ queryKey: ['trending'], queryFn: catalogService.trending, enabled: !searching && type === 'all' });
  const genreId = type === 'movie' ? genre?.movie : type === 'tv' ? genre?.tv : undefined;
  const discovery = useQuery({
    queryKey: ['discover', type, genreId],
    queryFn: () => catalogService.discover(type as MediaType, genreId),
    enabled: !searching && type !== 'all',
  });
  const activeQuery = searching ? search : type === 'all' ? trending : discovery;
  const data = activeQuery.data ?? [];

  const changeType = (next: TypeFilter) => {
    setType(next);
    if (next === 'all') setGenre(undefined);
  };

  return <Screen>
    <View style={styles.header}>
      <Text style={styles.kicker}>{en ? 'FIND A NEW STORY' : 'YENİ BİR HİKÂYE BUL'}</Text>
      <Text style={styles.title}>{en ? 'Discover' : 'Keşfet'}</Text>
      <View style={styles.search}><Ionicons name="search" size={20} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder={en ? 'Search movies or shows...' : 'Dizi veya film ara...'} placeholderTextColor={colors.muted} style={styles.input} autoCorrect={false} returnKeyType="search" />{query.length > 0 && <Ionicons name="close-circle" size={19} color={colors.muted} onPress={() => setQuery('')} />}</View>
    </View>

    {!searching && <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {typeFilters.map((item) => <Pressable key={item.value} onPress={() => changeType(item.value)} style={[styles.typeFilter, type === item.value && styles.filterActive]}><Ionicons name={item.icon} size={16} color={type === item.value ? '#fff' : colors.muted} /><Text style={[styles.filterText, type === item.value && styles.filterTextActive]}>{en ? item.en : item.tr}</Text></Pressable>)}
      </ScrollView>
      {type !== 'all' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genres}>
        <Pressable onPress={() => setGenre(undefined)} style={[styles.genre, !genre && styles.genreActive]}><Text style={[styles.genreText, !genre && styles.genreTextActive]}>{en ? 'Popular' : 'Popüler'}</Text></Pressable>
        {genres.map((item) => <Pressable key={item.en} onPress={() => setGenre(item)} style={[styles.genre, genre?.en === item.en && styles.genreActive]}><Text style={[styles.genreText, genre?.en === item.en && styles.genreTextActive]}>{en ? item.en : item.tr}</Text></Pressable>)}
      </ScrollView>}
    </>}

    {activeQuery.isLoading || activeQuery.isFetching ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : activeQuery.isError ? <Text style={styles.empty}>{en ? 'Content could not be loaded.' : 'İçerikler yüklenemedi.'}</Text> : <FlatList scrollEnabled={false} data={data} keyExtractor={(item) => `${item.type}-${item.id}`} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={styles.grid} renderItem={({ item }) => <MediaCard media={item} width={158} />} ListEmptyComponent={<Text style={styles.empty}>{en ? 'No results found.' : 'Sonuç bulunamadı.'}</Text>} />}
  </Screen>;
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg }, kicker: { color: colors.primary, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' }, title: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.2, marginTop: 3 }, search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, height: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: spacing.lg }, input: { color: colors.text, flex: 1, fontSize: 15 },
  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm }, typeFilter: { height: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 15, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, filterActive: { backgroundColor: colors.primary, borderColor: colors.primary }, filterText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, filterTextActive: { color: '#fff' },
  genres: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 7 }, genre: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.elevated }, genreActive: { backgroundColor: colors.text }, genreText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, genreTextActive: { color: colors.background },
  loader: { marginTop: spacing.xl }, grid: { paddingHorizontal: spacing.lg }, row: { justifyContent: 'space-between', marginBottom: spacing.lg }, empty: { color: colors.muted, textAlign: 'center', marginTop: 80 },
});
