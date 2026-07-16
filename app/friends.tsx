import { useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MotionPressable } from '@/components/MotionPressable';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchFriendships, Friendship, PublicProfile, removeFriendship, respondFriendRequest, searchProfiles, sendFriendRequest } from '@/features/friends/friends-repository';
import { colors, radius, spacing } from '@/theme/tokens';

type Row = { kind: 'header'; id: string; title: string } | { kind: 'friend'; id: string; friendship: Friendship } | { kind: 'empty'; id: string; text: string };

export default function FriendsScreen() {
  const auth = useAuth();
  const userId = auth.user?.id;
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const friendships = useQuery({ queryKey: ['friends', userId], queryFn: () => fetchFriendships(userId!), enabled: Boolean(userId), staleTime: 10_000 });
  const found = useQuery({ queryKey: ['profile-search', userId, search], queryFn: () => searchProfiles(search, userId!), enabled: Boolean(userId && search.trim().length >= 2), staleTime: 5_000 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['friends', userId] });
  const send = useMutation({ mutationFn: (target: string) => sendFriendRequest(userId!, target), onSuccess: refresh, onError: () => Alert.alert('İstek gönderilemedi', 'Daha sonra tekrar dene.') });
  const respond = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) => respondFriendRequest(id, status), onSuccess: refresh });
  const remove = useMutation({ mutationFn: removeFriendship, onSuccess: refresh });
  const rows = friendships.data ?? [];
  const incoming = rows.filter((item) => item.direction === 'incoming');
  const accepted = rows.filter((item) => item.direction === 'friend');
  const outgoing = rows.filter((item) => item.direction === 'outgoing');
  const relationshipByProfile = new Map(rows.map((item) => [item.profile.id, item]));
  const list: Row[] = [
    ...section('Gelen istekler', 'incoming', incoming, 'Yeni istek yok.'),
    ...section('Arkadaşlarım', 'accepted', accepted, 'Henüz arkadaşın yok.'),
    ...section('Gönderilen istekler', 'outgoing', outgoing, 'Bekleyen isteğin yok.'),
  ];

  if (!userId) return <View style={styles.root}><Header /><View style={styles.center}><Text style={styles.empty}>Arkadaşlarını görmek için giriş yapmalısın.</Text><MotionPressable onPress={() => router.push('/auth' as Href)} style={styles.primary}><Text style={styles.primaryText}>Giriş yap</Text></MotionPressable></View></View>;

  return <View style={styles.root}>
    <Header />
    <View style={styles.searchWrap}><Ionicons name="search" size={18} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} autoCapitalize="none" placeholder="Kullanıcı adı veya isim ara" placeholderTextColor={colors.muted} style={styles.search} /></View>
    {search.trim().length >= 2 && <View style={styles.results}>{found.isLoading ? <Text style={styles.empty}>Aranıyor…</Text> : found.data?.length ? found.data.map((profile) => {
      const relationship = relationshipByProfile.get(profile.id);
      if (relationship?.direction === 'friend') return <ProfileRow key={profile.id} profile={profile} onPress={() => router.push(`/profile/${profile.id}` as Href)} action={<View style={styles.relationBadge}><Ionicons name="checkmark" size={13} color={colors.success} /><Text style={styles.relationText}>Arkadaşın</Text></View>} />;
      if (relationship?.direction === 'outgoing') return <ProfileRow key={profile.id} profile={profile} onPress={() => router.push(`/profile/${profile.id}` as Href)} action={<View style={styles.relationBadge}><Text style={styles.relationText}>İstek gönderildi</Text></View>} />;
      if (relationship?.direction === 'incoming') return <ProfileRow key={profile.id} profile={profile} onPress={() => router.push(`/profile/${profile.id}` as Href)} action={<MotionPressable disabled={respond.isPending} onPress={() => respond.mutate({ id: relationship.id, status: 'accepted' })} style={styles.primarySmall}><Text style={styles.primarySmallText}>Kabul et</Text></MotionPressable>} />;
      return <ProfileRow key={profile.id} profile={profile} onPress={() => router.push(`/profile/${profile.id}` as Href)} action={<MotionPressable disabled={send.isPending} onPress={() => send.mutate(profile.id)} style={styles.primarySmall}><Text style={styles.primarySmallText}>Ekle</Text></MotionPressable>} />;
    }) : <Text style={styles.empty}>Kullanıcı bulunamadı.</Text>}</View>}
    {friendships.isError ? <Text style={styles.error}>Arkadaşlar yüklenemedi. Yeni migration’ı çalıştırıp tekrar dene.</Text> : <FlatList data={list} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => item.kind === 'header' ? <Text style={styles.section}>{item.title}</Text> : item.kind === 'empty' ? <Text style={styles.emptyRow}>{item.text}</Text> : <FriendRow row={item.friendship} onRespond={(status) => respond.mutate({ id: item.friendship.id, status })} onRemove={() => remove.mutate(item.friendship.id)} />} />}
  </View>;
}

