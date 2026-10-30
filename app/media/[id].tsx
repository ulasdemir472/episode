import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { CommunityPanel } from '@/components/CommunityPanel';
import { EpisodeDetails, LibraryItem, LibraryStatus, sameMedia } from '@/domain/media';
import { mediaIdentity, parseMediaSnapshot } from '@/features/catalog/media-route';
import { t } from '@/i18n/strings';
import { catalogService, translateGenre } from '@/services/tmdb';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { MotionPressable } from '@/components/MotionPressable';
import { MediaCard } from '@/components/MediaCard';
import { PeopleCredits } from '@/components/PeopleCredits';
import { useAuth } from '@/features/auth/AuthProvider';
import { ScrollFocusTarget } from '@/features/onboarding/ScrollFocusTarget';

const EpisodeRow = memo(function EpisodeRow({ episode, imdb, watched, onToggle, en }: {
  episode: EpisodeDetails;
  imdb?: string;
  watched: boolean;
  onToggle: (season: number, episode: number) => void;
  en: boolean;
}) {
  return <View style={[styles.episode, watched && styles.episodeWatched]}>
    {episode.stillUrl ? <Image source={{ uri: episode.stillUrl }} style={styles.still} /> : <View style={[styles.still, styles.stillFallback]}><Ionicons name="film-outline" size={24} color={colors.muted} /></View>}
    <View style={styles.episodeInfo}><Text style={styles.episodeNo}>{en ? `EPISODE ${episode.number}` : `BÖLÜM ${episode.number}`}</Text><Text style={styles.episodeTitle} numberOfLines={2}>{episode.title}</Text><View style={styles.episodeMeta}><Text style={styles.episodeMetaText}>{episode.runtime ? `${episode.runtime} ${en ? 'min' : 'dk'}` : episode.airDate?.slice(0, 4)}</Text><Ionicons name="star" color={colors.warning} size={11} /><Text style={styles.episodeMetaText}>{episode.tmdbRating} TMDB</Text>{imdb && <Text style={styles.miniImdb}>IMDb {imdb}</Text>}</View></View>
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: watched }}
      accessibilityLabel={en ? `Mark episode ${episode.number} as watched` : `${episode.number}. bölümü izlendi işaretle`}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync();
        onToggle(episode.seasonNumber, episode.number);
      }}
      style={[styles.check, watched && styles.checkActive]}
    >
      <Ionicons name="checkmark" size={20} color={watched ? '#fff' : colors.muted} />
    </Pressable>
  </View>;
});

