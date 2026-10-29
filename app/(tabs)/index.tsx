import { ActivityIndicator, FlatList, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { SectionHeader } from '@/components/SectionHeader';
import { catalogService } from '@/services/tmdb';
import { colors, radius, spacing } from '@/theme/tokens';
import { useProfileStore } from '@/store/profile-store';
import { useLibraryStore } from '@/store/library-store';
import { useAuth } from '@/features/auth/AuthProvider';
import { ContinueWatching } from '@/components/ContinueWatching';
import { NotificationButton } from '@/components/NotificationButton';
import { t } from '@/i18n/strings';
import { dateInZone } from '../../supabase/functions/_shared/episode-schedule';

export default function HomeScreen() {
  const profile = useProfileStore();
  const { user } = useAuth();
  const library = useLibraryStore((state) => state.items);
  const continuing = library.filter((item) => item.status === 'watching' && item.progress?.nextEpisode).sort((a, b) => (b.progress?.updatedAt ?? '').localeCompare(a.progress?.updatedAt ?? '')).slice(0, 3);
  const followed = library.filter((item) => item.media.type === 'tv' && (item.status === 'watching' || item.status === 'completed')).map((item) => item.media).sort((a, b) => a.id - b.id);
  const schedule = useQuery({ queryKey: ['episode-schedule', user?.id, followed.map((show) => show.id), profile.language], queryFn: () => catalogService.episodeSchedule(followed, profile.language), enabled: followed.length > 0, staleTime: 15 * 60_000 });
  const today = dateInZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul');
  const watched = useLibraryStore((state) => state.watchedEpisodes);
  const todayEpisodes = (schedule.data ?? []).filter((episode) => episode.airDate === today && !watched[episode.id]);
  const source = profile.favorites[0];
  const suggestions = useQuery({ queryKey: ['home-suggestions', user?.id, source?.type, source?.id, profile.language], queryFn: () => catalogService.recommendations(source!, profile.language), enabled: Boolean(source) });
  const en = profile.language === 'en';
  const initials = `${profile.firstName[0] ?? 'E'}${profile.lastName[0] ?? ''}`.toUpperCase();
  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['trending', profile.language],
    queryFn: () => catalogService.trending(profile.language),
  });
  const hero = data[0];
  return <Screen>
    <View style={styles.top}><View><Text style={styles.eyebrow}>{en ? 'WHAT ARE WE WATCHING?' : 'BU GECE NE İZLİYORUZ?'}</Text><Text style={styles.logo}>episode<Text style={styles.dot}>.</Text></Text></View><View style={styles.topActions}><Pressable accessibilityLabel={en ? 'Open watch wheel' : 'Film çarkını aç'} onPress={() => router.push('/watch-wheel' as Href)}><LinearGradient colors={['#FF4D8D', '#FF7A45', '#FFD166']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wheelButton}><Ionicons name="color-wand" size={19} color="#fff" /><View style={styles.wheelBadge}><Text style={styles.wheelBadgeText}>{en ? 'SPIN' : 'ÇARK'}</Text></View></LinearGradient></Pressable><Pressable onPress={() => router.push('/profile' as Href)} style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></Pressable></View></View>
    <NotificationButton />
    {continuing.length > 0 && <><SectionHeader title={t(profile.language, 'continueWatching')} />{continuing.map((item) => <ContinueWatching key={item.media.type + ':' + item.media.id} item={item} />)}</>}
    {todayEpisodes.length > 0 && <><SectionHeader title={t(profile.language, 'todayEpisodes')} />{todayEpisodes.slice(0, 4).map((release) => <Pressable key={release.id} onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(release.show.id), type: 'tv', season: String(release.season), episode: String(release.episode), targetKey: 'episode:' + release.id } })} style={{ marginHorizontal: spacing.lg, padding: spacing.md, marginBottom: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }}><Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{release.show.title}</Text><Text style={{ color: colors.muted, fontSize: 13, marginTop: 5 }}>S{release.season} {en ? 'E' : 'B'}{release.episode} · {release.title}</Text></Pressable>)}</>}
    {isLoading ? <ActivityIndicator color={colors.primary} style={{ height: 430 }} /> : isError ? <View style={styles.catalogError}><Ionicons name="cloud-offline-outline" size={32} color={colors.muted} /><Text style={styles.errorTitle}>{en ? 'Could not load catalog' : 'Katalog yüklenemedi'}</Text><Pressable onPress={() => refetch()}><Text style={styles.retry}>{en ? 'Try again' : 'Tekrar dene'}</Text></Pressable></View> : hero && <ImageBackground source={{ uri: hero.backdropUrl }} style={styles.hero} imageStyle={styles.heroImage}>
      <LinearGradient colors={['transparent', 'rgba(7,7,10,.3)', colors.background]} style={StyleSheet.absoluteFill} />
      <View style={styles.heroContent}><View style={styles.badge}><Text style={styles.badgeText}>{en ? 'POPULAR THIS WEEK' : 'BU HAFTA POPÜLER'}</Text></View><Text style={styles.heroTitle}>{hero.title}</Text><Text numberOfLines={2} style={styles.overview}>{hero.overview}</Text><Pressable style={styles.button} onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(hero.id), data: JSON.stringify(hero) } })}><Ionicons name="play" size={17} color="#fff" /><Text style={styles.buttonText}>{en ? 'View Details' : 'Detayları Gör'}</Text></Pressable></View>
    </ImageBackground>}
    <SectionHeader title={en ? 'Trending' : 'Gündemde'} caption={en ? 'THIS WEEK' : 'BU HAFTA'} />
    <FlatList horizontal data={data} keyExtractor={(item) => `${item.type}:${item.id}`} renderItem={({ item }) => <MediaCard media={item} />} contentContainerStyle={styles.list} showsHorizontalScrollIndicator={false} />
    <SectionHeader title={source ? (en ? 'For you' : 'Senin için') : (en ? 'More to discover' : 'Keşfedilecekler')} />
    {source && <Text style={{ color: colors.muted, fontSize: 13, marginHorizontal: spacing.lg, marginBottom: spacing.md }}>{t(profile.language, 'suggestedBecause', { title: source.title })}</Text>}
    {source && suggestions.isError && <Pressable onPress={() => suggestions.refetch()}><Text style={{ color: colors.primary, marginHorizontal: spacing.lg, paddingVertical: 12 }}>{t(profile.language, 'retry')}</Text></Pressable>}
    <FlatList horizontal data={source ? (suggestions.data ?? []).filter((item) => !library.some((saved) => saved.media.id === item.id && saved.media.type === item.type)) : data.slice(5)} keyExtractor={(item) => `rec-${item.type}-${item.id}`} renderItem={({ item }) => <MediaCard media={item} width={128} />} contentContainerStyle={styles.list} showsHorizontalScrollIndicator={false} />
  </Screen>;
}
const styles = StyleSheet.create({ top: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, topActions: { flexDirection: 'row', alignItems: 'center', gap: 9 }, wheelButton: { height: 40, minWidth: 78, borderRadius: 20, paddingHorizontal: 11, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF4D8D', shadowOpacity: .35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }, wheelBadge: { backgroundColor: 'rgba(255,255,255,.2)', borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 3 }, wheelBadgeText: { color: '#fff', fontSize: 7, letterSpacing: .7, fontWeight: '900' }, eyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.6, fontWeight: '700' }, logo: { color: colors.text, fontSize: 30, letterSpacing: -1.5, fontWeight: '900' }, dot: { color: colors.primary }, avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.text, fontSize: 12, fontWeight: '800' }, hero: { height: 430, justifyContent: 'flex-end' }, heroImage: { borderRadius: radius.lg, marginHorizontal: spacing.md }, heroContent: { padding: spacing.xl }, badge: { alignSelf: 'flex-start', backgroundColor: colors.primary, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm }, badgeText: { color: '#fff', fontSize: 9, letterSpacing: 1, fontWeight: '900' }, heroTitle: { color: '#fff', fontSize: 38, lineHeight: 40, letterSpacing: -1.3, fontWeight: '900', marginTop: spacing.sm }, overview: { color: '#D4D2D0', fontSize: 13, lineHeight: 19, marginTop: spacing.sm, maxWidth: 330 }, button: { marginTop: spacing.md, alignSelf: 'flex-start', flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: 'rgba(255,255,255,.16)', borderColor: 'rgba(255,255,255,.22)', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 12 }, list: { paddingLeft: spacing.lg, paddingRight: spacing.sm }, catalogError: { height: 330, alignItems: 'center', justifyContent: 'center' }, errorTitle: { color: colors.text, fontWeight: '800', marginTop: spacing.md }, retry: { color: colors.primary, fontWeight: '800', marginTop: spacing.sm } });
