import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { LibraryStatus, MediaType, mediaKey } from '@/domain/media';
import { filterLibrary, libraryCsv, LibraryFilter, LibrarySort } from '@/features/library/library-tools';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { t } from '@/i18n/strings';

export default function LibraryScreen() {
  const [filter, setFilter] = useState<LibraryFilter>('watching');
  const [type, setType] = useState<'all' | MediaType>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibrarySort>('recent');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const language = useProfileStore((state) => state.language);
  const en = language === 'en';
  const favorites = useProfileStore((state) => state.favorites);
  const allItems = useLibraryStore((state) => state.items);
  const { width } = useWindowDimensions();
  const columns = Math.min(4, Math.max(2, Math.floor((width - 48) / 158)));
  const cardWidth = (width - 48 - (columns - 1) * 12) / columns;
  const items = filterLibrary(allItems, favorites, { status: filter, type, query, sort, language });
  const filters: { value: LibraryFilter; label: string }[] = [
    { value: 'all', label: t(language, 'allTitles') }, { value: 'favorites', label: en ? 'Favorites' : 'Favorilerim' },
    { value: 'watching', label: en ? 'Watching' : 'İzliyorum' }, { value: 'watchlist', label: en ? 'Watchlist' : 'İzleyeceğim' },
    { value: 'completed', label: en ? 'Completed' : 'Tamamlandı' }, { value: 'dropped', label: en ? 'Dropped' : 'Bıraktım' },
  ];
  const bulk = (status: LibraryStatus) => { for (const item of allItems.filter((entry) => selected.includes(mediaKey(entry.media)))) useLibraryStore.getState().upsert(item.media, status); setSelected([]); setSelecting(false); };
  const header = <>
    <View style={styles.header}><Text style={styles.kicker}>{en ? 'PERSONAL ARCHIVE' : 'KİŞİSEL ARŞİV'}</Text><Text style={styles.title}>{en ? 'My library' : 'Listem'}</Text><Text style={styles.summary}>{allItems.length} {en ? 'titles' : 'yapım'}</Text>
      <View style={styles.search}><Ionicons name="search" size={20} color={colors.muted} /><TextInput accessibilityLabel={t(language, 'librarySearch')} value={query} onChangeText={setQuery} placeholder={t(language, 'librarySearch')} placeholderTextColor={colors.muted} style={styles.input} /></View>
      <View style={styles.actions}><Pressable onPress={() => { setSelecting(!selecting); setSelected([]); }} style={styles.action}><Text style={styles.actionText}>{selecting ? t(language, 'cancel') : (en ? 'Select titles' : 'Yapım seç')}</Text></Pressable><Pressable onPress={() => { void Share.share({ title: t(language, 'exportTitle'), message: libraryCsv(allItems) }); }} style={styles.action}><Text style={styles.actionText}>{t(language, 'exportLibrary')}</Text></Pressable></View>
      <Pressable onPress={() => router.push('/shared-lists' as Href)} style={styles.shared}><Ionicons name="people-outline" size={19} color={colors.primary} /><Text style={styles.actionText}>{en ? 'Shared watchlists' : 'Ortak izleme listeleri'}</Text><Ionicons name="chevron-forward" size={17} color={colors.muted} /></Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map((item) => <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: filter === item.value }} onPress={() => setFilter(item.value)} style={[styles.filter, filter === item.value && styles.active]}><Text style={[styles.filterText, filter === item.value && styles.activeText]}>{item.label}</Text></Pressable>)}</ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{(['all', 'movie', 'tv'] as const).map((value) => <Pressable key={value} onPress={() => setType(value)} style={[styles.filter, type === value && styles.active]}><Text style={[styles.filterText, type === value && styles.activeText]}>{value === 'all' ? t(language, 'all') : value === 'movie' ? (en ? 'Movies' : 'Filmler') : (en ? 'Shows' : 'Diziler')}</Text></Pressable>)}</ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{(['recent', 'title', 'rating', 'year'] as const).map((value) => <Pressable key={value} onPress={() => setSort(value)} style={[styles.filter, sort === value && styles.active]}><Text style={[styles.filterText, sort === value && styles.activeText]}>{t(language, ({ recent: 'recentlyUpdated', title: 'alphabetical', rating: 'ratingSort', year: 'yearSort' } as const)[value])}</Text></Pressable>)}</ScrollView>
    {selecting && <View style={styles.bulk}><Text style={styles.summary}>{selected.length} {en ? 'selected' : 'seçildi'}</Text><View style={styles.actions}>{(['watchlist', 'watching', 'dropped'] as const).map((status) => <Pressable key={status} disabled={!selected.length} onPress={() => bulk(status)} style={styles.action}><Text style={styles.actionText}>{filters.find((item) => item.value === status)!.label}</Text></Pressable>)}</View></View>}
  </>;
  return <Screen scroll={false}><FlatList keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" key={columns} numColumns={columns} data={items} keyExtractor={(item) => mediaKey(item.media)} ListHeaderComponent={header} contentContainerStyle={styles.list} columnWrapperStyle={styles.row} renderItem={({ item }) => <View style={{ width: cardWidth, marginBottom: spacing.lg }}>{selecting && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(mediaKey(item.media)) }} accessibilityLabel={item.media.title} onPress={() => { const key = mediaKey(item.media); setSelected((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]); }} style={styles.select}><Ionicons name={selected.includes(mediaKey(item.media)) ? 'checkbox' : 'square-outline'} size={28} color={colors.primary} /></Pressable>}<MediaCard media={item.media} width={cardWidth} inGrid />{item.progress && <><View style={styles.progressTrack}><View style={[styles.progress, { width: String(Math.min(100, item.progress.watched / Math.max(1, item.progress.total) * 100)) + '%' as `${number}%` }]} /></View><Text style={styles.summary}>{item.progress.watched}/{item.progress.total} {en ? 'episodes watched' : 'bölüm izlendi'}</Text></>}</View>} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>{query || allItems.length ? t(language, 'noLibraryResults') : (en ? 'Your library starts here' : 'Listen burada başlıyor')}</Text><Pressable onPress={() => router.push('/discover' as Href)} style={styles.action}><Text style={styles.actionText}>{t(language, 'findTitle')}</Text></Pressable></View>} /></Screen>;
}
const styles = StyleSheet.create({ header: { padding: spacing.lg }, kicker: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1 }, title: { color: colors.text, fontSize: 36, fontWeight: '900', marginTop: 4 }, summary: { color: colors.muted, fontSize: 12, marginTop: 6 }, search: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface }, input: { flex: 1, minHeight: 50, color: colors.text, fontSize: 15 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.sm }, action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.elevated }, actionText: { color: colors.text, fontSize: 13, fontWeight: '700' }, shared: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md }, filters: { gap: 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }, filter: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.surface }, active: { backgroundColor: colors.text }, filterText: { color: colors.muted, fontWeight: '700', fontSize: 12 }, activeText: { color: colors.background }, row: { paddingHorizontal: spacing.lg, justifyContent: 'space-between' }, list: { paddingBottom: 120 }, progressTrack: { marginTop: 8, height: 4, borderRadius: 2, backgroundColor: colors.elevated, overflow: 'hidden' }, progress: { height: 4, backgroundColor: colors.primary }, empty: { padding: spacing.xl, alignItems: 'center', gap: spacing.md }, emptyTitle: { color: colors.text, fontSize: 17, textAlign: 'center' }, bulk: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md }, select: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' } });
