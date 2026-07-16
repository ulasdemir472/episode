import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { CommunityPanel } from '@/components/CommunityPanel';
import { EpisodeDetails, Media } from '@/domain/media';
import { catalogService } from '@/services/tmdb';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { MotionPressable } from '@/components/MotionPressable';
import { useAuth } from '@/features/auth/AuthProvider';
import { ScrollFocusTarget } from '@/features/onboarding/ScrollFocusTarget';

function parseMedia(data?: string): Media | undefined {
  if (!data) return undefined;
  try {
    const parsed = JSON.parse(data) as Partial<Media>;
    if (typeof parsed.id !== 'number' || (parsed.type !== 'movie' && parsed.type !== 'tv') || typeof parsed.title !== 'string') return undefined;
    return {
      id: parsed.id,
      type: parsed.type,
      title: parsed.title,
      overview: typeof parsed.overview === 'string' ? parsed.overview : '',
      posterUrl: typeof parsed.posterUrl === 'string' ? parsed.posterUrl : '',
      backdropUrl: typeof parsed.backdropUrl === 'string' ? parsed.backdropUrl : '',
      year: typeof parsed.year === 'string' ? parsed.year : '',
      rating: typeof parsed.rating === 'number' ? parsed.rating : 0,
      genres: Array.isArray(parsed.genres) ? parsed.genres.filter((genre): genre is string => typeof genre === 'string') : [],
    };
  } catch {
    return undefined;
  }
}

