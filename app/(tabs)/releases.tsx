import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { catalogService } from '@/services/tmdb';
import { enableNotifications } from '@/services/notifications';
import { useLibraryStore } from '@/store/library-store';
import { colors, radius, spacing } from '@/theme/tokens';

function dateLabel(date: string) {
  const day = new Date(`${date}T12:00:00`);
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const difference = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (difference === 0) return 'Bugün';
  if (difference === -1) return 'Dün';
  if (difference === 1) return 'Yarın';
  return day.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

export default function ReleasesScreen() {
  const [now] = useState(() => Date.now());
  const items = useLibraryStore((state) => state.items);
  const watchedEpisodes = useLibraryStore((state) => state.watchedEpisodes);
  const toggleEpisode = useLibraryStore((state) => state.toggleEpisode);
  const followedShows = items.filter((item) => item.media.type === 'tv' && (item.status === 'watching' || item.status === 'completed')).map((item) => item.media);
  const schedule = useQuery({ queryKey: ['episode-schedule', followedShows.map((show) => show.id)], queryFn: () => catalogService.episodeSchedule(followedShows), enabled: followedShows.length > 0, staleTime: 15 * 60_000 });
  const visible = (schedule.data ?? []).filter((release) => !watchedEpisodes[release.id]);
  const aired = visible.filter((release) => new Date(`${release.airDate}T23:59:59`).getTime() <= now).reverse();
  const upcoming = visible.filter((release) => new Date(`${release.airDate}T23:59:59`).getTime() > now);

  const renderRelease = (release: (typeof visible)[number], isUpcoming: boolean) => <Pressable key={release.id} onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(release.show.id), data: JSON.stringify(release.show) } })} style={styles.item}>
    <Image source={{ uri: release.show.posterUrl }} style={styles.poster} />
    <View style={styles.info}><Text style={styles.show}>{release.show.title}</Text><Text style={styles.episode}>S{release.season} · B{release.episode}  “{release.title}”</Text><Text style={[styles.time, isUpcoming && styles.upcoming]}>{dateLabel(release.airDate)} {isUpcoming ? 'yayınlanacak' : 'yayınlandı'}</Text></View>
    {!isUpcoming && <Pressable accessibilityLabel="İzlendi işaretle" onPress={(event) => { event.stopPropagation(); toggleEpisode(release.show, release.season, release.episode, 0); }} style={styles.check}><Ionicons name="checkmark" size={20} color={colors.muted} /></Pressable>}
  </Pressable>;

  return <Screen>
    <View style={styles.header}><Text style={styles.kicker}>TAKVİMİN</Text><Text style={styles.title}>Yeni bölümler</Text><Text style={styles.subtitle}>İzlediğin dizilerin gerçek yayın takvimi.</Text><Pressable style={styles.notify} onPress={() => enableNotifications()}><Ionicons name="notifications-outline" size={18} color={colors.text} /><Text style={styles.notifyText}>Bildirimleri aç</Text></Pressable></View>
    {followedShows.length === 0 ? <View style={styles.emptyBox}><Ionicons name="calendar-outline" size={34} color={colors.muted} /><Text style={styles.emptyTitle}>Takip edilen dizi yok</Text><Text style={styles.empty}>Bir dizinin bölümünü izledin olarak işaretlediğinde yayın takvimi burada görünür.</Text></View> : schedule.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : schedule.isError ? <View style={styles.emptyBox}><Text style={styles.error}>Yayın takvimi alınamadı.</Text><Pressable onPress={() => schedule.refetch()}><Text style={styles.retry}>Tekrar dene</Text></Pressable></View> : visible.length === 0 ? <View style={styles.emptyBox}><Ionicons name="checkmark-circle-outline" size={36} color={colors.success} /><Text style={styles.emptyTitle}>Her şey güncel</Text><Text style={styles.empty}>Son 30 günde kaçırdığın veya planlanmış yeni bir bölüm yok.</Text></View> : <>
      {aired.length > 0 && <><View style={styles.dateRow}><Text style={styles.date}>İZLENECEKLER</Text><View style={styles.line} /></View>{aired.map((release) => renderRelease(release, false))}</>}
      {upcoming.length > 0 && <><View style={styles.dateRow}><Text style={styles.date}>YAKINDA</Text><View style={styles.line} /></View>{upcoming.map((release) => renderRelease(release, true))}</>}
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg }, kicker: { color: colors.primary, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' }, title: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 4 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: spacing.sm }, notify: { alignSelf: 'flex-start', marginTop: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, notifyText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginVertical: spacing.md }, date: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, line: { height: 1, backgroundColor: colors.border, flex: 1 }, item: { marginHorizontal: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, poster: { width: 58, height: 82, borderRadius: radius.sm }, info: { flex: 1, paddingHorizontal: spacing.md }, show: { color: colors.text, fontWeight: '800', fontSize: 15 }, episode: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 }, time: { color: colors.success, fontSize: 10, fontWeight: '700', marginTop: 6 }, upcoming: { color: colors.warning }, check: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: 80 }, emptyBox: { alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: 70 }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: spacing.md }, empty: { color: colors.muted, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm }, error: { color: colors.primary, fontWeight: '700' }, retry: { color: colors.text, fontWeight: '800', marginTop: spacing.md },
});
