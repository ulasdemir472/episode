import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchAcceptedFriendProfiles, PublicProfile } from '@/features/friends/friends-repository';
import { colors, radius, spacing } from '@/theme/tokens';

export function ProfileConnections({ profileId, language = 'tr' }: { profileId: string; language?: 'tr' | 'en' }) {
  const en = language === 'en';
  const query = useQuery({ queryKey: ['friend-connections', profileId], queryFn: () => fetchAcceptedFriendProfiles(profileId), staleTime: 15_000 });
  const friends = query.data ?? [];
  return <View style={styles.root}>
    <View style={styles.header}><Text style={styles.kicker}>{en ? 'NETWORK' : 'ÇEVRE'}</Text><Text style={styles.title}>{en ? 'Friend network' : 'Arkadaş ağı'}</Text></View>
    <View style={styles.counts}><Count value={friends.length} label={en ? 'Followers' : 'Takipçi'} /><View style={styles.divider} /><Count value={friends.length} label={en ? 'Following' : 'Takip edilen'} /></View>
    <ConnectionList title={en ? 'Followers' : 'Takipçiler'} profiles={friends} empty={en ? 'No friends yet.' : 'Henüz arkadaşı yok.'} />
    <ConnectionList title={en ? 'Following' : 'Takip ettikleri'} profiles={friends} empty={en ? 'No friends yet.' : 'Henüz arkadaşı yok.'} />
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
  header: { alignItems: 'flex-start' }, kicker: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  counts: { flexDirection: 'row', marginTop: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.elevated }, count: { flex: 1, alignItems: 'center' }, countValue: { color: colors.text, fontSize: 18, fontWeight: '900' }, countLabel: { color: colors.muted, fontSize: 9, marginTop: 2 }, divider: { width: 1, backgroundColor: colors.border },
  group: { marginTop: spacing.md }, groupTitle: { color: colors.text, fontSize: 11, fontWeight: '900', marginBottom: spacing.sm }, people: { gap: spacing.sm }, person: { width: 72, alignItems: 'center' }, avatar: { width: 46, height: 46, borderRadius: 23 }, avatarFallback: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border }, initial: { color: colors.text, fontWeight: '900' }, name: { color: colors.text, fontSize: 9, fontWeight: '800', marginTop: 5, maxWidth: 72 }, username: { color: colors.muted, fontSize: 8, marginTop: 1, maxWidth: 72 }, empty: { color: colors.muted, fontSize: 10, paddingVertical: 4 },
});