export default function MediaDetailScreen() {
  const params = useLocalSearchParams<{ data?: string; tutorialTarget?: string }>();
  const auth = useAuth();
  const media = useMemo(() => parseMedia(params.data), [params.data]);
  const [season, setSeason] = useState<number>();
  const [socialEpisode, setSocialEpisode] = useState<EpisodeDetails>();
  const items = useLibraryStore((state) => state.items);
  const watchedEpisodes = useLibraryStore((state) => state.watchedEpisodes);
  const upsert = useLibraryStore((state) => state.upsert);
  const remove = useLibraryStore((state) => state.remove);
  const toggleEpisode = useLibraryStore((state) => state.toggleEpisode);
  const markThrough = useLibraryStore((state) => state.markThrough);
  const recordEpisodeRuntimes = useLibraryStore((state) => state.recordEpisodeRuntimes);
  const favorites = useProfileStore((state) => state.favorites);
  const toggleFavorite = useProfileStore((state) => state.toggleFavorite);
  const saved = media ? items.some((item) => item.media.id === media.id) : false;
  const favorite = media ? favorites.some((item) => item.id === media.id) : false;
  const currentStatus = media ? items.find((item) => item.media.id === media.id)?.status : undefined;
  const hasWatchedEpisode = useMemo(() => media ? Object.keys(watchedEpisodes).some((key) => key.startsWith(`${media.id}:`)) : false, [media, watchedEpisodes]);

  const seriesQuery = useQuery({
    queryKey: ['series', media?.id], queryFn: () => catalogService.seriesDetails(media!.id),
    enabled: media?.type === 'tv',
  });
  const activeSeason = season ?? seriesQuery.data?.seasons[0]?.number;

  const episodesQuery = useQuery({
    queryKey: ['episodes', media?.id, activeSeason],
    queryFn: () => catalogService.seasonEpisodes(media!.id, activeSeason!),
    enabled: media?.type === 'tv' && Boolean(activeSeason),
  });
  const imdbTitleQuery = useQuery({
    queryKey: ['imdb-title', media?.type, media?.id], queryFn: () => catalogService.imdbTitleRating(media!),
    enabled: Boolean(media), staleTime: 7 * 24 * 60 * 60_000,
  });
  const imdbEpisodesQuery = useQuery({
    queryKey: ['imdb-episodes', media?.id, activeSeason],
    queryFn: () => catalogService.imdbEpisodeRatings(media!.title, activeSeason!, episodesQuery.data!),
    enabled: Boolean(media && activeSeason && episodesQuery.data?.length),
    staleTime: 24 * 60 * 60_000,
  });

  useEffect(() => {
    if (!media || media.type !== 'tv') return;
    const runtimes = Object.fromEntries((episodesQuery.data ?? []).flatMap((episode) => episode.runtime && episode.runtime > 0
      ? [[`${media.id}:${episode.seasonNumber}:${episode.number}`, episode.runtime]]
      : []));
    recordEpisodeRuntimes(media.id, runtimes, seriesQuery.data?.episodeRunTime);
  }, [episodesQuery.data, media, recordEpisodeRuntimes, seriesQuery.data?.episodeRunTime, watchedEpisodes]);

  if (!media) return null;
  const requireUser = () => {
    if (auth.user) return true;
    router.push('/auth' as Href);
    return false;
  };
  const toggleSaved = () => {
    if (!requireUser()) return;
    Haptics.selectionAsync();
    if (saved) remove(media.id); else upsert(media, 'watchlist');
  };
  const markTitleWatched = () => {
    if (!requireUser()) return;
    Haptics.selectionAsync();
    if (media.type === 'movie') {
      upsert(media, currentStatus === 'completed' ? 'watchlist' : 'completed');
      return;
    }
    const lastSeason = seasons[seasons.length - 1];
    if (!lastSeason) return;
    Alert.alert('Dizinin tümünü izledin mi?', `${media.title} dizisinin ${totalEpisodes} bölümünün tamamı izlendi olarak işaretlenecek.`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Tümünü izledim', onPress: () => markThrough(media, lastSeason.number, lastSeason.episodeCount, seasons, seriesQuery.data?.episodeRunTime) },
    ]);
  };
  const watchedCount = episodesQuery.data?.filter((episode) => watchedEpisodes[`${media.id}:${episode.seasonNumber}:${episode.number}`]).length ?? 0;
  const seasons = seriesQuery.data?.seasons ?? [];
  const totalEpisodes = seasons.reduce((sum, item) => sum + item.episodeCount, 0);
  const handleEpisodePress = (episodeSeason: number, episodeNumber: number) => {
    if (!requireUser()) return;
    const key = `${media.id}:${episodeSeason}:${episodeNumber}`;
    const runtimeMinutes = episodesQuery.data?.find((episode) => episode.seasonNumber === episodeSeason && episode.number === episodeNumber)?.runtime ?? seriesQuery.data?.episodeRunTime;
    if (watchedEpisodes[key]) {
      toggleEpisode(media, episodeSeason, episodeNumber, seasons, runtimeMinutes);
      return;
    }
    let missingBefore = 0;
    for (const item of seasons) {
      if (item.number > episodeSeason) continue;
      const last = item.number === episodeSeason ? episodeNumber - 1 : item.episodeCount;
      for (let number = 1; number <= last; number += 1) {
        if (!watchedEpisodes[`${media.id}:${item.number}:${number}`]) missingBefore += 1;
      }
    }
    if (missingBefore === 0) {
      toggleEpisode(media, episodeSeason, episodeNumber, seasons, runtimeMinutes);
      return;
    }
    Alert.alert('Önceki bölümler izlenmemiş', `Bu bölümden önce izlenmemiş ${missingBefore} bölüm var. Buraya kadar hepsini izlendi olarak işaretleyelim mi?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sadece bu bölüm', onPress: () => toggleEpisode(media, episodeSeason, episodeNumber, seasons, runtimeMinutes) },
      { text: 'Buraya kadar hepsi', onPress: () => markThrough(media, episodeSeason, episodeNumber, seasons, seriesQuery.data?.episodeRunTime) },
    ]);
  };

  return <Screen>
    <ImageBackground source={{ uri: media.backdropUrl }} style={styles.hero}>
      <LinearGradient colors={['rgba(7,7,10,.1)', colors.background]} style={StyleSheet.absoluteFill} />
      <Pressable accessibilityLabel="Geri" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" color="#fff" size={24} /></Pressable>
      <Pressable accessibilityLabel={favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'} onPress={() => { if (!requireUser()) return; Haptics.selectionAsync(); toggleFavorite(media); }} style={styles.favorite}><Ionicons name={favorite ? 'heart' : 'heart-outline'} color={favorite ? colors.primary : '#fff'} size={23} /></Pressable>
    </ImageBackground>
    <View style={styles.body}>
      <Text style={styles.type}>{media.type === 'tv' ? 'DİZİ' : 'FİLM'} · {media.year}</Text>
      <Text style={styles.title}>{media.title}</Text>
      <View style={styles.meta}>
        <View style={styles.score}><Ionicons name="star" color={colors.warning} size={15} /><Text style={styles.rating}>{media.rating} TMDB</Text></View>
        {imdbTitleQuery.data && <View style={styles.imdbBadge}><Text style={styles.imdbLabel}>IMDb</Text><Text style={styles.imdbValue}>{imdbTitleQuery.data}</Text></View>}
      </View>
      {media.genres.length > 0 && <Text style={styles.genres}>{media.genres.join('  ·  ')}</Text>}
      <Text style={styles.overview}>{media.overview}</Text>
      <MotionPressable style={[styles.action, saved && styles.saved]} onPress={toggleSaved}><Ionicons name={saved ? 'checkmark' : 'add'} size={21} color="#fff" /><Text style={styles.actionText}>{saved ? 'Listemde' : 'Listeme ekle'}</Text></MotionPressable>
      <MotionPressable disabled={media.type === 'tv' && seasons.length === 0} style={[styles.watchedAction, currentStatus === 'completed' && styles.watchedActive, media.type === 'tv' && seasons.length === 0 && styles.disabled]} onPress={markTitleWatched}><Ionicons name={currentStatus === 'completed' ? 'checkmark-circle' : 'checkmark-circle-outline'} size={21} color={currentStatus === 'completed' ? '#fff' : colors.text} /><Text style={styles.watchedText}>{currentStatus === 'completed' ? (media.type === 'movie' ? 'İzlendi · Geri al' : 'İzlendi') : media.type === 'movie' ? 'İzledim' : 'Tümünü izledim'}</Text></MotionPressable>
      {media.type === 'tv' && saved && currentStatus !== 'completed' && <MotionPressable style={styles.dropAction} onPress={() => { if (requireUser()) upsert(media, currentStatus === 'dropped' ? 'watching' : 'dropped'); }}><Ionicons name={currentStatus === 'dropped' ? 'play-outline' : 'stop-circle-outline'} size={18} color={currentStatus === 'dropped' ? colors.success : colors.muted} /><Text style={[styles.dropText, currentStatus === 'dropped' && styles.resumeText]}>{currentStatus === 'dropped' ? 'İzlemeye devam et' : 'İzlemeyi bıraktım'}</Text></MotionPressable>}

      {media.type === 'tv' && <>
        <View style={styles.rule} />
        <View style={styles.sectionRow}><View><Text style={styles.section}>Bölümler</Text>{activeSeason && <Text style={styles.progressText}>{watchedCount}/{episodesQuery.data?.length ?? 0} izlendi</Text>}</View></View>
        {seriesQuery.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> :
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasons}>
            {seriesQuery.data?.seasons.map((item) => <MotionPressable key={item.id} onPress={() => setSeason(item.number)} style={[styles.season, activeSeason === item.number && styles.seasonActive]}><Text style={[styles.seasonText, activeSeason === item.number && styles.seasonTextActive]}>{item.number}. Sezon</Text><Text style={[styles.seasonCount, activeSeason === item.number && styles.seasonTextActive]}>{item.episodeCount} bölüm</Text></MotionPressable>)}
          </ScrollView>}
        {episodesQuery.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : episodesQuery.isError ? <Text style={styles.error}>Bölümler yüklenemedi. API anahtarını ve bağlantını kontrol et.</Text> :
          <View style={styles.episodes}>{episodesQuery.data?.map((episode) => {
            const key = `${media.id}:${episode.seasonNumber}:${episode.number}`;
            const watched = Boolean(watchedEpisodes[key]);
            const imdb = imdbEpisodesQuery.data?.[episode.number];
            return <View key={episode.id} style={[styles.episode, watched && styles.episodeWatched]}>
              {episode.stillUrl ? <Image source={{ uri: episode.stillUrl }} style={styles.still} /> : <View style={[styles.still, styles.stillFallback]}><Ionicons name="film-outline" size={24} color={colors.muted} /></View>}
              <View style={styles.episodeInfo}><Text style={styles.episodeNo}>BÖLÜM {episode.number}</Text><Text style={styles.episodeTitle} numberOfLines={2}>{episode.title}</Text><View style={styles.episodeMeta}><Text style={styles.episodeMetaText}>{episode.runtime ? `${episode.runtime} dk` : episode.airDate?.slice(0, 4)}</Text><Ionicons name="star" color={colors.warning} size={11} /><Text style={styles.episodeMetaText}>{episode.tmdbRating} TMDB</Text>{imdb && <Text style={styles.miniImdb}>IMDb {imdb}</Text>}</View></View>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: watched }} accessibilityLabel={`${episode.number}. bölümü izlendi işaretle`} onPress={() => { Haptics.selectionAsync(); handleEpisodePress(episode.seasonNumber, episode.number); }} style={[styles.check, watched && styles.checkActive]}><Ionicons name="checkmark" size={20} color={watched ? '#fff' : colors.muted} /></Pressable>
            </View>;
          })}</View>}
        {!!episodesQuery.data?.length && <View style={styles.discussionPicker}>
          <Text style={styles.discussionLabel}>Bölüm yorumu seç</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discussionChips}>
            {episodesQuery.data.map((episode) => <MotionPressable key={`discussion-${episode.id}`} onPress={() => setSocialEpisode(episode)} style={[styles.discussionChip, socialEpisode?.id === episode.id && styles.discussionChipActive]}><Ionicons name="chatbubble-outline" size={13} color={socialEpisode?.id === episode.id ? '#fff' : colors.muted} /><Text style={[styles.discussionChipText, socialEpisode?.id === episode.id && styles.discussionChipTextActive]}>B{episode.number}</Text></MotionPressable>)}
          </ScrollView>
        </View>}
        {socialEpisode && <CommunityPanel targetKey={`episode:${media.id}:${socialEpisode.seasonNumber}:${socialEpisode.number}`} title={`S${socialEpisode.seasonNumber} B${socialEpisode.number} · Puanlar ve yorumlar`} canReview={Boolean(watchedEpisodes[`${media.id}:${socialEpisode.seasonNumber}:${socialEpisode.number}`])} />}
      </>}
      <ScrollFocusTarget active={params.tutorialTarget === 'comments'}>
        <CommunityPanel targetKey={`media:${media.type}:${media.id}`} canReview={media.type === 'movie' ? currentStatus === 'completed' : currentStatus === 'completed' || hasWatchedEpisode} />
      </ScrollFocusTarget>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  hero: { height: 330 }, back: { position: 'absolute', top: spacing.md, left: spacing.md, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' }, favorite: { position: 'absolute', top: spacing.md, right: spacing.md, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, marginTop: -45 }, type: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 38, lineHeight: 42, fontWeight: '900', letterSpacing: -1.3, marginTop: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }, score: { flexDirection: 'row', alignItems: 'center', gap: 5 }, rating: { color: colors.text, fontWeight: '800', fontSize: 12 }, imdbBadge: { flexDirection: 'row', borderRadius: 5, overflow: 'hidden' }, imdbLabel: { backgroundColor: '#F5C518', color: '#000', fontSize: 11, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 3 }, imdbValue: { backgroundColor: colors.elevated, color: colors.text, fontSize: 11, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3 },
  genres: { color: colors.muted, fontSize: 12, marginTop: spacing.sm }, overview: { color: '#C1BFC4', lineHeight: 23, fontSize: 14, marginTop: spacing.lg }, action: { marginTop: spacing.lg, height: 52, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, saved: { backgroundColor: colors.success }, actionText: { color: '#fff', fontWeight: '900' }, watchedAction: { marginTop: spacing.sm, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, watchedActive: { backgroundColor: colors.secondary, borderColor: colors.secondary }, watchedText: { color: colors.text, fontWeight: '800' }, disabled: { opacity: 0.45 }, dropAction: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.md }, dropText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, resumeText: { color: colors.success },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xl }, sectionRow: { flexDirection: 'row', justifyContent: 'space-between' }, section: { color: colors.text, fontSize: 22, fontWeight: '900' }, progressText: { color: colors.success, fontSize: 11, fontWeight: '700', marginTop: 4 }, loader: { marginVertical: spacing.xl }, seasons: { gap: spacing.sm, paddingVertical: spacing.lg }, season: { minWidth: 105, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, seasonActive: { backgroundColor: colors.primary, borderColor: colors.primary }, seasonText: { color: colors.text, fontWeight: '800', fontSize: 13 }, seasonTextActive: { color: '#fff' }, seasonCount: { color: colors.muted, fontSize: 10, marginTop: 3 },
  episodes: { gap: spacing.sm }, episode: { flexDirection: 'row', alignItems: 'center', minHeight: 92, padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, episodeWatched: { borderColor: 'rgba(101,214,166,.35)' }, still: { width: 92, height: 62, borderRadius: radius.sm, backgroundColor: colors.elevated }, stillFallback: { alignItems: 'center', justifyContent: 'center' }, episodeInfo: { flex: 1, paddingHorizontal: spacing.sm }, episodeNo: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, episodeTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 3 }, episodeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 }, episodeMetaText: { color: colors.muted, fontSize: 9 }, miniImdb: { color: '#F5C518', fontSize: 9, fontWeight: '800', marginLeft: 3 }, check: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, checkActive: { backgroundColor: colors.success, borderColor: colors.success }, discussionPicker: { marginTop: spacing.lg }, discussionLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' }, discussionChips: { gap: 7, paddingTop: spacing.sm }, discussionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 34, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, discussionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, discussionChipText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, discussionChipTextActive: { color: '#fff' }, error: { color: colors.primary, lineHeight: 20, marginVertical: spacing.lg },
});
