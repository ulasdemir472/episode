import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ChoicePicker } from '@/components/ChoicePicker';
import { ContentTransition } from '@/components/ContentTransition';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchFriendships } from '@/features/friends/friends-repository';
import { addWheelEntry, createSharedWatchlist, deleteSharedWatchlist, fetchSharedListMemberIds, fetchWatchWheels, fetchWheelEntries, inviteSharedListMembers, removeWheelEntry, setSharedEntryWatched } from '@/features/watch-wheel/watch-wheel-repository';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { supabase } from '@/infrastructure/supabase/client';
import { catalogService } from '@/services/tmdb';
import { useProfileStore } from '@/store/profile-store';
import { Media } from '@/domain/media';
import { t } from '@/i18n/strings';
import { colors, radius, spacing } from '@/theme/tokens';

export default function SharedListsScreen() {
  const { user } = useAuth();
  const language = useProfileStore((state) => state.language);
  const en = language === 'en';
  const params = useLocalSearchParams<{ id?: string }>();
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState(params.id);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [inviting, setInviting] = useState(false);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 450);
  const lists = useQuery({ queryKey: ['shared-lists', user?.id], queryFn: () => fetchWatchWheels(user!.id, 'list'), enabled: Boolean(user), refetchOnMount: 'always' });
  const active = lists.data?.find((list) => list.id === selectedId) ?? lists.data?.[0];
  const entries = useQuery({ queryKey: ['shared-list-entries', active?.id], queryFn: () => fetchWheelEntries(active!.id), enabled: Boolean(active), refetchOnMount: 'always' });
  const memberships = useQuery({ queryKey: ['shared-list-members', active?.id], queryFn: () => fetchSharedListMemberIds(active!.id), enabled: Boolean(active) });
  const friends = useQuery({ queryKey: ['friends', user?.id], queryFn: () => fetchFriendships(user!.id), enabled: Boolean(user) });
  const candidates = friends.data?.filter((friend) => friend.direction === 'friend' && !memberships.data?.includes(friend.profile.id)) ?? [];
  const found = useQuery({ queryKey: ['shared-list-search', debounced, language], queryFn: () => catalogService.search(debounced, language), enabled: Boolean(active) && !creating && debounced.length >= 2 });
  const error = () => Alert.alert(t(language, 'error'), en ? 'Check your connection and try again.' : 'Bağlantını kontrol edip tekrar dene.');
  const refresh = () => client.invalidateQueries({ queryKey: ['shared-list-entries', active?.id] });
  const create = useMutation({ mutationFn: () => createSharedWatchlist(title, []), onSuccess: async (id) => { await client.invalidateQueries({ queryKey: ['shared-lists', user?.id] }); setSelectedId(id); setCreating(false); setTitle(''); setSearch(''); }, onError: error });
  const add = useMutation({ mutationFn: (media: Media) => addWheelEntry(active!.id, user!.id, media), onSuccess: () => { setSearch(''); return refresh(); }, onError: error });
  const toggle = useMutation({ mutationFn: ({ id, watched }: { id: string; watched: boolean }) => setSharedEntryWatched(id, watched), onSuccess: refresh, onError: error });
  const remove = useMutation({ mutationFn: removeWheelEntry, onSuccess: refresh, onError: error });
  const deleteList = useMutation({ mutationFn: () => deleteSharedWatchlist(active!.id), onSuccess: () => client.invalidateQueries({ queryKey: ['shared-lists', user?.id] }), onError: error });
  const invite = useMutation({ mutationFn: () => inviteSharedListMembers(active!.id, invitedIds), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['shared-list-members', active?.id] }); setInviting(false); setInvitedIds([]); }, onError: error });
  useEffect(() => {
    if (!supabase || !active) return;
    const channel = supabase.channel(`shared-list:${active.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'watch_wheel_entries', filter: `wheel_id=eq.${active.id}` }, () => { void client.invalidateQueries({ queryKey: ['shared-list-entries', active.id] }); }).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [active, client]);
  const header = <>
    <View style={styles.header}><Pressable accessibilityLabel={t(language, 'back')} onPress={() => router.back()} style={styles.iconButton}><Ionicons name="chevron-back" color={colors.text} size={24} /></Pressable><Text style={styles.title}>{en ? 'Shared watchlists' : 'Ortak izleme listeleri'}</Text></View>
    <View style={styles.toolbar}>{Boolean(lists.data?.length) && <ChoicePicker label={en ? 'Watchlist' : 'İzleme listesi'} value={active?.id ?? ''} options={lists.data!.map((list) => ({ value: list.id, label: list.title }))} closeLabel={en ? 'Close' : 'Kapat'} onChange={(id) => { setSelectedId(id); setCreating(false); setSearch(''); }} />}<Pressable onPress={() => setCreating(true)} style={styles.tab}><Text style={styles.buttonText}>+ {en ? 'New list' : 'Yeni liste'}</Text></Pressable></View>
    {!lists.isError && (creating || (!lists.isLoading && !lists.data?.length)) && <View style={styles.panel}>
      <Text style={styles.section}>{en ? 'Create a watchlist' : 'İzleme listesi oluştur'}</Text><Text style={styles.description}>{en ? 'Start on your own. Invite friends whenever you are ready.' : 'Önce kendi listeni oluştur. Arkadaşlarını istediğin zaman davet edebilirsin.'}</Text>
      <TextInput accessibilityLabel={en ? 'List name' : 'Liste adı'} value={title} onChangeText={setTitle} maxLength={80} placeholder={en ? 'Weekend movies' : 'Hafta sonu filmleri'} placeholderTextColor={colors.muted} style={styles.input} />
      <Pressable disabled={!title.trim() || create.isPending} onPress={() => create.mutate()} style={[styles.primary, (!title.trim() || create.isPending) && styles.disabled]}><Text style={styles.buttonText}>{create.isPending ? t(language, 'loading') : (en ? 'Create list' : 'Listeyi oluştur')}</Text></Pressable>
      {creating && active && <Pressable onPress={() => setCreating(false)} style={styles.tab}><Text style={styles.buttonText}>{t(language, 'cancel')}</Text></Pressable>}
    </View>}
    {active && !creating && <View style={styles.panel}>
      <View style={styles.row}><Text style={styles.section}>{active.title}</Text>{active.ownerId === user?.id && <Pressable accessibilityLabel={en ? 'Delete list' : 'Listeyi sil'} onPress={() => Alert.alert(en ? 'Delete this list?' : 'Bu liste silinsin mi?', undefined, [{ text: t(language, 'cancel'), style: 'cancel' }, { text: en ? 'Delete' : 'Sil', style: 'destructive', onPress: () => deleteList.mutate() }])} style={styles.iconButton}><Ionicons name="trash-outline" size={21} color={colors.primary} /></Pressable>}</View>
      <View style={styles.row}><Text style={styles.description}>{memberships.data?.length ?? 1} {en ? 'members' : 'üye'}</Text>{active.ownerId === user?.id && <Pressable accessibilityRole="button" onPress={() => { Keyboard.dismiss(); setInvitedIds([]); setInviting(true); }} style={styles.tab}><Ionicons name="person-add-outline" size={18} color={colors.primary} /><Text style={styles.buttonText}>{en ? 'Invite friends' : 'Arkadaş davet et'}</Text></Pressable>}</View>
      <TextInput accessibilityLabel={en ? 'Add a title' : 'Yapım ekle'} value={search} onChangeText={setSearch} placeholder={en ? 'Search movies and shows…' : 'Film veya dizi ara…'} placeholderTextColor={colors.muted} style={styles.input} />
      {search.trim().length >= 2 && (search.trim() !== debounced || found.isFetching) ? <ActivityIndicator accessibilityLabel={en ? 'Searching' : 'Aranıyor'} color={colors.primary} /> : found.isError ? <Pressable onPress={() => found.refetch()}><Text style={styles.description}>{t(language, 'detailError')} {t(language, 'retry')}</Text></Pressable> : debounced.length >= 2 && search.trim().length >= 2 && <>
        {found.data?.slice(0, 8).map((media) => <Pressable key={`${media.type}:${media.id}`} accessibilityLabel={`${en ? 'Add' : 'Ekle'} ${media.title}`} disabled={add.isPending} onPress={() => add.mutate(media)} style={styles.result}><Text style={styles.resultText}>{media.title} · {media.year}</Text><Ionicons name="add-circle-outline" size={24} color={colors.primary} /></Pressable>)}
        {found.data?.length === 0 && <Text style={styles.description}>{en ? 'No matching titles.' : 'Eşleşen yapım bulunamadı.'}</Text>}
      </>}
    </View>}
  </>;
  return <Screen scroll={false}>
    <FlatList keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" data={creating ? [] : entries.data ?? []} keyExtractor={(item) => item.id} ListHeaderComponent={header} contentContainerStyle={{ paddingBottom: 40 }} refreshing={entries.isRefetching || lists.isRefetching} onRefresh={() => { void lists.refetch(); void memberships.refetch(); if (active) void entries.refetch(); }} ListEmptyComponent={lists.isLoading || entries.isLoading ? <ActivityIndicator color={colors.primary} /> : lists.isError || entries.isError ? <Pressable onPress={() => { void lists.refetch(); if (active) void entries.refetch(); }}><Text style={styles.description}>{t(language, 'detailError')} {t(language, 'retry')}</Text></Pressable> : active && !creating ? <Text style={styles.description}>{en ? 'Add your first title using search.' : 'Aramayı kullanarak ilk yapımını ekle.'}</Text> : null} renderItem={({ item }) => <ContentTransition changeKey={String(item.watched)} style={styles.entry}>
      <Pressable onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(item.media.id), type: item.media.type } })} style={styles.mediaLink}><Image source={{ uri: item.media.posterUrl }} style={styles.poster} /><View style={styles.copy}><Text style={styles.resultText}>{item.media.title}</Text><Text style={styles.meta}>{item.media.year} · {item.watched ? (en ? 'Watched together' : 'Birlikte izlendi') : (en ? 'To watch' : 'İzlenecek')}</Text></View></Pressable>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.watched }} accessibilityLabel={`${item.media.title} ${en ? 'watched together' : 'birlikte izlendi'}`} disabled={toggle.isPending} onPress={() => toggle.mutate({ id: item.id, watched: !item.watched })} style={styles.iconButton}><Ionicons name={item.watched ? 'checkbox' : 'square-outline'} color={item.watched ? colors.success : colors.muted} size={26} /></Pressable>
      {(item.addedBy === user?.id || active?.ownerId === user?.id) && <Pressable accessibilityLabel={en ? 'Remove title' : 'Yapımı kaldır'} disabled={remove.isPending} onPress={() => remove.mutate(item.id)} style={styles.iconButton}><Ionicons name="close" size={21} color={colors.muted} /></Pressable>}
    </ContentTransition>} />
    <Modal visible={inviting} transparent animationType="fade" onRequestClose={() => setInviting(false)}><View style={styles.overlay}><View style={styles.sheet}>
      <View style={styles.row}><Text style={styles.section}>{en ? 'Invite friends' : 'Arkadaş davet et'}</Text><Pressable accessibilityLabel={en ? 'Close invitations' : 'Davetleri kapat'} onPress={() => setInviting(false)} style={styles.iconButton}><Ionicons name="close" color={colors.text} size={24} /></Pressable></View>
      {friends.isLoading || memberships.isLoading ? <ActivityIndicator color={colors.primary} /> : friends.isError || memberships.isError ? <Pressable onPress={() => { void friends.refetch(); void memberships.refetch(); }}><Text style={styles.description}>{t(language, 'retry')}</Text></Pressable> : <FlatList data={candidates} keyExtractor={(friend) => friend.profile.id} ListEmptyComponent={<Text style={styles.description}>{en ? 'No other friends to invite.' : 'Davet edilebilecek başka arkadaşın yok.'}</Text>} renderItem={({ item }) => <Pressable accessibilityRole="checkbox" accessibilityLabel={item.profile.firstName || item.profile.username} accessibilityState={{ checked: invitedIds.includes(item.profile.id) }} onPress={() => setInvitedIds((current) => current.includes(item.profile.id) ? current.filter((id) => id !== item.profile.id) : [...current, item.profile.id])} style={styles.result}><Text style={styles.resultText}>{item.profile.firstName || item.profile.username}</Text><Ionicons name={invitedIds.includes(item.profile.id) ? 'checkbox' : 'square-outline'} size={25} color={colors.primary} /></Pressable>} />}
      <Pressable disabled={!invitedIds.length || invite.isPending} onPress={() => invite.mutate()} style={[styles.primary, (!invitedIds.length || invite.isPending) && styles.disabled]}><Text style={styles.buttonText}>{invite.isPending ? t(language, 'loading') : (en ? 'Send invitations' : 'Davet gönder')}</Text></Pressable>
    </View></View></Modal>
  </Screen>;
}
const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: 8 }, title: { color: colors.text, flex: 1, fontSize: 25, fontWeight: '900' }, toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: spacing.lg, marginBottom: 14 }, panel: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, section: { flexShrink: 1, color: colors.text, fontWeight: '800', fontSize: 18 }, description: { color: colors.muted, fontSize: 13, lineHeight: 20, marginVertical: 9 }, input: { minHeight: 48, borderRadius: radius.sm, backgroundColor: colors.elevated, paddingHorizontal: 12, color: colors.text, marginVertical: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, primary: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: radius.pill, minHeight: 46, marginTop: 12 }, disabled: { opacity: 0.4 }, tab: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.pill, backgroundColor: colors.elevated }, buttonText: { color: colors.text, fontSize: 13, fontWeight: '700' }, result: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 52, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, resultText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' }, entry: { marginHorizontal: spacing.lg, marginBottom: 9, padding: 10, backgroundColor: colors.surface, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center' }, mediaLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, poster: { width: 44, height: 64, borderRadius: radius.sm }, copy: { flex: 1 }, meta: { color: colors.muted, fontSize: 12, marginTop: 5 }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.7)', justifyContent: 'flex-end' }, sheet: { backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: 36, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '75%' } });
