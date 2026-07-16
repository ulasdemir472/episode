import { useCallback, useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MediaCard } from '@/components/MediaCard';
import { ProfileConnections } from '@/components/ProfileConnections';
import { Screen } from '@/components/Screen';
import { WatchLevelBadge } from '@/components/WatchLevelBadge';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchFriendActivity, ProfileActivity } from '@/features/friends/friends-repository';
import { parseReviewTarget } from '@/features/community/target';
import { formatWatchHours, useWatchMinutes } from '@/features/profile/watch-time';
import { colors, radius, spacing } from '@/theme/tokens';

const statusText = { watching: 'İzliyor', watchlist: 'Listesinde', completed: 'Tamamladı', dropped: 'Bıraktı' } as const;

export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const [visibleLibraryCount, setVisibleLibraryCount] = useState(10);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const query = useQuery({ queryKey: ['friend-profile', auth.user?.id, id], queryFn: () => fetchFriendActivity(auth.user!.id, id!), enabled: Boolean(auth.user && id), staleTime: 30_000 });
  const { refetch } = query;
  useFocusEffect(useCallback(() => {
    if (!auth.user || !id) return undefined;
    void refetch();
    const interval = setInterval(() => void refetch(), 30_000);
    return () => clearInterval(interval);
  }, [auth.user, id, refetch]));
  const data = query.data;
  const watchTime = useWatchMinutes(data?.library ?? [], data?.episodeRuntimes);
  if (query.isLoading) return <Screen><Header /><Text style={styles.state}>Profil yükleniyor…</Text></Screen>;
  if (!data) return <Screen><Header /><View style={styles.stateBox}><Ionicons name="lock-closed-outline" size={28} color={colors.muted} /><Text style={styles.state}>{query.error instanceof Error ? query.error.message : 'Profil açılamadı.'}</Text></View></Screen>;
  const profile = data.profile;
  const name = `${profile.firstName} ${profile.lastName}`.trim() || (profile.username ? `@${profile.username}` : 'Episode');
  const initials = `${profile.firstName[0] ?? profile.username[0] ?? 'E'}${profile.lastName[0] ?? ''}`.toUpperCase();
  const ratingByTarget = new Map(data.ratings.map((rating) => [rating.targetKey, rating.score]));
  const alphabeticalLibrary = [...data.library].sort((left, right) => left.media.title.localeCompare(right.media.title, 'tr', { sensitivity: 'base' }));
  const visibleLibrary = alphabeticalLibrary.slice(0, visibleLibraryCount);
  const visibleActivities = showAllActivities ? data.activities : data.activities.slice(0, 3);
  return <Screen>
    <View style={styles.hero}><ImageBackground source={profile.coverUrl ? { uri: profile.coverUrl } : undefined} style={StyleSheet.absoluteFill}><LinearGradient colors={['rgba(7,7,10,.12)', colors.background]} style={StyleSheet.absoluteFill} /></ImageBackground><Header /></View>
    <View style={styles.identity}>{profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initials}>{initials}</Text></View>}<Text style={styles.name}>{name}</Text>{profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}</View>
    <WatchLevelBadge minutes={watchTime.minutes} isLoading={watchTime.isLoading} />
    <View style={styles.stats}><Stat value={data.library.length} label="Yapım" /><Stat value={watchTime.isLoading ? '…' : formatWatchHours(watchTime.minutes)} label="Saat" /><Stat value={data.watchedEpisodeCount} label="Bölüm" /></View>
    <ProfileConnections profileId={profile.id} />
    <Section title="Favorileri" count={data.favorites.length}>{data.favorites.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{data.favorites.map((media) => <MediaCard key={`${media.type}-${media.id}`} media={media} width={126} />)}</ScrollView> : <Text style={styles.empty}>Henüz favorisi yok.</Text>}</Section>
    <Section title="Son hareketler" count={data.activities.length}>{visibleActivities.length ? <View style={styles.activityList}>{visibleActivities.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}{data.activities.length > 3 ? <Pressable onPress={() => setShowAllActivities((current) => !current)} style={styles.moreButton}><Text style={styles.moreText}>{showAllActivities ? 'Son 3 hareketi göster' : 'Tüm hareketleri gör'}</Text><Ionicons name={showAllActivities ? 'chevron-up' : 'chevron-forward'} size={16} color={colors.primary} /></Pressable> : null}</View> : <Text style={styles.empty}>Henüz puan veya yorum hareketi yok.</Text>}</Section>
    <Section title="İzledikleri" count={data.library.length}>{visibleLibrary.length ? <View style={styles.library}>{visibleLibrary.map((item) => { const score = ratingByTarget.get(`media:${item.media.type}:${item.media.id}`); const next = item.progress?.nextEpisode; return <Pressable key={`${item.media.type}-${item.media.id}`} onPress={() => openMedia(item.media)} style={styles.item}><Image source={{ uri: item.media.posterUrl }} style={styles.poster} /><View style={styles.itemCopy}><Text numberOfLines={1} style={styles.itemTitle}>{item.media.title}</Text><Text style={styles.itemMeta}>{statusText[item.status]}{item.progress ? ` · ${item.progress.watched}/${item.progress.total}` : ''}{next ? ` · Kaldığı yer S${next.season} B${next.episode}` : ''}</Text></View>{score ? <View style={styles.score}><Ionicons name="star" size={12} color={colors.warning} /><Text style={styles.scoreText}>{score}</Text></View> : null}</Pressable>; })}{alphabeticalLibrary.length > 10 ? <Pressable onPress={() => setVisibleLibraryCount((current) => current >= alphabeticalLibrary.length ? 10 : Math.min(current + 10, alphabeticalLibrary.length))} style={styles.moreButton}><Text style={styles.moreText}>{visibleLibraryCount >= alphabeticalLibrary.length ? 'İlk 10 yapımı göster' : `10 yapım daha göster · ${alphabeticalLibrary.length - visibleLibraryCount} kaldı`}</Text><Ionicons name={visibleLibraryCount >= alphabeticalLibrary.length ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} /></Pressable> : null}</View> : <Text style={styles.empty}>Henüz izleme aktivitesi yok.</Text>}</Section>
  </Screen>;
}