function section(title: string, key: string, rows: Friendship[], empty: string): Row[] { const emptyRow: Row = { kind: 'empty', id: `e-${key}`, text: empty }; return [{ kind: 'header', id: `h-${key}`, title }, ...(rows.length ? rows.map((friendship): Row => ({ kind: 'friend', id: friendship.id, friendship })) : [emptyRow])]; }
function Header() { return <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable><View><Text style={styles.kicker}>SOSYAL</Text><Text style={styles.title}>Arkadaşlar</Text></View></View>; }
function FriendRow({ row, onRespond, onRemove }: { row: Friendship; onRespond: (status: 'accepted' | 'declined') => void; onRemove: () => void }) {
  const action = row.direction === 'incoming' ? <View style={styles.actions}><MotionPressable onPress={() => onRespond('accepted')} style={styles.primarySmall}><Text style={styles.primarySmallText}>Kabul</Text></MotionPressable><MotionPressable onPress={() => onRespond('declined')} style={styles.ghost}><Text style={styles.ghostText}>Reddet</Text></MotionPressable></View> : row.direction === 'outgoing' ? <MotionPressable onPress={onRemove} style={styles.ghost}><Text style={styles.ghostText}>İptal</Text></MotionPressable> : <View style={styles.actions}><Ionicons name="chevron-forward" size={18} color={colors.muted} /><MotionPressable onPress={onRemove} style={styles.remove}><Ionicons name="person-remove-outline" size={15} color={colors.primary} /></MotionPressable></View>;
  return <ProfileRow profile={row.profile} onPress={row.direction === 'friend' ? () => router.push(`/profile/${row.profile.id}` as Href) : undefined} action={action} />;
}
function ProfileRow({ profile, action, onPress }: { profile: PublicProfile; action: React.ReactNode; onPress?: () => void }) {
  const initials = `${profile.firstName[0] ?? profile.username[0] ?? 'E'}${profile.lastName[0] ?? ''}`.toUpperCase();
  return <Pressable disabled={!onPress} onPress={onPress} style={styles.row}><View style={styles.person}>{profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.initials}>{initials}</Text></View>}<View style={styles.copy}><Text style={styles.name}>{`${profile.firstName} ${profile.lastName}`.trim() || 'Episode'}</Text>{profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}</View></View>{action}</Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 54 }, header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }, back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, kicker: { color: colors.primary, fontSize: 9, letterSpacing: 1.5, fontWeight: '900' }, title: { color: colors.text, fontSize: 28, fontWeight: '900' }, searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md }, search: { flex: 1, height: 48, color: colors.text, paddingHorizontal: spacing.sm }, results: { margin: spacing.lg, marginBottom: 0, padding: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md }, list: { paddingHorizontal: spacing.lg, paddingBottom: 50 }, section: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: spacing.lg, marginBottom: spacing.sm }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 66, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }, person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, avatar: { width: 44, height: 44, borderRadius: 22 }, avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, initials: { color: colors.text, fontWeight: '900' }, copy: { flex: 1 }, name: { color: colors.text, fontSize: 13, fontWeight: '800' }, username: { color: colors.muted, fontSize: 10, marginTop: 3 }, actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, primarySmall: { backgroundColor: colors.primary, paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill }, primarySmallText: { color: '#fff', fontSize: 10, fontWeight: '900' }, ghost: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill }, ghostText: { color: colors.muted, fontSize: 10, fontWeight: '800' }, remove: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,90,71,.1)', alignItems: 'center', justifyContent: 'center' }, empty: { color: colors.muted, fontSize: 12 }, emptyRow: { color: colors.muted, fontSize: 11, paddingVertical: spacing.md }, error: { color: colors.primary, margin: spacing.lg }, center: { alignItems: 'center', marginTop: 100, gap: spacing.lg }, primary: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 12 }, primaryText: { color: '#fff', fontWeight: '900' },
  relationBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(101,214,166,.1)' }, relationText: { color: colors.success, fontSize: 9, fontWeight: '800' },
});
