import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { NotificationButton } from '@/components/NotificationButton';
import { ContinueWatching } from '@/components/ContinueWatching';
import { EpisodeRelease, LibraryItem } from '@/domain/media';
import { catalogService } from '@/services/tmdb';
import { enableNotifications } from '@/services/notifications';
import { updateNotificationPreferences } from '@/features/notifications/notification-repository';
import { useLibraryStore } from '@/store/library-store';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfileStore } from '@/store/profile-store';
import { t } from '@/i18n/strings';
import { colors, radius, spacing } from '@/theme/tokens';
import { dateInZone } from '../../supabase/functions/_shared/episode-schedule';

type Row = { id: string; kind: 'section'; title: string } | { id: string; kind: 'continue'; item: LibraryItem } | { id: string; kind: 'release'; release: EpisodeRelease; upcoming: boolean };
export default function ReleasesScreen() {
  const { user } = useAuth();
  const language = useProfileStore((state) => state.language);
  const en = language === 'en';
  const client = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [enabling, setEnabling] = useState(false);
  const items = useLibraryStore((state) => state.items);
  const watched = useLibraryStore((state) => state.watchedEpisodes);
  const today = dateInZone(now, Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul');
  const shows = items.filter((item) => item.media.type === 'tv' && ['watching', 'completed'].includes(item.status)).map((item) => item.media).sort((a, b) => a.id - b.id);
  const continuing = items.filter((item) => item.media.type === 'tv' && item.status === 'watching' && item.progress?.nextEpisode).sort((a, b) => (b.progress?.updatedAt ?? '').localeCompare(a.progress?.updatedAt ?? ''));
  const continuingKeys = new Set(continuing.map((item) => `${item.media.id}:${item.progress!.nextEpisode!.season}:${item.progress!.nextEpisode!.episode}`));
  const schedule = useQuery({ queryKey: ['episode-schedule', user?.id, shows.map((show) => show.id), language], queryFn: () => catalogService.episodeSchedule(shows, language), enabled: shows.length > 0, staleTime: 15 * 60_000, refetchOnMount: 'always' });
  const visible = (schedule.data ?? []).filter((release) => !watched[release.id] && !continuingKeys.has(release.id));
  const aired = visible.filter((release) => release.airDate <= today).reverse();
  const upcoming = visible.filter((release) => release.airDate > today);
  const rows: Row[] = [
    ...continuing.length ? [{ id: 'continue-header', kind: 'section' as const, title: t(language, 'continueWatching') }, ...continuing.map((item): Row => ({ id: `continue:${item.media.id}`, kind: 'continue', item }))] : [],
    ...aired.length ? [{ id: 'aired-header', kind: 'section' as const, title: en ? 'To watch' : 'İzlenecekler' }, ...aired.map((release): Row => ({ id: release.id, kind: 'release', release, upcoming: false }))] : [],
    ...upcoming.length ? [{ id: 'upcoming-header', kind: 'section' as const, title: en ? 'Upcoming' : 'Yakında' }, ...upcoming.map((release): Row => ({ id: release.id, kind: 'release', release, upcoming: true }))] : [],
  ];
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') { setNow(new Date()); void client.invalidateQueries({ queryKey: ['episode-schedule'] }); } });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [client]);
  useEffect(() => {
    for (const release of schedule.data ?? []) if (release.airDate <= today && !watched[release.id]) useLibraryStore.getState().reopenForEpisode(release.show, release.season, release.episode);
  }, [schedule.data, today, watched]);
  const enable = async () => {
    if (!user || enabling) return;
    setEnabling(true);
    try {
      const granted = await enableNotifications(user.id);
      if (!granted) { Alert.alert(t(language, 'preferences'), t(language, 'permissionNeeded')); return; }
      await updateNotificationPreferences(user.id, { new_episodes: true, push_enabled: true, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul' });
      await client.invalidateQueries({ queryKey: ['notification-preferences', user.id] });
      Alert.alert(en ? 'Notifications enabled' : 'Bildirimler açık', t(language, 'episodeNotificationNote'));
    } catch { Alert.alert(t(language, 'error'), t(language, 'registrationError')); }
    finally { setEnabling(false); }
  };
  const header = <><View style={styles.header}><Text style={styles.kicker}>{en ? 'YOUR SCHEDULE' : 'TAKVİMİN'}</Text><Text style={styles.title}>{en ? 'New episodes' : 'Yeni bölümler'}</Text><Text style={styles.subtitle}>{en ? 'Upcoming episodes and everything you missed in the last 30 days.' : 'Yaklaşan bölümler ve son 30 günde kaçırdıkların.'}</Text><Pressable disabled={enabling} accessibilityRole="button" style={styles.notify} onPress={() => void enable()}><Ionicons name="notifications-outline" size={19} color={colors.text} /><Text style={styles.notifyText}>{enabling ? t(language, 'loading') : t(language, 'enablePush')}</Text></Pressable></View><NotificationButton /></>;
  return <Screen scroll={false}><FlatList data={rows} keyExtractor={(row) => row.id} ListHeaderComponent={header} contentContainerStyle={{ paddingBottom: 120 }} refreshing={schedule.isRefetching} onRefresh={() => { setNow(new Date()); void schedule.refetch(); }} ListEmptyComponent={schedule.isLoading ? <ActivityIndicator color={colors.primary} /> : <View style={styles.empty}><Ionicons name="calendar-outline" size={36} color={colors.muted} /><Text style={styles.emptyTitle}>{schedule.isError ? (en ? 'Could not load the schedule' : 'Yayın takvimi yüklenemedi') : shows.length ? (en ? 'No new episodes' : 'Yeni bölüm yok') : (en ? 'Follow your first show' : 'İlk dizini takip et')}</Text><Text style={styles.subtitle}>{schedule.isError ? t(language, 'detailError') : shows.length ? (en ? 'Your upcoming episodes will appear here.' : 'Yaklaşan bölümlerin burada görünecek.') : (en ? 'Mark an episode watched to start following a show.' : 'Bir bölümü izlendi işaretleyerek diziyi takip etmeye başla.')}</Text><Pressable onPress={() => schedule.isError ? schedule.refetch() : router.push('/discover')} style={styles.notify}><Text style={styles.notifyText}>{t(language, schedule.isError ? 'retry' : 'findTitle')}</Text></Pressable></View>} renderItem={({ item }) => {
    if (item.kind === 'section') return <Text style={styles.section}>{item.title}</Text>;
    if (item.kind === 'continue') return <ContinueWatching item={item.item} />;
    const release = item.release;
    return <Pressable onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(release.show.id), type: 'tv', season: String(release.season), episode: String(release.episode), targetKey: `episode:${release.id}` } })} style={styles.item}><Image source={{ uri: release.show.posterUrl }} style={styles.poster} /><View style={styles.copy}><Text style={styles.show}>{release.show.title}</Text><Text style={styles.episode}>S{release.season} · {en ? 'E' : 'B'}{release.episode} · {release.title}</Text><Text style={[styles.date, item.upcoming && { color: colors.warning }]}>{release.airDate === today ? (en ? 'Today' : 'Bugün') : new Date(`${release.airDate}T12:00:00`).toLocaleDateString(en ? 'en-US' : 'tr-TR', { day: 'numeric', month: 'long' })}</Text></View>{!item.upcoming && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={en ? 'Mark as watched' : 'İzlendi işaretle'} onPress={(event) => { event.stopPropagation(); useLibraryStore.getState().toggleEpisode(release.show, release.season, release.episode, []); }} style={styles.check}><Ionicons name="checkmark" size={23} color={colors.success} /></Pressable>}</Pressable>;
  }} /></Screen>;
}
const styles = StyleSheet.create({ header: { padding: spacing.lg }, kicker: { color: colors.primary, fontSize: 12, fontWeight: '800' }, title: { color: colors.text, fontSize: 34, fontWeight: '900', marginTop: 5 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.sm }, notify: { marginTop: spacing.md, minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md }, notifyText: { color: colors.text, fontWeight: '700', fontSize: 13 }, section: { color: colors.text, fontSize: 19, fontWeight: '900', margin: spacing.lg }, item: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, poster: { width: 48, height: 70, borderRadius: radius.sm }, copy: { flex: 1, paddingHorizontal: spacing.sm }, show: { color: colors.text, fontSize: 15, fontWeight: '800' }, episode: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 }, date: { color: colors.success, fontSize: 12, marginTop: 5 }, check: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, empty: { margin: spacing.xl, alignItems: 'center' }, emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: spacing.md } });