function openMedia(media: NonNullable<ProfileActivity['media']>) { router.push({ pathname: '/media/[id]', params: { id: String(media.id), data: JSON.stringify(media) } }); }

function ActivityRow({ activity }: { activity: ProfileActivity }) {
  const target = parseReviewTarget(activity.targetKey);
  const episode = target?.targetType === 'episode' ? ` · S${target.seasonNumber} B${target.episodeNumber}` : '';
  const targetTitle = `${activity.media?.title ?? 'Bir yapım'}${episode}`;
  const date = new Date(activity.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  return <Pressable disabled={!activity.media} onPress={() => activity.media && openMedia(activity.media)} style={styles.activity}>
    <View style={[styles.activityIcon, activity.kind === 'rating' ? styles.ratingIcon : styles.commentIcon]}><Ionicons name={activity.kind === 'rating' ? 'star' : 'chatbubble-ellipses'} size={16} color={activity.kind === 'rating' ? colors.warning : colors.secondary} /></View>
    <View style={styles.activityCopy}><Text style={styles.activityAction}>{activity.kind === 'rating' ? <><Text style={styles.activityTarget}>{targetTitle}</Text> yapımına <Text style={styles.activityScore}>{activity.score}/10</Text> puan verdi</> : <><Text style={styles.activityTarget}>{targetTitle}</Text> için yorum yaptı</>}</Text>{activity.comment ? <Text numberOfLines={3} style={styles.activityComment}>“{activity.comment}”</Text> : null}<Text style={styles.activityDate}>{date}</Text></View>
    {activity.media ? <Ionicons name="chevron-forward" size={16} color={colors.muted} /> : null}
  </Pressable>;
}

function Header() { return <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>; }
function Stat({ value, label }: { value: number | string; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.count}>{count}</Text></View>{children}</View>; }

const styles = StyleSheet.create({
  hero: { height: 210, backgroundColor: colors.elevated }, back: { position: 'absolute', left: spacing.lg, top: 8, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(15,15,19,.75)', alignItems: 'center', justifyContent: 'center', zIndex: 2 }, identity: { alignItems: 'center', marginTop: -52, paddingHorizontal: spacing.lg }, avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: colors.background }, avatarFallback: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: colors.background, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, initials: { color: '#fff', fontSize: 28, fontWeight: '900' }, name: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: spacing.sm }, username: { color: colors.muted, marginTop: 3 }, stats: { flexDirection: 'row', margin: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, stat: { flex: 1, alignItems: 'center' }, statValue: { color: colors.text, fontSize: 20, fontWeight: '900' }, statLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 3 }, section: { marginTop: spacing.lg }, sectionHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md }, sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, count: { color: colors.primary, fontSize: 11, fontWeight: '800' }, horizontal: { paddingHorizontal: spacing.lg }, empty: { color: colors.muted, fontSize: 12, paddingHorizontal: spacing.lg }, library: { marginHorizontal: spacing.lg, gap: spacing.sm }, item: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, poster: { width: 50, height: 72, borderRadius: radius.sm, backgroundColor: colors.elevated }, itemCopy: { flex: 1, paddingHorizontal: spacing.md }, itemTitle: { color: colors.text, fontWeight: '800', fontSize: 13 }, itemMeta: { color: colors.muted, fontSize: 10, marginTop: 5 }, score: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(248,193,92,.1)', borderRadius: radius.pill }, scoreText: { color: colors.warning, fontWeight: '900', fontSize: 11 }, activityList: { marginHorizontal: spacing.lg, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, activity: { minHeight: 76, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }, activityIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, ratingIcon: { backgroundColor: 'rgba(248,193,92,.11)' }, commentIcon: { backgroundColor: 'rgba(124,92,252,.12)' }, activityCopy: { flex: 1 }, activityAction: { color: colors.muted, fontSize: 11, lineHeight: 16 }, activityTarget: { color: colors.text, fontWeight: '900' }, activityScore: { color: colors.warning, fontWeight: '900' }, activityComment: { color: '#D2D0D5', fontSize: 12, lineHeight: 17, marginTop: 5 }, activityDate: { color: colors.muted, fontSize: 9, marginTop: 6 }, moreButton: { minHeight: 46, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: 'rgba(255,90,71,.06)', borderRadius: radius.md }, moreText: { color: colors.primary, fontSize: 11, fontWeight: '900' }, state: { color: colors.muted, textAlign: 'center', marginTop: 120 }, stateBox: { alignItems: 'center', marginTop: 120, gap: spacing.sm },
});
