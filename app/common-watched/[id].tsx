import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChoicePicker } from '@/components/ChoicePicker';
import { MediaCard } from '@/components/MediaCard';
import { Screen } from '@/components/Screen';
import { mediaKey, type MediaType } from '@/domain/media';
import { useAuth } from '@/features/auth/AuthProvider';
import { commonWatched } from '@/features/friends/common-watched';
import { fetchFriendActivity } from '@/features/friends/friends-repository';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';

export default function CommonWatchedScreen() {
  const language = useProfileStore(state => state.language);
  const en = language === 'en';
  const { user } = useAuth();
  const userId = user?.id;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const ownLibrary = useLibraryStore(state => state.items);
  const [type, setType] = useState<'all' | MediaType>('all');
  const [search, setSearch] = useState('');
  const { width } = useWindowDimensions();
  const columns = Math.min(4, Math.max(2, Math.floor((width - 48) / 158)));
  const cardWidth = (width - 48 - (columns - 1) * 12) / columns;
  const query = useQuery({ queryKey: ['friend-profile', userId, id], queryFn: () => fetchFriendActivity(userId!, id!), enabled: Boolean(userId && id), staleTime: 30_000 });
  const { refetch } = query;
  useFocusEffect(useCallback(() => { if (userId && id) void refetch(); }, [userId, id, refetch]));
  const common = useMemo(() => query.data?.historyVisible ? commonWatched(ownLibrary, query.data.library) : [], [ownLibrary, query.data]);
  const needle = search.trim().toLocaleLowerCase(language);
  const visible = common.filter(media => (type === 'all' || media.type === type) && media.title.toLocaleLowerCase(language).includes(needle)).sort((a, b) => a.title.localeCompare(b.title, language));
  const title = en ? 'Watched in common' : 'Ortak izlediklerimiz';
  const back = <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Go back' : 'Geri dön'} onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable>;

  if (query.isLoading) return <Screen><View style={styles.navigation}>{back}</View><ActivityIndicator accessibilityLabel={en ? 'Loading common titles' : 'Ortak izledikleriniz yükleniyor'} color={colors.primary} style={styles.state} /></Screen>;
  if (!user || !id || query.isError || !query.data) return <Screen><View style={styles.navigation}>{back}</View><View style={styles.state}><Text style={styles.message}>{en ? 'Could not load common titles.' : 'Ortak izledikleriniz yüklenemedi.'}</Text>{user && id && <Pressable accessibilityRole="button" onPress={() => refetch()} style={styles.retry}><Text style={styles.link}>{en ? 'Try again' : 'Tekrar dene'}</Text></Pressable>}</View></Screen>;
  if (!query.data.historyVisible) return <Screen><View style={styles.navigation}>{back}</View><View style={styles.state}><Ionicons name="lock-closed-outline" size={30} color={colors.muted} /><Text style={styles.message}>{en ? 'This viewing history is private.' : 'Bu izleme geçmişi gizli.'}</Text></View></Screen>;

  const profile = query.data.profile;
  const name = `${profile.firstName} ${profile.lastName}`.trim() || (profile.username ? `@${profile.username}` : (en ? 'Your friend' : 'Arkadaşın'));
  const header = <View style={styles.header}>{back}<Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{en ? `You & ${name}` : `${name} ile`}</Text><Text style={styles.count}>{common.length} {en ? `${common.length === 1 ? 'title' : 'titles'} you have both watched` : 'ortak izlediğiniz yapım'}</Text>
    {!!common.length && <><View style={styles.search}><Ionicons name="search" size={19} color={colors.muted} /><TextInput accessibilityLabel={en ? 'Search common titles' : 'Ortak izlediklerinde ara'} placeholder={en ? 'Search common titles…' : 'Ortak izlediklerinde ara…'} placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.input} autoCorrect={false} /></View>
      <View style={styles.filters}><ChoicePicker label={en ? 'Content' : 'İçerik'} value={type} onChange={setType} closeLabel={en ? 'Close' : 'Kapat'} options={[{ value: 'all', label: en ? 'Movies & shows' : 'Filmler ve diziler' }, { value: 'movie', label: en ? 'Movies' : 'Filmler' }, { value: 'tv', label: en ? 'Shows' : 'Diziler' }]} /></View></>}
  </View>;
  return <Screen scroll={false}><FlatList key={columns} data={visible} keyExtractor={mediaKey} numColumns={columns} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" ListHeaderComponent={header} contentContainerStyle={styles.list} columnWrapperStyle={styles.row} renderItem={({item}) => <MediaCard media={item} width={cardWidth} inGrid />} refreshing={query.isRefetching} onRefresh={() => { void refetch(); }} ListEmptyComponent={<Text style={styles.message}>{common.length ? (en ? 'No titles match these filters.' : 'Bu filtrelerle eşleşen yapım yok.') : (en ? 'You have no watched titles in common yet.' : 'Henüz ortak izlediğiniz bir yapım yok.')}</Text>} /></Screen>;
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg }, navigation: { paddingHorizontal: spacing.lg }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, marginTop: spacing.md, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' }, subtitle: { color: colors.text, fontSize: 15, marginTop: spacing.sm }, count: { color: colors.muted, fontSize: 12, marginTop: 5 },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.sm, marginTop: spacing.lg }, input: { flex: 1, minHeight: 46, color: colors.text, fontSize: 14 }, filters: { flexDirection: 'row', marginTop: spacing.sm },
  list: { paddingBottom: 120 }, row: { paddingHorizontal: spacing.lg, justifyContent: 'space-between', marginBottom: spacing.lg }, state: { marginTop: 80, alignItems: 'center' }, message: { padding: spacing.lg, color: colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 21 }, retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md }, link: { color: colors.primary },
});