export default function MediaDetailScreen() {
  const en = useProfileStore((state) => state.language) === 'en';
  const language = useProfileStore((state) => state.language);
  const params = useLocalSearchParams<{ id?: string; type?: string; data?: string; tutorialTarget?: string; season?: string; episode?: string; targetKey?: string }>();
  const auth = useAuth();
  const identity = mediaIdentity(params);
  const seed = useMemo(() => parseMediaSnapshot(params.data), [params.data]);
  const mediaQuery = useQuery({ queryKey: ['media-details', identity?.type, identity?.id, language], queryFn: () => catalogService.mediaDetails(identity!.type, identity!.id, language), enabled: Boolean(identity), placeholderData: seed && identity && sameMedia(seed, identity) ? seed : undefined });
  const media = mediaQuery.data;
  const [region, setRegion] = useState('TR');
  const [statusOpen, setStatusOpen] = useState(false);
  const [removedItem, setRemovedItem] = useState<LibraryItem>();
  const extras = useQuery({ queryKey: ['title-extras', identity?.type, identity?.id, region, language], queryFn: () => catalogService.titleExtras(media!, region, language), enabled: Boolean(media) });
  const [season, setSeason] = useState<number>();
  const [selectedEpisode, setSocialEpisode] = useState<EpisodeDetails>();
  const items = useLibraryStore((state) => state.items);
  const watchedEpisodes = useLibraryStore((state) => state.watchedEpisodes);
  const upsert = useLibraryStore((state) => state.upsert);
  const remove = useLibraryStore((state) => state.remove);
  const toggleEpisode = useLibraryStore((state) => state.toggleEpisode);
  const markThrough = useLibraryStore((state) => state.markThrough);
  const recordEpisodeRuntimes = useLibraryStore((state) => state.recordEpisodeRuntimes);
  const favorites = useProfileStore((state) => state.favorites);
  const toggleFavorite = useProfileStore((state) => state.toggleFavorite);
  const saved = media ? items.some((item) => sameMedia(item.media, media)) : false;
  const favorite = media ? favorites.some((item) => sameMedia(item, media)) : false;
  const currentStatus = media ? items.find((item) => sameMedia(item.media, media))?.status : undefined;
  const hasWatchedEpisode = useMemo(() => media ? Object.keys(watchedEpisodes).some((key) => key.startsWith(`${media.id}:`)) : false, [media, watchedEpisodes]);

  const seriesQuery = useQuery({
    queryKey: ['series', media?.id, language],
    queryFn: () => catalogService.seriesDetails(media!.id, language),
    enabled: media?.type === 'tv',
  });
  const activeSeason = season ?? (Number(params.season) || undefined) ?? items.find((item) => media && sameMedia(item.media, media))?.progress?.nextEpisode?.season ?? seriesQuery.data?.seasons[0]?.number;

  const episodesQuery = useQuery({
    queryKey: ['episodes', media?.id, activeSeason, language],
    queryFn: () => catalogService.seasonEpisodes(media!.id, activeSeason!, language),
    enabled: media?.type === 'tv' && Boolean(activeSeason),
  });
  const socialEpisode = selectedEpisode?.seasonNumber === activeSeason ? selectedEpisode : episodesQuery.data?.find((episode) => episode.number === Number(params.episode) && episode.seasonNumber === Number(params.season));
  const movieDetailsQuery = mediaQuery;
  const imdbTitleQuery = useQuery({
    queryKey: ['imdb-title', media?.type, media?.id], queryFn: async () => await catalogService.imdbTitleRating(media!) ?? null,
    enabled: Boolean(media), staleTime: 7 * 24 * 60 * 60_000,
  });
  const imdbEpisodesQuery = useQuery({
    queryKey: ['imdb-episodes', media?.id, activeSeason],
    queryFn: () => catalogService.imdbEpisodeRatings(media!.title, activeSeason!, episodesQuery.data!),
    enabled: Boolean(media && activeSeason && episodesQuery.data?.length),
    staleTime: 24 * 60 * 60_000,
  });
  const recommendationsQuery = useQuery({
    queryKey: ['recommendations', media?.type, media?.id, language],
    queryFn: () => catalogService.recommendations(media!, language),
    enabled: Boolean(media),
    staleTime: 6 * 60 * 60_000,
  });
  const seasons = useMemo(() => seriesQuery.data?.seasons ?? [], [seriesQuery.data?.seasons]);
  const totalEpisodes = seasons.reduce((sum, item) => sum + item.episodeCount, 0);

  useEffect(() => {
    if (media?.runtimeMinutes) useLibraryStore.getState().recordTitleRuntime(media, media.runtimeMinutes);
  }, [media]);


  useEffect(() => {
    if (!media || media.type !== 'tv') return;
    const runtimes = Object.fromEntries((episodesQuery.data ?? []).flatMap((episode) => episode.runtime && episode.runtime > 0
      ? [[`${media.id}:${episode.seasonNumber}:${episode.number}`, episode.runtime]]
      : []));
    recordEpisodeRuntimes(media.id, runtimes, seriesQuery.data?.episodeRunTime);
  }, [episodesQuery.data, media, recordEpisodeRuntimes, seriesQuery.data?.episodeRunTime, watchedEpisodes]);

  const handleEpisodePress = useCallback((episodeSeason: number, episodeNumber: number) => {
    if (!media) return;
    if (!auth.user) {
      router.push('/auth' as Href);
      return;
    }
    const currentWatchedEpisodes = useLibraryStore.getState().watchedEpisodes;
    const key = `${media.id}:${episodeSeason}:${episodeNumber}`;
    const runtimeMinutes = episodesQuery.data?.find((episode) => episode.seasonNumber === episodeSeason && episode.number === episodeNumber)?.runtime ?? seriesQuery.data?.episodeRunTime;
    if (currentWatchedEpisodes[key]) {
      toggleEpisode(media, episodeSeason, episodeNumber, seasons, runtimeMinutes);
      return;
    }
    let missingBefore = 0;
    for (const item of seasons) {
      if (item.number > episodeSeason) continue;
      const last = item.number === episodeSeason ? episodeNumber - 1 : item.episodeCount;
      for (let number = 1; number <= last; number += 1) {
        if (!currentWatchedEpisodes[`${media.id}:${item.number}:${number}`]) missingBefore += 1;
      }
    }
    if (missingBefore === 0) {
      toggleEpisode(media, episodeSeason, episodeNumber, seasons, runtimeMinutes);
      return;
    }
    Alert.alert(
      en ? 'Previous episodes not watched' : 'Önceki bölümler izlenmemiş',
      en
        ? `There are ${missingBefore} unwatched episodes before this one. Mark all of them as watched?`
        : `Bu bölümden önce izlenmemiş ${missingBefore} bölüm var. Buraya kadar hepsini izlendi olarak işaretleyelim mi?`,
      [
        { text: en ? 'Cancel' : 'İptal', style: 'cancel' },
        { text: en ? 'Just this episode' : 'Sadece bu bölüm', onPress: () => toggleEpisode(media, episodeSeason, episodeNumber, seasons, runtimeMinutes) },
        { text: en ? 'Mark all up to here' : 'Buraya kadar hepsi', onPress: () => markThrough(media, episodeSeason, episodeNumber, seasons, seriesQuery.data?.episodeRunTime) },
      ]
    );
  }, [auth.user, en, episodesQuery.data, markThrough, media, seasons, seriesQuery.data?.episodeRunTime, toggleEpisode]);

  if (!media) return <Screen><Pressable accessibilityLabel={t(language, 'back')} onPress={() => router.back()} style={{ padding: 24 }}><Ionicons name="chevron-back" color={colors.text} size={24} /></Pressable>{mediaQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : <View style={{ padding: 24 }}><Text style={styles.error}>{t(language, identity ? 'detailError' : 'invalidTitle')}</Text>{identity && <Pressable onPress={() => mediaQuery.refetch()}><Text style={styles.rating}>{t(language, 'retry')}</Text></Pressable>}</View>}</Screen>;
  const requireUser = () => {
    if (auth.user) return true;
    router.push('/auth' as Href);
    return false;
  };
  const toggleSaved = () => {
    if (!requireUser()) return;
    Haptics.selectionAsync();
    if (saved) setStatusOpen(true); else upsert(media, 'watchlist');
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
    Alert.alert(
      en ? 'Did you finish the whole series?' : 'Dizinin tümünü izledin mi?',
      en ? `All ${totalEpisodes} episodes of ${media.title} will be marked as watched.` : `${media.title} dizisinin ${totalEpisodes} bölümünün tamamı izlendi olarak işaretlenecek.`,
      [
        { text: en ? 'Cancel' : 'İptal', style: 'cancel' },
        { text: en ? 'Watched all' : 'Tümünü izledim', onPress: () => markThrough(media, lastSeason.number, lastSeason.episodeCount, seasons, seriesQuery.data?.episodeRunTime) },
      ]
    );
  };
  const watchedCount = episodesQuery.data?.filter((episode) => watchedEpisodes[`${media.id}:${episode.seasonNumber}:${episode.number}`]).length ?? 0;
  const displayTitle = (media.type === 'tv' ? seriesQuery.data?.originalTitle : movieDetailsQuery.data?.title) || media.title;
  const displayOverview = (media.type === 'tv' ? seriesQuery.data?.overview : movieDetailsQuery.data?.overview) || media.overview;
  const rawGenres = (media.type === 'movie' && movieDetailsQuery.data?.genres.length ? movieDetailsQuery.data.genres : media.genres) ?? [];
  const localizedGenres = rawGenres.map((g) => translateGenre(g, en));

  return <Screen>
    <ImageBackground source={{ uri: media.backdropUrl }} style={styles.hero}>
      <LinearGradient colors={['rgba(7,7,10,.1)', colors.background]} style={StyleSheet.absoluteFill} />
      <Pressable accessibilityLabel={en ? 'Back' : 'Geri'} onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" color="#fff" size={24} /></Pressable>
      <Pressable accessibilityLabel={favorite ? (en ? 'Remove from favorites' : 'Favorilerden çıkar') : (en ? 'Add to favorites' : 'Favorilere ekle')} onPress={() => { if (!requireUser()) return; Haptics.selectionAsync(); toggleFavorite(media); }} style={styles.favorite}><Ionicons name={favorite ? 'heart' : 'heart-outline'} color={favorite ? colors.primary : '#fff'} size={23} /></Pressable>
    </ImageBackground>
    <View style={styles.body}>
      <Text style={styles.type}>{media.type === 'tv' ? (en ? 'TV SHOW' : 'DİZİ') : (en ? 'MOVIE' : 'FİLM')} · {media.year}</Text>
      <Text style={styles.title}>{displayTitle}</Text>
      <View style={styles.meta}>
        <View style={styles.score}><Ionicons name="star" color={colors.warning} size={15} /><Text style={styles.rating}>{media.rating} TMDB</Text></View>
        {imdbTitleQuery.data && <View style={styles.imdbBadge}><Text style={styles.imdbLabel}>IMDb</Text><Text style={styles.imdbValue}>{imdbTitleQuery.data}</Text></View>}
      </View>
      {localizedGenres.length > 0 && <Text style={styles.genres}>{localizedGenres.join('  ·  ')}</Text>}
      <Text style={styles.overview}>{displayOverview}</Text>
      {media.runtimeMinutes ? <Text style={styles.genres}>{media.runtimeMinutes} {en ? 'min' : 'dk'}</Text> : null}
      {removedItem && <View style={styles.undo}><Text style={styles.overview}>{t(language, 'removedFromList')}</Text><Pressable onPress={() => { useLibraryStore.getState().restore(removedItem); setRemovedItem(undefined); }}><Text style={styles.undoText}>{t(language, 'undo')}</Text></Pressable></View>}
      <MotionPressable style={[styles.action, saved && styles.saved]} onPress={toggleSaved}><Ionicons name={saved ? 'checkmark' : 'add'} size={21} color="#fff" /><Text style={styles.actionText}>{saved ? (en ? 'In my list' : 'Listemde') : (en ? 'Add to list' : 'Listeme ekle')}</Text></MotionPressable>
      <MotionPressable disabled={media.type === 'tv' && seasons.length === 0} style={[styles.watchedAction, currentStatus === 'completed' && styles.watchedActive, media.type === 'tv' && seasons.length === 0 && styles.disabled]} onPress={markTitleWatched}><Ionicons name={currentStatus === 'completed' ? 'checkmark-circle' : 'checkmark-circle-outline'} size={21} color={currentStatus === 'completed' ? '#fff' : colors.text} /><Text style={styles.watchedText}>{currentStatus === 'completed' ? (media.type === 'movie' ? (en ? 'Watched · Undo' : 'İzlendi · Geri al') : (en ? 'Watched' : 'İzlendi')) : media.type === 'movie' ? (en ? 'Watched' : 'İzledim') : (en ? 'Watched all' : 'Tümünü izledim')}</Text></MotionPressable>
      {media.type === 'tv' && saved && currentStatus !== 'completed' && <MotionPressable style={styles.dropAction} onPress={() => { if (requireUser()) upsert(media, currentStatus === 'dropped' ? 'watching' : 'dropped'); }}><Ionicons name={currentStatus === 'dropped' ? 'play-outline' : 'stop-circle-outline'} size={18} color={currentStatus === 'dropped' ? colors.success : colors.muted} /><Text style={[styles.dropText, currentStatus === 'dropped' && styles.resumeText]}>{currentStatus === 'dropped' ? (en ? 'Resume watching' : 'İzlemeye devam et') : (en ? 'Dropped' : 'İzlemeyi bıraktım')}</Text></MotionPressable>}

      <View style={styles.extras}>
        <Text style={styles.section}>{t(language, 'whereToWatch')}</Text>
        <View style={styles.countryRow}><Text style={styles.genres}>{t(language, 'country')}</Text>{['TR', 'US', 'GB', 'DE'].map((country) => <Pressable accessibilityRole="button" accessibilityState={{ selected: region === country }} key={country} onPress={() => setRegion(country)} style={[styles.country, region === country && styles.seasonActive]}><Text style={styles.rating}>{country}</Text></Pressable>)}</View>
        {extras.isLoading ? <ActivityIndicator color={colors.primary} /> : extras.isError ? <Pressable onPress={() => extras.refetch()}><Text style={styles.error}>{t(language, 'retry')}</Text></Pressable> : <>
          {(['flatrate', 'rent', 'buy'] as const).map((kind) => extras.data?.providers?.[kind]?.length ? <View key={kind} style={{ marginTop: spacing.md }}><Text style={styles.rating}>{t(language, kind === 'flatrate' ? 'subscription' : kind)}</Text><Text style={styles.overview}>{extras.data.providers[kind]!.map((provider) => provider.provider_name).join(' · ')}</Text></View> : null)}
          {!extras.data?.providers && <Text style={styles.overview}>{t(language, 'noProviders')}</Text>}
          {extras.data?.providers?.link && <Pressable onPress={() => { void Linking.openURL(extras.data!.providers!.link!).catch(() => Alert.alert(t(language, 'error'))); }} style={styles.watchedAction}><Text style={styles.watchedText}>{t(language, 'whereToWatch')} ↗</Text></Pressable>}
          <Text style={styles.attribution}>{t(language, 'providerAttribution')}</Text>
          {extras.data?.trailerUrl && <Pressable onPress={() => { void Linking.openURL(extras.data!.trailerUrl!).catch(() => Alert.alert(t(language, 'error'))); }} style={styles.watchedAction}><Ionicons name="play-circle-outline" size={22} color={colors.text} /><Text style={styles.watchedText}>{t(language, 'trailer')}</Text></Pressable>}
          <PeopleCredits title={t(language, 'director')} people={extras.data?.directors ?? []} language={language} />
          <PeopleCredits title={t(language, 'cast')} people={extras.data?.cast ?? []} language={language} />
        </>}
      </View>

      {media.type === 'tv' && <>
        <View style={styles.rule} />
        <View style={styles.sectionRow}><View><Text style={styles.section}>{en ? 'Episodes' : 'Bölümler'}</Text>{activeSeason && <Text style={styles.progressText}>{watchedCount}/{episodesQuery.data?.length ?? 0} {en ? 'watched' : 'izlendi'}</Text>}</View></View>
        {seriesQuery.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> :
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasons}>
            {seriesQuery.data?.seasons.map((item) => <MotionPressable key={item.id} onPress={() => setSeason(item.number)} style={[styles.season, activeSeason === item.number && styles.seasonActive]}><Text style={[styles.seasonText, activeSeason === item.number && styles.seasonTextActive]}>{item.number}. {en ? 'Season' : 'Sezon'}</Text><Text style={[styles.seasonCount, activeSeason === item.number && styles.seasonTextActive]}>{item.episodeCount} {en ? 'episodes' : 'bölüm'}</Text></MotionPressable>)}
          </ScrollView>}
        {episodesQuery.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : episodesQuery.isError ? <Pressable onPress={() => episodesQuery.refetch()}><Text style={styles.error}>{t(language, 'detailError')} {t(language, 'retry')}</Text></Pressable> :
          <View style={styles.episodes}>{episodesQuery.data?.map((episode) => {
            const key = `${media.id}:${episode.seasonNumber}:${episode.number}`;
            const watched = Boolean(watchedEpisodes[key]);
            const imdb = imdbEpisodesQuery.data?.[episode.number];
            return <EpisodeRow key={episode.id} episode={episode} imdb={imdb} watched={watched} onToggle={handleEpisodePress} en={en} />;
          })}</View>}
        {!!episodesQuery.data?.length && <View style={styles.discussionPicker}>
          <Text style={styles.discussionLabel}>{en ? 'Select episode for reviews' : 'Bölüm yorumu seç'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discussionChips}>
            {episodesQuery.data.map((episode) => <MotionPressable key={`discussion-${episode.id}`} onPress={() => setSocialEpisode(episode)} style={[styles.discussionChip, socialEpisode?.id === episode.id && styles.discussionChipActive]}><Ionicons name="chatbubble-outline" size={13} color={socialEpisode?.id === episode.id ? '#fff' : colors.muted} /><Text style={[styles.discussionChipText, socialEpisode?.id === episode.id && styles.discussionChipTextActive]}>{en ? 'E' : 'B'}{episode.number}</Text></MotionPressable>)}
          </ScrollView>
        </View>}
        {socialEpisode && <ScrollFocusTarget active={params.targetKey?.startsWith('episode:') === true}><CommunityPanel targetKey={`episode:${media.id}:${socialEpisode.seasonNumber}:${socialEpisode.number}`} title={`S${socialEpisode.seasonNumber} ${en ? 'E' : 'B'}${socialEpisode.number} · ${en ? 'Ratings & reviews' : 'Puanlar ve yorumlar'}`} canReview={Boolean(watchedEpisodes[`${media.id}:${socialEpisode.seasonNumber}:${socialEpisode.number}`])} /></ScrollFocusTarget>}
      </>}
      <ScrollFocusTarget active={params.tutorialTarget === 'comments' || params.targetKey?.startsWith('media:') === true}>
        <CommunityPanel targetKey={`media:${media.type}:${media.id}`} canReview={media.type === 'movie' ? currentStatus === 'completed' : currentStatus === 'completed' || hasWatchedEpisode} />
      </ScrollFocusTarget>
      {!!recommendationsQuery.data?.length && <View style={styles.similar}>
        <View style={styles.rule} />
        <Text style={styles.section}>{en ? 'Similar titles' : 'Buna benzer yapımlar'}</Text>
        <Text style={styles.similarSubtitle}>{en ? `If you liked ${media.title}, check these out.` : `${media.title} hoşuna gittiyse bunlara da göz at.`}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarList}>
          {recommendationsQuery.data.map((item) => <MediaCard key={`${item.type}-${item.id}`} media={item} width={138} />)}
        </ScrollView>
      </View>}
    </View>
    <Modal visible={statusOpen} transparent animationType="slide" onRequestClose={() => setStatusOpen(false)}><Pressable onPress={() => setStatusOpen(false)} style={styles.modalBackdrop}><Pressable onPress={(event) => event.stopPropagation()} style={styles.statusSheet}><Text style={styles.section}>{t(language, 'manageList')}</Text>{(['watchlist', 'watching', 'completed', 'dropped'] as LibraryStatus[]).map((status) => <Pressable key={status} style={styles.statusOption} onPress={() => { setStatusOpen(false); if (status === 'completed' && media.type === 'tv') markTitleWatched(); else upsert(media, status); }}><Text style={styles.watchedText}>{({ watchlist: en ? 'Watchlist' : 'İzleyeceğim', watching: en ? 'Watching' : 'İzliyorum', completed: en ? 'Completed' : 'Tamamlandı', dropped: en ? 'Dropped' : 'Bıraktım' })[status]}</Text>{currentStatus === status && <Ionicons name="checkmark" size={20} color={colors.success} />}</Pressable>)}<Pressable style={styles.statusOption} onPress={() => { setRemovedItem(items.find((item) => sameMedia(item.media, media))); remove(media); setStatusOpen(false); }}><Text style={styles.undoText}>{t(language, 'removeFromList')}</Text></Pressable></Pressable></Pressable></Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  extras: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }, countryRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: spacing.md }, country: { padding: 12, borderRadius: radius.sm, backgroundColor: colors.elevated }, attribution: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: spacing.md }, undo: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, marginTop: spacing.md }, undoText: { color: colors.primary, fontSize: 14, fontWeight: '800', paddingVertical: 8 }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.6)' }, statusSheet: { padding: spacing.lg, paddingBottom: 40, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface }, statusOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  similar: { marginTop: spacing.lg }, similarSubtitle: { color: colors.muted, fontSize: 12, marginTop: 5 }, similarList: { paddingTop: spacing.lg, paddingRight: spacing.sm },
  hero: { height: 330 }, back: { position: 'absolute', top: spacing.md, left: spacing.md, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' }, favorite: { position: 'absolute', top: spacing.md, right: spacing.md, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, marginTop: -45 }, type: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 38, lineHeight: 42, fontWeight: '900', letterSpacing: -1.3, marginTop: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }, score: { flexDirection: 'row', alignItems: 'center', gap: 5 }, rating: { color: colors.text, fontWeight: '800', fontSize: 12 }, imdbBadge: { flexDirection: 'row', borderRadius: 5, overflow: 'hidden' }, imdbLabel: { backgroundColor: '#F5C518', color: '#000', fontSize: 11, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 3 }, imdbValue: { backgroundColor: colors.elevated, color: colors.text, fontSize: 11, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3 },
  genres: { color: colors.muted, fontSize: 12, marginTop: spacing.sm }, overview: { color: '#C1BFC4', lineHeight: 23, fontSize: 14, marginTop: spacing.lg }, action: { marginTop: spacing.lg, height: 52, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, saved: { backgroundColor: colors.success }, actionText: { color: '#fff', fontWeight: '900' }, watchedAction: { marginTop: spacing.sm, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, watchedActive: { backgroundColor: colors.secondary, borderColor: colors.secondary }, watchedText: { color: colors.text, fontWeight: '800' }, disabled: { opacity: 0.45 }, dropAction: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.md }, dropText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, resumeText: { color: colors.success },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xl }, sectionRow: { flexDirection: 'row', justifyContent: 'space-between' }, section: { color: colors.text, fontSize: 22, fontWeight: '900' }, progressText: { color: colors.success, fontSize: 11, fontWeight: '700', marginTop: 4 }, loader: { marginVertical: spacing.xl }, seasons: { gap: spacing.sm, paddingVertical: spacing.lg }, season: { minWidth: 105, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, seasonActive: { backgroundColor: colors.primary, borderColor: colors.primary }, seasonText: { color: colors.text, fontWeight: '800', fontSize: 13 }, seasonTextActive: { color: '#fff' }, seasonCount: { color: colors.muted, fontSize: 10, marginTop: 3 },
  episodes: { gap: spacing.sm }, episode: { flexDirection: 'row', alignItems: 'center', minHeight: 92, padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, episodeWatched: { borderColor: 'rgba(101,214,166,.35)' }, still: { width: 92, height: 62, borderRadius: radius.sm, backgroundColor: colors.elevated }, stillFallback: { alignItems: 'center', justifyContent: 'center' }, episodeInfo: { flex: 1, paddingHorizontal: spacing.sm }, episodeNo: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, episodeTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 3 }, episodeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 }, episodeMetaText: { color: colors.muted, fontSize: 9 }, miniImdb: { color: '#F5C518', fontSize: 9, fontWeight: '800', marginLeft: 3 }, check: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, checkActive: { backgroundColor: colors.success, borderColor: colors.success }, discussionPicker: { marginTop: spacing.lg }, discussionLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' }, discussionChips: { gap: 7, paddingTop: spacing.sm }, discussionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 34, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, discussionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, discussionChipText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, discussionChipTextActive: { color: '#fff' }, error: { color: colors.primary, lineHeight: 20, marginVertical: spacing.lg },
});
