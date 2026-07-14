import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MotionPressable } from '@/components/MotionPressable';
import { PublicProfile } from '@/features/friends/friends-repository';
import { fetchFollowConnections, setFollowing } from '@/features/follows/follows-repository';
import { colors, radius, spacing } from '@/theme/tokens';

export function ProfileConnections({ profileId, currentUserId, language = 'tr' }: { profileId: string; currentUserId?: string; language?: 'tr' | 'en' }) {
  const en = language === 'en';
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['follow-connections', profileId, currentUserId], queryFn: () => fetchFollowConnections(profileId, currentUserId), staleTime: 15_000 });
  const connection = query.data;
  const mutation = useMutation({
    mutationFn: () => setFollowing(currentUserId!, profileId, Boolean(connection?.isFollowing)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['follow-connections'] }),
    onError: () => Alert.alert(en ? 'Could not update' : 'Takip durumu güncellenemedi', en ? 'Please try again shortly.' : 'Kısa süre sonra tekrar dene.'),
  });
  const showAction = Boolean(currentUserId && currentUserId !== profileId);
  return <View style={styles.root}>
    <View style={styles.header}>
      <View><Text style={styles.kicker}>{en ? 'NETWORK' : 'ÇEVRE'}</Text><Text style={styles.title}>{en ? 'Followers' : 'Takip ağı'}</Text></View>
      {showAction ? <MotionPressable disabled={mutation.isPending || query.isLoading} onPress={() => mutation.mutate()} style={[styles.follow, connection?.isFollowing && styles.following]}><Ionicons name={connection?.isFollowing ? 'checkmark' : 'person-add-outline'} size={15} color={connection?.isFollowing ? colors.success : '#fff'} /><Text style={[styles.followText, connection?.isFollowing && styles.followingText]}>{connection?.isFollowing ? (en ? 'Following' : 'Takip ediliyor') : (en ? 'Follow' : 'Takip et')}</Text></MotionPressable> : null}
    </View>
    <View style={styles.counts}><Count value={connection?.followers.length ?? 0} label={en ? 'Followers' : 'Takipçi'} /><View style={styles.divider} /><Count value={connection?.following.length ?? 0} label={en ? 'Following' : 'Takip edilen'} /></View>
    <ConnectionList title={en ? 'Followers' : 'Takipçiler'} profiles={connection?.followers ?? []} empty={en ? 'No followers yet.' : 'Henüz takipçisi yok.'} />
    <ConnectionList title={en ? 'Following' : 'Takip ettikleri'} profiles={connection?.following ?? []} empty={en ? 'Not following anyone yet.' : 'Henüz kimseyi takip etmiyor.'} />
  </View>;
}

function Count({ value, label }: { value: number; label: string }) { return <View style={styles.count}><Text style={styles.countValue}>{value}</Text><Text style={styles.countLabel}>{label}</Text></View>; }
function ConnectionList({ title, profiles, empty }: { title: string; profiles: PublicProfile[]; empty: string }) {
  return <View style={styles.group}><Text style={styles.groupTitle}>{title}</Text>{profiles.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>{profiles.map((profile) => <ProfileChip key={profile.id} profile={profile} />)}</ScrollView> : <Text style={styles.empty}>{empty}</Text>}</View>;
}
function ProfileChip({ profile }: { profile: PublicProfile }) {
  const name = `${profile.firstName} ${profile.lastName}`.trim() || (profile.username ? `@${profile.username}` : 'Episode');
  const initial = (profile.firstName[0] ?? profile.username[0] ?? 'E').toUpperCase();
  return <Pressable onPress={() => router.push(`/profile/${profile.id}` as Href)} style={styles.person}>{profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initial}>{initial}</Text></View>}<Text numberOfLines={1} style={styles.name}>{name}</Text>{profile.username ? <Text numberOfLines={1} style={styles.username}>@{profile.username}</Text> : null}</Pressable>;
}

const styles = StyleSheet.create({
  root: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, kicker: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  follow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: radius.pill, backgroundColor: colors.primary }, following: { backgroundColor: 'rgba(101,214,166,.1)', borderWidth: 1, borderColor: 'rgba(101,214,166,.3)' }, followText: { color: '#fff', fontSize: 10, fontWeight: '900' }, followingText: { color: colors.success },
  counts: { flexDirection: 'row', marginTop: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.elevated }, count: { flex: 1, alignItems: 'center' }, countValue: { color: colors.text, fontSize: 18, fontWeight: '900' }, countLabel: { color: colors.muted, fontSize: 9, marginTop: 2 }, divider: { width: 1, backgroundColor: colors.border },
  group: { marginTop: spacing.md }, groupTitle: { color: colors.text, fontSize: 11, fontWeight: '900', marginBottom: spacing.sm }, people: { gap: spacing.sm }, person: { width: 72, alignItems: 'center' }, avatar: { width: 46, height: 46, borderRadius: 23 }, avatarFallback: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border }, initial: { color: colors.text, fontWeight: '900' }, name: { color: colors.text, fontSize: 9, fontWeight: '800', marginTop: 5, maxWidth: 72 }, username: { color: colors.muted, fontSize: 8, marginTop: 1, maxWidth: 72 }, empty: { color: colors.muted, fontSize: 10, paddingVertical: 4 },
});
