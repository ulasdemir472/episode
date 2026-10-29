import { useCallback, useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MediaCard } from '@/components/MediaCard';
import { ProfileActivityRow } from '@/components/ProfileActivityRow';
import { ProfileInsights } from '@/components/ProfileInsights';
import { Screen } from '@/components/Screen';
import { WatchLevelBadge } from '@/components/WatchLevelBadge';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchAcceptedFriendProfiles, fetchFriendActivity, ProfileActivity } from '@/features/friends/friends-repository';
import { sameMedia } from '@/domain/media';
import { formatWatchHours, useWatchMinutes } from '@/features/profile/watch-time';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';

const statusTextMap = {
  watching: { en: 'Watching', tr: 'İzliyor' },
  watchlist: { en: 'Watchlist', tr: 'Listesinde' },
  completed: { en: 'Completed', tr: 'Tamamladı' },
  dropped: { en: 'Dropped', tr: 'Bıraktı' },
} as const;

export default function FriendProfileScreen() {
  const en = useProfileStore((state) => state.language) === 'en';
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const ownFavorites = useProfileStore((state) => state.favorites);
  const [libraryPage, setLibraryPage] = useState(0);
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
  if (query.isLoading) return <Screen><Header /><Text style={styles.state}>{en ? 'Loading profile…' : 'Profil yükleniyor…'}</Text></Screen>;
  if (!data) return <Screen><Header /><View style={styles.stateBox}><Ionicons name="lock-closed-outline" size={28} color={colors.muted} /><Text style={styles.state}>{query.error instanceof Error ? query.error.message : (en ? 'Could not open profile.' : 'Profil açılamadı.')}</Text></View></Screen>;
  const profile = data.profile;
  const mutualFavorites = data.favorites.filter((media) => ownFavorites.some((own) => sameMedia(own, media)));
  const name = `${profile.firstName} ${profile.lastName}`.trim() || (profile.username ? `@${profile.username}` : 'Episode');
  const initials = `${profile.firstName[0] ?? profile.username[0] ?? 'E'}${profile.lastName[0] ?? ''}`.toUpperCase();
  const ratingByTarget = new Map(data.ratings.map((rating) => [rating.targetKey, rating.score]));
  const alphabeticalLibrary = [...data.library].sort((left, right) => left.media.title.localeCompare(right.media.title, en ? 'en' : 'tr', { sensitivity: 'base' }));
  const libraryPages = Array.from({ length: Math.ceil(alphabeticalLibrary.length / 10) }, (_, index) => alphabeticalLibrary.slice(index * 10, index * 10 + 10));
  const currentLibraryPage = Math.min(libraryPage, Math.max(0, libraryPages.length - 1));
  const visibleLibrary = libraryPages[currentLibraryPage] ?? [];
  const visibleActivities = data.activities.slice(0, 3);
  return (
    <Screen>
      <View style={styles.hero}>
        <ImageBackground source={profile.coverUrl ? { uri: profile.coverUrl } : undefined} style={StyleSheet.absoluteFill}>
          <LinearGradient colors={['rgba(7,7,10,.12)', colors.background]} style={StyleSheet.absoluteFill} />
        </ImageBackground>
        <Header />
      </View>
      <View style={styles.identity}>
        {profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initials}>{initials}</Text></View>}
        <Text style={styles.name}>{name}</Text>
        {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
      </View>
      {data.historyVisible && <WatchLevelBadge minutes={watchTime.minutes} isLoading={watchTime.isLoading} language={en ? 'en' : 'tr'} />}
      {data.historyVisible && <ProfileInsights library={data.library} episodeRuntimes={data.episodeRuntimes} language={en ? 'en' : 'tr'} />}
      {data.historyVisible && <View style={styles.stats}>
        <Stat value={data.library.length} label={en ? 'Titles' : 'Yapım'} />
        <Stat value={watchTime.isLoading ? '…' : formatWatchHours(watchTime.minutes, en ? 'en' : 'tr')} label={en ? 'Hours' : 'Saat'} />
        <Stat value={data.watchedEpisodeCount} label={en ? 'Episodes' : 'Bölüm'} />
      </View>}
      {!data.historyVisible && <Text style={styles.empty}>{en ? 'This viewing history is private.' : 'Bu izleme geçmişi gizli.'}</Text>}
      {!!mutualFavorites.length && <Section title={en ? 'Favorites you share' : 'Ortak favorileriniz'} count={mutualFavorites.length}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{mutualFavorites.map((media) => <MediaCard key={media.type + ':' + media.id} media={media} width={126} />)}</ScrollView></Section>}
      <FriendProfileFriendsPanel profileId={profile.id} profileName={name} />
      {data.historyVisible && <Section title={en ? 'Favorites' : 'Favorileri'} count={data.favorites.length}>
        {data.favorites.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
            {data.favorites.map((media) => <MediaCard key={`${media.type}-${media.id}`} media={media} width={126} />)}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>{en ? 'No favorites yet.' : 'Henüz favorisi yok.'}</Text>
        )}
      </Section>}
      <Section title={en ? 'Recent activity' : 'Son hareketler'} count={data.activities.length}>
        {visibleActivities.length ? (
          <View style={styles.activityList}>
            {visibleActivities.map((activity) => <ProfileActivityRow key={activity.id} activity={activity} />)}
            {data.activities.length > 3 ? (
              <Pressable onPress={() => router.push({ pathname: '/profile-activities', params: { id: profile.id } } as never)} style={styles.moreButton}>
                <Text style={styles.moreText}>{en ? 'View all activity on separate page' : 'Tüm hareketleri ayrı sayfada gör'}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={styles.empty}>{en ? 'No rating or comment activity yet.' : 'Henüz puan veya yorum hareketi yok.'}</Text>
        )}
      </Section>
      {data.historyVisible && <Section title={en ? 'Watched' : 'İzledikleri'} count={data.library.length}>
        {visibleLibrary.length ? (
          <View style={styles.library}>
            {visibleLibrary.map((item) => {
              const score = ratingByTarget.get(`media:${item.media.type}:${item.media.id}`);
              const next = item.progress?.nextEpisode;
              const statusLabel = statusTextMap[item.status][en ? 'en' : 'tr'];
              return (
                <Pressable key={`${item.media.type}-${item.media.id}`} onPress={() => openMedia(item.media)} style={styles.item}>
                  <Image source={{ uri: item.media.posterUrl }} style={styles.poster} />
                  <View style={styles.itemCopy}>
                    <Text numberOfLines={1} style={styles.itemTitle}>{item.media.title}</Text>
                    <Text style={styles.itemMeta}>
                      {statusLabel}
                      {item.progress ? ` · ${item.progress.watched}/${item.progress.total}` : ''}
                      {next ? ` · ${en ? `At S${next.season} E${next.episode}` : `Kaldığı yer S${next.season} B${next.episode}`}` : ''}
                    </Text>
                  </View>
                  {score ? (
                    <View style={styles.score}>
                      <Ionicons name="star" size={12} color={colors.warning} />
                      <Text style={styles.scoreText}>{score}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
            {libraryPages.length > 1 ? (
              <View style={styles.pagination}>
                <Pressable
                  disabled={currentLibraryPage === 0}
                  onPress={() => setLibraryPage(currentLibraryPage - 1)}
                  style={[styles.pageButton, currentLibraryPage === 0 && styles.pageButtonDisabled]}
                >
                  <Ionicons name="chevron-back" size={17} color={currentLibraryPage === 0 ? colors.muted : colors.text} />
                  <Text style={[styles.pageButtonText, currentLibraryPage === 0 && styles.pageButtonTextDisabled]}>{en ? 'Previous' : 'Önceki'}</Text>
                </Pressable>
                <Text style={styles.pageCount}>{currentLibraryPage + 1} / {libraryPages.length}</Text>
                <Pressable
                  disabled={currentLibraryPage === libraryPages.length - 1}
                  onPress={() => setLibraryPage(currentLibraryPage + 1)}
                  style={[styles.pageButton, currentLibraryPage === libraryPages.length - 1 && styles.pageButtonDisabled]}
                >
                  <Text style={[styles.pageButtonText, currentLibraryPage === libraryPages.length - 1 && styles.pageButtonTextDisabled]}>{en ? 'Next' : 'Sonraki'}</Text>
                  <Ionicons name="chevron-forward" size={17} color={currentLibraryPage === libraryPages.length - 1 ? colors.muted : colors.text} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.empty}>{en ? 'No watch activity yet.' : 'Henüz izleme aktivitesi yok.'}</Text>
        )}
      </Section>}
    </Screen>
  );
}

function openMedia(media: NonNullable<ProfileActivity['media']>) { router.push({ pathname: '/media/[id]', params: { id: String(media.id), data: JSON.stringify(media) } }); }

function Header() { return <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>; }
function Stat({ value, label }: { value: number | string; label: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function FriendProfileFriendsPanel({ profileId, profileName }: { profileId: string; profileName: string }) {
  const en = useProfileStore((state) => state.language) === 'en';
  const friends = useQuery({ queryKey: ['friend-connections', profileId], queryFn: () => fetchAcceptedFriendProfiles(profileId), staleTime: 15_000 });
  return (
    <Pressable onPress={() => router.push({ pathname: '/friends', params: { profileId, profileName } } as never)} style={styles.friendsPanel}>
      <View style={styles.friendsShortcut}>
        <View style={styles.friendsTitle}>
          <Ionicons name="people-outline" size={18} color={colors.primary} />
          <View>
            <Text style={styles.friendsHeading}>{en ? 'Friends' : 'Arkadaşlar'}</Text>
            <Text style={styles.friendsDetail}>
              {friends.isLoading
                ? (en ? 'Loading…' : 'Yükleniyor…')
                : (en ? `${friends.data?.length ?? 0} friends · View list` : `${friends.data?.length ?? 0} arkadaş · Listeyi gör`)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </View>
    </Pressable>
  );
}
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.count}>{count}</Text></View>{children}</View>; }

const styles = StyleSheet.create({
  friendsPanel: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, friendsShortcut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, friendsTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, friendsHeading: { color: colors.text, fontSize: 17, fontWeight: '800' }, friendsDetail: { color: colors.muted, fontSize: 12, marginTop: 3 },
  hero: { height: 210, backgroundColor: colors.elevated }, back: { position: 'absolute', left: spacing.lg, top: 8, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(15,15,19,.75)', alignItems: 'center', justifyContent: 'center', zIndex: 2 }, identity: { alignItems: 'center', marginTop: -52, paddingHorizontal: spacing.lg }, avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: colors.background }, avatarFallback: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: colors.background, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, initials: { color: '#fff', fontSize: 28, fontWeight: '900' }, name: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: spacing.sm }, username: { color: colors.muted, marginTop: 3 }, stats: { flexDirection: 'row', margin: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, stat: { flex: 1, alignItems: 'center' }, statValue: { color: colors.text, fontSize: 20, fontWeight: '900' }, statLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 3 }, section: { marginTop: spacing.lg }, sectionHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md }, sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, count: { color: colors.primary, fontSize: 11, fontWeight: '800' }, horizontal: { paddingHorizontal: spacing.lg }, empty: { color: colors.muted, fontSize: 12, paddingHorizontal: spacing.lg }, library: { marginHorizontal: spacing.lg, gap: spacing.sm }, pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }, pageButton: { minWidth: 104, height: 42, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, pageButtonDisabled: { opacity: .45 }, pageButtonText: { color: colors.text, fontSize: 11, fontWeight: '800' }, pageButtonTextDisabled: { color: colors.muted }, pageCount: { color: colors.muted, fontSize: 11, fontWeight: '800' }, item: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, poster: { width: 50, height: 72, borderRadius: radius.sm, backgroundColor: colors.elevated }, itemCopy: { flex: 1, paddingHorizontal: spacing.md }, itemTitle: { color: colors.text, fontWeight: '800', fontSize: 13 }, itemMeta: { color: colors.muted, fontSize: 10, marginTop: 5 }, score: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(248,193,92,.1)', borderRadius: radius.pill }, scoreText: { color: colors.warning, fontWeight: '900', fontSize: 11 }, activityList: { marginHorizontal: spacing.lg, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, moreButton: { minHeight: 46, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: 'rgba(255,90,71,.06)', borderRadius: radius.md }, moreText: { color: colors.primary, fontSize: 11, fontWeight: '900' }, state: { color: colors.muted, textAlign: 'center', marginTop: 120 }, stateBox: { alignItems: 'center', marginTop: 120, gap: spacing.sm },
});
