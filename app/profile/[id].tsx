import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MediaCard } from '@/components/MediaCard';
import { ProfileConnections } from '@/components/ProfileConnections';
import { Screen } from '@/components/Screen';
import { WatchLevelBadge } from '@/components/WatchLevelBadge';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchFriendActivity } from '@/features/friends/friends-repository';
import { formatWatchHours, useWatchMinutes } from '@/features/profile/watch-time';
import { colors, radius, spacing } from '@/theme/tokens';

const statusText = { watching: 'İzliyor', watchlist: 'Listesinde', completed: 'Tamamladı', dropped: 'Bıraktı' } as const;

export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const query = useQuery({ queryKey: ['friend-profile', auth.user?.id, id], queryFn: () => fetchFriendActivity(auth.user!.id, id!), enabled: Boolean(auth.user && id), staleTime: 30_000 });
  const data = query.data;
  const watchTime = useWatchMinutes(data?.library ?? []);
  if (query.isLoading) return <Screen><Header /><Text style={styles.state}>Profil yükleniyor…</Text></Screen>;
  if (!data) return <Screen><Header /><View style={styles.stateBox}><Ionicons name="lock-closed-outline" size={28} color={colors.muted} /><Text style={styles.state}>{query.error instanceof Error ? query.error.message : 'Profil açılamadı.'}</Text></View></Screen>;
  const profile = data.profile;
  const name = `${profile.firstName} ${profile.lastName}`.trim() || (profile.username ? `@${profile.username}` : 'Episode');
  const initials = `${profile.firstName[0] ?? profile.username[0] ?? 'E'}${profile.lastName[0] ?? ''}`.toUpperCase();
  const ratingByTarget = new Map(data.ratings.map((rating) => [rating.targetKey, rating.score]));
  return <Screen>
    <View style={styles.hero}><ImageBackground source={profile.coverUrl ? { uri: profile.coverUrl } : undefined} style={StyleSheet.absoluteFill}><LinearGradient colors={['rgba(7,7,10,.12)', colors.background]} style={StyleSheet.absoluteFill} /></ImageBackground><Header /></View>
    <View style={styles.identity}>{profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initials}>{initials}</Text></View>}<Text style={styles.name}>{name}</Text>{profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}</View>
    <WatchLevelBadge minutes={watchTime.minutes} isLoading={watchTime.isLoading} />
    <View style={styles.stats}><Stat value={data.library.length} label="Yapım" /><Stat value={watchTime.isLoading ? '…' : formatWatchHours(watchTime.minutes)} label="Saat" /><Stat value={data.watchedEpisodeCount} label="Bölüm" /></View>
    <ProfileConnections profileId={profile.id} currentUserId={auth.user?.id} />
    <Section title="Favorileri" count={data.favorites.length}>{data.favorites.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{data.favorites.map((media) => <MediaCard key={`${media.type}-${media.id}`} media={media} width={126} />)}</ScrollView> : <Text style={styles.empty}>Henüz favorisi yok.</Text>}</Section>
    <Section title="İzleme geçmişi" count={data.library.length}>{data.library.length ? <View style={styles.library}>{data.library.map((item) => { const score = ratingByTarget.get(`media:${item.media.type}:${item.media.id}`); const next = item.progress?.nextEpisode; return <Pressable key={`${item.media.type}-${item.media.id}`} onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(item.media.id), data: JSON.stringify(item.media) } })} style={styles.item}><Image source={{ uri: item.media.posterUrl }} style={styles.poster} /><View style={styles.itemCopy}><Text numberOfLines={1} style={styles.itemTitle}>{item.media.title}</Text><Text style={styles.itemMeta}>{statusText[item.status]}{item.progress ? ` · ${item.progress.watched}/${item.progress.total}` : ''}{next ? ` · Kaldığı yer S${next.season} B${next.episode}` : ''}</Text></View>{score ? <View style={styles.score}><Ionicons name="star" size={12} color={colors.warning} /><Text style={styles.scoreText}>{score}</Text></View> : null}</Pressable>; })}</View> : <Text style={styles.empty}>Henüz izleme aktivitesi yok.</Text>}</Section>
  </Screen>;
}

function Header() { return <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>; }
function Stat({ value, label }: { value: number | string; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.count}>{count}</Text></View>{children}</View>; }

const styles = StyleSheet.create({
  hero: { height: 210, backgroundColor: colors.elevated }, back: { position: 'absolute', left: spacing.lg, top: 8, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(15,15,19,.75)', alignItems: 'center', justifyContent: 'center', zIndex: 2 }, identity: { alignItems: 'center', marginTop: -52, paddingHorizontal: spacing.lg }, avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: colors.background }, avatarFallback: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: colors.background, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, initials: { color: '#fff', fontSize: 28, fontWeight: '900' }, name: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: spacing.sm }, username: { color: colors.muted, marginTop: 3 }, stats: { flexDirection: 'row', margin: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, stat: { flex: 1, alignItems: 'center' }, statValue: { color: colors.text, fontSize: 20, fontWeight: '900' }, statLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 3 }, section: { marginTop: spacing.lg }, sectionHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md }, sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, count: { color: colors.primary, fontSize: 11, fontWeight: '800' }, horizontal: { paddingHorizontal: spacing.lg }, empty: { color: colors.muted, fontSize: 12, paddingHorizontal: spacing.lg }, library: { marginHorizontal: spacing.lg, gap: spacing.sm }, item: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, poster: { width: 50, height: 72, borderRadius: radius.sm, backgroundColor: colors.elevated }, itemCopy: { flex: 1, paddingHorizontal: spacing.md }, itemTitle: { color: colors.text, fontWeight: '800', fontSize: 13 }, itemMeta: { color: colors.muted, fontSize: 10, marginTop: 5 }, score: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(248,193,92,.1)', borderRadius: radius.pill }, scoreText: { color: colors.warning, fontWeight: '900', fontSize: 11 }, state: { color: colors.muted, textAlign: 'center', marginTop: 120 }, stateBox: { alignItems: 'center', marginTop: 120, gap: spacing.sm },
});
