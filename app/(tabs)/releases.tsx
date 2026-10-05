import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { catalogService } from '@/services/tmdb';
import { enableNotifications, notificationsAreEnabled, scheduleEpisodeReminder } from '@/services/notifications';
import { useLibraryStore } from '@/store/library-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { MotionPressable } from '@/components/MotionPressable';

function dateLabel(date: string) {
  const day = new Date(`${date}T12:00:00`);
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const difference = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (difference === 0) return 'Bugün';
  if (difference === -1) return 'Dün';
  if (difference === 1) return 'Yarın';
  return day.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

function AnimatedEpisodeCheck({ label, onConfirm }: { label: string; onConfirm: () => Promise<boolean> }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    await new Promise<void>((resolve) => Animated.spring(progress, { toValue: 1, speed: 24, bounciness: 10, useNativeDriver: true }).start(() => resolve()));
    const confirmed = await onConfirm();
    if (!confirmed) Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    setBusy(false);
  };
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return <MotionPressable accessibilityRole="checkbox" accessibilityState={{ checked: busy, disabled: busy }} accessibilityLabel={label} onPress={() => void confirm()} style={styles.episodeCheck} pressedScale={0.9}>
    <Ionicons name="checkmark" size={20} color={colors.muted} />
    <Animated.View style={[styles.episodeCheckFill, { opacity: progress, transform: [{ scale }] }]}><Ionicons name="checkmark" size={20} color="#fff" /></Animated.View>
  </MotionPressable>;
}

function AnimatedContinueCard({ children }: { children: ReactNode }) {
  const [entrance] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(entrance, { toValue: 1, speed: 18, bounciness: 5, useNativeDriver: true }).start();
  }, [entrance]);
  const translateX = entrance.interpolate({ inputRange: [0, 1], outputRange: [34, 0] });
  const scale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });
  return <Animated.View style={[styles.item, { opacity: entrance, transform: [{ translateX }, { scale }] }]}>{children}</Animated.View>;
}

export default function ReleasesScreen() {
  const auth = useAuth();
  const [now] = useState(() => Date.now());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const items = useLibraryStore((state) => state.items);
  const watchedEpisodes = useLibraryStore((state) => state.watchedEpisodes);
  const toggleEpisode = useLibraryStore((state) => state.toggleEpisode);
  const reopenForEpisode = useLibraryStore((state) => state.reopenForEpisode);
  const recordEpisodeRuntimes = useLibraryStore((state) => state.recordEpisodeRuntimes);
  const followedShows = items.filter((item) => item.media.type === 'tv' && (item.status === 'watching' || item.status === 'completed')).map((item) => item.media);
  const continuingItems = items
    .filter((item) => item.media.type === 'tv' && item.status === 'watching' && item.progress?.nextEpisode)
    .sort((left, right) => (right.progress?.updatedAt ?? '').localeCompare(left.progress?.updatedAt ?? ''));
  const continuingEpisodeIds = new Set(continuingItems.map((item) => `${item.media.id}:${item.progress!.nextEpisode!.season}:${item.progress!.nextEpisode!.episode}`));
  const schedule = useQuery({ queryKey: ['episode-schedule', followedShows.map((show) => show.id)], queryFn: () => catalogService.episodeSchedule(followedShows), enabled: followedShows.length > 0, staleTime: 15 * 60_000 });
  const visible = (schedule.data ?? []).filter((release) => !watchedEpisodes[release.id] && !continuingEpisodeIds.has(release.id));
  const aired = visible.filter((release) => new Date(`${release.airDate}T23:59:59`).getTime() <= now).reverse();
  const upcoming = visible.filter((release) => new Date(`${release.airDate}T23:59:59`).getTime() > now);

  useEffect(() => {
    for (const release of schedule.data ?? []) {
      if (new Date(`${release.airDate}T23:59:59`).getTime() <= Date.now() && !watchedEpisodes[release.id]) {
        reopenForEpisode(release.show, release.season, release.episode);
      }
    }
  }, [reopenForEpisode, schedule.data, watchedEpisodes]);

  useEffect(() => {
    const refreshPermission = () => notificationsAreEnabled().then(setNotificationsEnabled).catch(() => setNotificationsEnabled(false));
    refreshPermission();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refreshPermission(); });
    return () => subscription.remove();
  }, []);

  const configureNotifications = async () => {
    const enabled = await enableNotifications(auth.user?.id);
    setNotificationsEnabled(enabled);
    if (enabled) await Promise.all(upcoming.map((release) => {
      const planned = new Date(`${release.airDate}T12:00:00`);
      const reminder = planned.getTime() > Date.now() ? planned : new Date(Date.now() + 60_000);
      return scheduleEpisodeReminder(release.id, `${release.show.title} yayında`, `S${release.season} · B${release.episode} “${release.title}”`, reminder);
    }));
    Alert.alert(enabled ? 'Bildirimler açık' : 'Bildirim izni gerekli', enabled ? `${upcoming.length} yaklaşan bölüm için hatırlatıcılar güncellendi. Arkadaşlık istekleri ve yorum etkileşimleri de bildirilecek.` : 'Ayarlar’dan Episode için bildirim iznini açmalısın.');
  };

  const renderRelease = (release: (typeof visible)[number], isUpcoming: boolean) => <Pressable key={release.id} onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(release.show.id), data: JSON.stringify(release.show) } })} style={styles.item}>
    <Image source={{ uri: release.show.posterUrl }} style={styles.poster} />
    <View style={styles.info}><Text style={styles.show}>{release.show.title}</Text><Text style={styles.episode}>S{release.season} · B{release.episode}  “{release.title}”</Text><Text style={[styles.time, isUpcoming && styles.upcoming]}>{dateLabel(release.airDate)} {isUpcoming ? 'yayınlanacak' : 'yayınlandı'}</Text></View>
    {!isUpcoming && <Pressable accessibilityLabel="İzlendi işaretle" onPress={(event) => { event.stopPropagation(); const runtime = items.find((item) => item.media.id === release.show.id)?.progress?.runtimeMinutes; toggleEpisode(release.show, release.season, release.episode, [], runtime); }} style={styles.check}><Ionicons name="checkmark" size={20} color={colors.muted} /></Pressable>}
  </Pressable>;

  const markContinueWatched = async (item: (typeof continuingItems)[number]): Promise<boolean> => {
    const next = item.progress?.nextEpisode;
    if (!next) return false;
    const episodeId = `${item.media.id}:${next.season}:${next.episode}`;
    try {
      let runtime = item.progress?.runtimeMinutes;
      let seasons = item.progress?.seasons?.map((season) => ({ id: season.number, number: season.number, name: `${season.number}. Sezon`, episodeCount: season.episodeCount })) ?? [];
      if (seasons.length === 0) {
        const details = await catalogService.seriesDetails(item.media.id);
        seasons = details.seasons;
        runtime = details.episodeRunTime ?? runtime;
      }
      toggleEpisode(item.media, next.season, next.episode, seasons, runtime);
      void catalogService.seasonEpisodes(item.media.id, next.season).then((episodes) => {
        const episode = episodes.find((candidate) => candidate.number === next.episode);
        if (episode?.runtime) recordEpisodeRuntimes(item.media.id, { [episodeId]: episode.runtime }, runtime);
      }).catch(() => undefined);
      return true;
    } catch {
      Alert.alert('Bölüm güncellenemedi', 'Sezon bilgisi alınamadı. Lütfen tekrar dene.');
      return false;
    }
  };

  const renderContinue = (item: (typeof continuingItems)[number]) => {
    const next = item.progress!.nextEpisode!;
    const episodeId = `${item.media.id}:${next.season}:${next.episode}`;
    return <AnimatedContinueCard key={episodeId}>
      <Pressable accessibilityLabel={`${item.media.title} ayrıntılarını aç`} onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(item.media.id), data: JSON.stringify(item.media) } })} style={styles.episodeLink}>
        <Image source={{ uri: item.media.posterUrl }} style={styles.poster} />
        <View style={styles.info}><Text style={styles.show}>{item.media.title}</Text><Text style={styles.episode}>Kaldığın yer · S{next.season} · B{next.episode}</Text><Text style={styles.continue}>Ayrıntıya git</Text></View>
      </Pressable>
      <AnimatedEpisodeCheck key={episodeId} label={`${item.media.title} S${next.season} B${next.episode} izlendi işaretle`} onConfirm={() => markContinueWatched(item)} />
    </AnimatedContinueCard>;
  };

  return <Screen>
    <View style={styles.header}><Text style={styles.kicker}>TAKVİMİN</Text><Text style={styles.title}>Yeni bölümler</Text><Text style={styles.subtitle}>İzlediğin dizilerin gerçek yayın takvimi.</Text><Pressable style={[styles.notify, notificationsEnabled && styles.notifyEnabled]} onPress={() => void configureNotifications()}><Ionicons name={notificationsEnabled ? 'checkmark-circle' : 'notifications-outline'} size={18} color={notificationsEnabled ? colors.success : colors.text} /><Text style={[styles.notifyText, notificationsEnabled && styles.notifyTextEnabled]}>{notificationsEnabled ? 'Bildirimler açık' : 'Bildirimleri aç'}</Text></Pressable></View>
    {continuingItems.length > 0 && <><View style={styles.dateRow}><Text style={styles.date}>KALDIĞIN YER</Text><View style={styles.line} /></View>{continuingItems.map(renderContinue)}</>}
    {followedShows.length === 0 ? <View style={styles.emptyBox}><Ionicons name="calendar-outline" size={34} color={colors.muted} /><Text style={styles.emptyTitle}>Takip edilen dizi yok</Text><Text style={styles.empty}>Bir dizinin bölümünü izledin olarak işaretlediğinde yayın takvimi burada görünür.</Text></View> : schedule.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : schedule.isError ? <View style={styles.emptyBox}><Text style={styles.error}>Yayın takvimi alınamadı.</Text><Pressable onPress={() => schedule.refetch()}><Text style={styles.retry}>Tekrar dene</Text></Pressable></View> : visible.length === 0 ? <View style={styles.emptyBox}><Ionicons name="checkmark-circle-outline" size={36} color={colors.success} /><Text style={styles.emptyTitle}>Her şey güncel</Text><Text style={styles.empty}>Son 30 günde kaçırdığın veya planlanmış yeni bir bölüm yok.</Text></View> : <>
      {aired.length > 0 && <><View style={styles.dateRow}><Text style={styles.date}>İZLENECEKLER</Text><View style={styles.line} /></View>{aired.map((release) => renderRelease(release, false))}</>}
      {upcoming.length > 0 && <><View style={styles.dateRow}><Text style={styles.date}>YAKINDA</Text><View style={styles.line} /></View>{upcoming.map((release) => renderRelease(release, true))}</>}
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg }, kicker: { color: colors.primary, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' }, title: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 4 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: spacing.sm }, notify: { alignSelf: 'flex-start', marginTop: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, notifyEnabled: { borderColor: 'rgba(101,214,166,.35)', backgroundColor: 'rgba(101,214,166,.08)' }, notifyText: { color: colors.text, fontWeight: '700', fontSize: 12 }, notifyTextEnabled: { color: colors.success },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginVertical: spacing.md }, date: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, line: { height: 1, backgroundColor: colors.border, flex: 1 }, item: { marginHorizontal: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, episodeLink: { flex: 1, flexDirection: 'row', alignItems: 'center' }, poster: { width: 58, height: 82, borderRadius: radius.sm }, info: { flex: 1, paddingHorizontal: spacing.md }, show: { color: colors.text, fontWeight: '800', fontSize: 15 }, episode: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 }, continue: { color: colors.success, fontSize: 10, fontWeight: '700', marginTop: 6 }, episodeCheck: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, episodeCheckFill: { position: 'absolute', inset: 0, borderRadius: 19, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }, time: { color: colors.success, fontSize: 10, fontWeight: '700', marginTop: 6 }, upcoming: { color: colors.warning }, check: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: 80 }, emptyBox: { alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: 70 }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: spacing.md }, empty: { color: colors.muted, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm }, error: { color: colors.primary, fontWeight: '700' }, retry: { color: colors.text, fontWeight: '800', marginTop: spacing.md },
});
