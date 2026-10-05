import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Screen } from '@/components/Screen';
import { MotionPressable } from '@/components/MotionPressable';
import { Media } from '@/domain/media';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchFriendships } from '@/features/friends/friends-repository';
import { addWheelEntry, createWatchWheel, fetchWatchWheels, fetchWheelEntries, removeWheelEntry, saveWheelResult } from '@/features/watch-wheel/watch-wheel-repository';
import { catalogService } from '@/services/tmdb';
import { supabase } from '@/infrastructure/supabase/client';
import { colors, radius, spacing } from '@/theme/tokens';

const wheelColors = ['#FF4D8D', '#FF7A45', '#FFD166', '#55D6BE', '#4D96FF', '#7C5CFC', '#B967FF', '#FF5A47'];

export default function WatchWheelScreen() {
  const auth = useAuth();
  const userId = auth.user?.id;
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [winner, setWinner] = useState<Media>();
  const [rotation] = useState(() => new Animated.Value(0));
  const wheelChannel = useRef<RealtimeChannel | null>(null);

  const wheels = useQuery({ queryKey: ['watch-wheels', userId], queryFn: () => fetchWatchWheels(userId!), enabled: Boolean(userId), refetchOnMount: 'always' });
  const resolvedActiveId = activeId ?? wheels.data?.[0]?.id;
  const activeWheel = wheels.data?.find((wheel) => wheel.id === resolvedActiveId);
  const entries = useQuery({ queryKey: ['watch-wheel-entries', resolvedActiveId], queryFn: () => fetchWheelEntries(resolvedActiveId!), enabled: Boolean(resolvedActiveId), refetchOnMount: 'always' });
  const friends = useQuery({ queryKey: ['friends', userId], queryFn: () => fetchFriendships(userId!), enabled: Boolean(userId) });
  const searchResults = useQuery({ queryKey: ['wheel-media-search', search], queryFn: () => catalogService.search(search), enabled: search.trim().length >= 2, staleTime: 60_000 });

  useEffect(() => {
    if (!supabase || !resolvedActiveId) return undefined;
    const channel = supabase.channel(`watch-wheel:${resolvedActiveId}`)
      .on('broadcast', { event: 'changed' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['watch-wheel-entries', resolvedActiveId] });
        void queryClient.invalidateQueries({ queryKey: ['watch-wheels', userId] });
      })
      .subscribe();
    wheelChannel.current = channel;
    return () => {
      if (wheelChannel.current === channel) wheelChannel.current = null;
      void supabase?.removeChannel(channel);
    };
  }, [queryClient, resolvedActiveId, userId]);

  const announceChange = () => { void wheelChannel.current?.send({ type: 'broadcast', event: 'changed', payload: {} }); };

  const refreshEntries = () => queryClient.invalidateQueries({ queryKey: ['watch-wheel-entries', resolvedActiveId] });
  const createRoom = useMutation({
    mutationFn: () => createWatchWheel(userId!, selectedFriends),
    onSuccess: async (id) => { await queryClient.invalidateQueries({ queryKey: ['watch-wheels', userId] }); setActiveId(id); setCreating(false); setSelectedFriends([]); },
    onError: (error) => Alert.alert('Oda oluşturulamadı', error instanceof Error ? error.message : 'Biraz sonra tekrar dene.'),
  });
  const addEntry = useMutation({ mutationFn: (media: Media) => addWheelEntry(resolvedActiveId!, userId!, media), onSuccess: () => { setSearch(''); refreshEntries(); announceChange(); }, onError: (error) => Alert.alert('Film eklenemedi', error instanceof Error ? error.message : 'Odaya katıldığından emin ol.') });
  const removeEntry = useMutation({ mutationFn: removeWheelEntry, onSuccess: () => { refreshEntries(); announceChange(); } });

  const acceptedFriends = useMemo(() => (friends.data ?? []).filter((item) => item.direction === 'friend'), [friends.data]);
  const spin = () => {
    const choices = entries.data ?? [];
    if (choices.length < 2) return Alert.alert('Çark henüz hazır değil', 'Döndürmek için en az 2 film ekleyin.');
    const pickedIndex = Math.floor(Math.random() * choices.length);
    const picked = choices[pickedIndex]!.media;
    setWinner(undefined);
    rotation.setValue(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    Animated.timing(rotation, { toValue: 5 + (choices.length - pickedIndex) / choices.length, duration: 3600, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setWinner(picked);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      void saveWheelResult(resolvedActiveId!, picked).then(() => { announceChange(); return queryClient.invalidateQueries({ queryKey: ['watch-wheels', userId] }); });
    });
  };

  if (!userId) return <Screen><Header /><View style={styles.centerState}><Text style={styles.stateTitle}>Çarka katılmak için giriş yap</Text></View></Screen>;
  if (wheels.isLoading) return <Screen><Header /><View style={styles.centerState}><Text style={styles.stateTitle}>Oyun masası hazırlanıyor…</Text></View></Screen>;

  const showCreator = creating || !wheels.data?.length;
  return <Screen>
    <Header />
    <View style={styles.intro}><Text style={styles.kicker}>ARKADAŞLARLA FİLM GECESİ</Text><Text style={styles.headline}>Ekle. Döndür. İzle.</Text><Text style={styles.subhead}>Herkes bir film bıraksın, kararı şans versin.</Text></View>
    {showCreator ? <View style={styles.creator}>
      <LinearGradient colors={['rgba(255,77,141,.2)', 'rgba(124,92,252,.12)']} style={styles.creatorGlow} />
      <View style={styles.creatorIcon}><Ionicons name="people" size={23} color="#fff" /></View><Text style={styles.cardTitle}>Film gecesi odası kur</Text><Text style={styles.cardCaption}>Davet ettiğin arkadaşların hepsi aynı çarka film ekleyebilir.</Text>
      <Text style={styles.miniLabel}>KİMLER GELİYOR?</Text>
      {acceptedFriends.length ? <View style={styles.friendGrid}>{acceptedFriends.map((friend) => { const selected = selectedFriends.includes(friend.profile.id); const initials = `${friend.profile.firstName[0] ?? 'E'}${friend.profile.lastName[0] ?? ''}`; return <Pressable key={friend.id} onPress={() => setSelectedFriends((current) => selected ? current.filter((id) => id !== friend.profile.id) : [...current, friend.profile.id])} style={[styles.friendChip, selected && styles.friendChipActive]}>{friend.profile.avatarUrl ? <Image source={{ uri: friend.profile.avatarUrl }} style={styles.friendAvatar} /> : <View style={styles.friendFallback}><Text style={styles.friendInitials}>{initials}</Text></View>}<Text numberOfLines={1} style={[styles.friendName, selected && styles.friendNameActive]}>{friend.profile.firstName || friend.profile.username}</Text>{selected ? <Ionicons name="checkmark-circle" size={17} color="#55D6BE" /> : null}</Pressable>; })}</View> : <Text style={styles.emptyText}>Önce arkadaş ekleyebilir veya odayı tek başına kurabilirsin.</Text>}
      <MotionPressable disabled={createRoom.isPending} onPress={() => createRoom.mutate()} style={styles.createButton}><LinearGradient colors={['#FF4D8D', '#7C5CFC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.createGradient}><Ionicons name="sparkles" size={18} color="#fff" /><Text style={styles.createText}>{createRoom.isPending ? 'Kuruluyor…' : 'Odayı kur'}</Text></LinearGradient></MotionPressable>
      {wheels.data?.length ? <Pressable onPress={() => setCreating(false)}><Text style={styles.cancel}>Vazgeç</Text></Pressable> : null}
    </View> : <>
      <View style={styles.roomBar}><FlatList horizontal data={wheels.data} keyExtractor={(item) => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomList} renderItem={({ item, index }) => <Pressable onPress={() => { setActiveId(item.id); setWinner(undefined); }} style={[styles.roomPill, resolvedActiveId === item.id && styles.roomPillActive]}><View style={[styles.roomDot, { backgroundColor: wheelColors[index % wheelColors.length] }]} /><Text style={[styles.roomText, resolvedActiveId === item.id && styles.roomTextActive]}>{index === 0 ? 'Film gecesi' : `Oda ${wheels.data!.length - index}`}</Text></Pressable>} /><Pressable accessibilityLabel="Yeni oda kur" onPress={() => setCreating(true)} style={styles.newRoom}><Ionicons name="add" size={22} color={colors.text} /></Pressable></View>
      <View style={styles.gameCard}>
        <View style={styles.liveRow}><View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>ORTAK ÇARK</Text></View><Text style={styles.choiceCount}>{entries.data?.length ?? 0} seçenek</Text></View>
        <Wheel entries={entries.data?.map((entry) => entry.media) ?? []} rotation={rotation} />
        <MotionPressable onPress={spin} disabled={(entries.data?.length ?? 0) < 2} style={styles.spinButton}><LinearGradient colors={['#FFD166', '#FF7A45', '#FF4D8D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.spinGradient}><Ionicons name="play" size={19} color="#171019" /><Text style={styles.spinText}>ÇARKI DÖNDÜR</Text></LinearGradient></MotionPressable>
        {winner ? <View style={styles.winner}><Text style={styles.winnerKicker}>🎉 BU GECE</Text><Text style={styles.winnerTitle}>{winner.title}</Text><Pressable onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(winner.id), data: JSON.stringify(winner) } })}><Text style={styles.winnerLink}>Detayları gör →</Text></Pressable></View> : activeWheel?.result ? <Text style={styles.lastResult}>Son seçim: <Text style={styles.lastResultStrong}>{activeWheel.result.title}</Text></Text> : null}
      </View>
      <View style={styles.addCard}><View style={styles.addHead}><View><Text style={styles.cardTitle}>Çarka film ekle</Text><Text style={styles.cardCaption}>İsmini yaz, tek dokunuşla oyuna kat.</Text></View><View style={styles.plusIcon}><Ionicons name="add" size={20} color="#55D6BE" /></View></View><View style={styles.searchWrap}><Ionicons name="search" size={18} color={colors.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Film veya dizi ara…" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>{search.trim().length >= 2 ? <View style={styles.results}>{searchResults.isLoading ? <Text style={styles.emptyText}>Aranıyor…</Text> : searchResults.data?.slice(0, 5).map((media) => <Pressable key={`${media.type}-${media.id}`} onPress={() => addEntry.mutate(media)} style={styles.resultRow}>{media.posterUrl ? <Image source={{ uri: media.posterUrl }} style={styles.resultPoster} /> : <View style={styles.resultPoster} />}<View style={styles.resultCopy}><Text numberOfLines={1} style={styles.resultTitle}>{media.title}</Text><Text style={styles.resultMeta}>{media.year} · {media.type === 'movie' ? 'Film' : 'Dizi'}</Text></View><View style={styles.resultAdd}><Ionicons name="add" size={18} color="#fff" /></View></Pressable>)}</View> : null}</View>
      <View style={styles.entries}><Text style={styles.miniLabel}>ÇARKTAKİLER</Text>{entries.data?.length ? entries.data.map((entry, index) => <View key={entry.id} style={styles.entry}><View style={[styles.entryNumber, { backgroundColor: wheelColors[index % wheelColors.length] }]}><Text style={styles.entryNumberText}>{index + 1}</Text></View>{entry.media.posterUrl ? <Image source={{ uri: entry.media.posterUrl }} style={styles.entryPoster} /> : null}<View style={styles.entryCopy}><Text numberOfLines={1} style={styles.entryTitle}>{entry.media.title}</Text><Text style={styles.entryMeta}>{entry.media.year || 'Yıl yok'} · {entry.media.type === 'movie' ? 'Film' : 'Dizi'}</Text></View>{entry.addedBy === userId || activeWheel?.ownerId === userId ? <Pressable accessibilityLabel={`${entry.media.title} filmini çarktan çıkar`} onPress={() => removeEntry.mutate(entry.id)} style={styles.remove}><Ionicons name="close" size={17} color={colors.muted} /></Pressable> : null}</View>) : <Text style={styles.emptyText}>Henüz film yok. İlk seçeneği sen ekle!</Text>}</View>
    </>}
  </Screen>;
}

function Header() { return <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable><View style={styles.headerMark}><LinearGradient colors={['#FF4D8D', '#7C5CFC']} style={styles.headerIcon}><Ionicons name="color-wand" size={18} color="#fff" /></LinearGradient><Text style={styles.headerTitle}>Film Çarkı</Text></View><View style={styles.headerSpacer} /></View>; }

function Wheel({ entries, rotation }: { entries: Media[]; rotation: Animated.Value }) {
  const choices = entries.length ? entries : [{ title: '?' } as Media];
  const visibleChoices = choices.slice(0, 12);
  const rotate = rotation.interpolate({ inputRange: [0, 6], outputRange: ['0deg', '2160deg'] });
  return <View style={styles.wheelStage}><View style={styles.pointer} /><Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}>
    {Array.from({ length: 24 }).map((_, index) => <View key={`ray-${index}`} style={[styles.ray, { backgroundColor: wheelColors[index % wheelColors.length], transform: [{ rotate: `${index * 15}deg` }, { translateX: 46 }] }]} />)}
    {visibleChoices.map((media, index) => <View key={`${media.id ?? index}-${index}`} style={[styles.posterSlot, { borderColor: wheelColors[index % wheelColors.length], transform: [{ rotate: `${index * (360 / visibleChoices.length)}deg` }, { translateY: -70 }] }]}>{media.posterUrl ? <Image source={{ uri: media.posterUrl }} style={styles.wheelPoster} /> : <View style={[styles.posterFallback, { backgroundColor: wheelColors[index % wheelColors.length] }]}><Text style={styles.posterInitial}>{media.title[0] ?? '?'}</Text></View>}</View>)}
    <View style={styles.wheelInner}><View style={styles.centerHub}><Ionicons name={entries.length ? 'shuffle' : 'film'} size={27} color="#fff" /></View></View>
  </Animated.View>{entries.length > 12 ? <Text style={styles.extraChoices}>+{entries.length - 12} seçenek daha</Text> : null}</View>;
}

const styles = StyleSheet.create({
  header: { height: 58, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, headerMark: { flexDirection: 'row', alignItems: 'center', gap: 9 }, headerIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, headerTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, headerSpacer: { width: 40 }, intro: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md }, kicker: { color: '#FF7A9F', fontSize: 9, letterSpacing: 1.7, fontWeight: '900' }, headline: { color: colors.text, fontSize: 36, letterSpacing: -1.4, fontWeight: '900', marginTop: 5 }, subhead: { color: colors.muted, fontSize: 13, marginTop: 5 }, creator: { margin: spacing.lg, marginTop: spacing.sm, padding: spacing.lg, overflow: 'hidden', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,77,141,.25)' }, creatorGlow: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, creatorIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#7C5CFC', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, cardTitle: { color: colors.text, fontSize: 19, fontWeight: '900' }, cardCaption: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 }, miniLabel: { color: colors.muted, fontSize: 9, letterSpacing: 1.4, fontWeight: '900', marginTop: spacing.lg, marginBottom: spacing.sm }, friendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, friendChip: { maxWidth: '48%', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, padding: 6, paddingRight: 11 }, friendChipActive: { borderColor: '#55D6BE', backgroundColor: 'rgba(85,214,190,.1)' }, friendAvatar: { width: 27, height: 27, borderRadius: 14 }, friendFallback: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#7C5CFC', alignItems: 'center', justifyContent: 'center' }, friendInitials: { color: '#fff', fontSize: 9, fontWeight: '900' }, friendName: { maxWidth: 70, color: colors.muted, fontSize: 10, fontWeight: '800' }, friendNameActive: { color: colors.text }, createButton: { marginTop: spacing.xl }, createGradient: { height: 52, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, createText: { color: '#fff', fontWeight: '900' }, cancel: { color: colors.muted, textAlign: 'center', fontSize: 11, fontWeight: '800', paddingTop: spacing.md }, roomBar: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.lg }, roomList: { paddingLeft: spacing.lg, gap: 8 }, roomPill: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, roomPillActive: { borderColor: 'rgba(255,255,255,.35)', backgroundColor: colors.elevated }, roomDot: { width: 8, height: 8, borderRadius: 4 }, roomText: { color: colors.muted, fontSize: 10, fontWeight: '800' }, roomTextActive: { color: colors.text }, newRoom: { width: 38, height: 38, marginLeft: 8, borderRadius: 19, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, gameCard: { margin: spacing.lg, padding: spacing.md, backgroundColor: '#101017', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(124,92,252,.32)', overflow: 'hidden' }, liveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,77,141,.12)' }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF4D8D' }, liveText: { color: '#FF7A9F', fontSize: 8, letterSpacing: 1, fontWeight: '900' }, choiceCount: { color: colors.muted, fontSize: 10, fontWeight: '700' }, wheelStage: { height: 300, alignItems: 'center', justifyContent: 'center' }, pointer: { position: 'absolute', top: 23, zIndex: 3, width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderTopWidth: 23, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#fff' }, wheel: { width: 220, height: 220, borderRadius: 110, overflow: 'hidden', backgroundColor: '#29263A', borderWidth: 6, borderColor: '#F7F5F2', alignItems: 'center', justifyContent: 'center', shadowColor: '#7C5CFC', shadowOpacity: .55, shadowRadius: 18 }, ray: { position: 'absolute', width: 116, height: 28, left: 104, top: 90, borderRadius: 14, opacity: .32 }, posterSlot: { position: 'absolute', width: 36, height: 52, left: 86, top: 78, borderRadius: 7, borderWidth: 2, overflow: 'hidden', backgroundColor: '#17151F' }, wheelPoster: { width: '100%', height: '100%' }, posterFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' }, posterInitial: { color: '#fff', fontWeight: '900', fontSize: 16 }, wheelInner: { width: 68, height: 68, borderRadius: 34, borderWidth: 4, borderColor: '#fff', backgroundColor: '#17151F', alignItems: 'center', justifyContent: 'center' }, centerHub: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#7C5CFC', alignItems: 'center', justifyContent: 'center' }, extraChoices: { position: 'absolute', bottom: 8, color: colors.muted, fontSize: 9, fontWeight: '800' }, spinButton: { marginTop: 2 }, spinGradient: { height: 54, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, spinText: { color: '#171019', letterSpacing: .7, fontWeight: '900' }, winner: { alignItems: 'center', marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(124,92,252,.14)' }, winnerKicker: { color: '#FFD166', fontSize: 9, letterSpacing: 1.3, fontWeight: '900' }, winnerTitle: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 5, textAlign: 'center' }, winnerLink: { color: '#A892FF', fontSize: 11, fontWeight: '800', marginTop: 8 }, lastResult: { color: colors.muted, textAlign: 'center', fontSize: 11, marginTop: spacing.md }, lastResultStrong: { color: colors.text, fontWeight: '900' }, addCard: { marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, addHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, plusIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(85,214,190,.12)', alignItems: 'center', justifyContent: 'center' }, searchWrap: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, height: 48, borderRadius: radius.md, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }, searchInput: { flex: 1, color: colors.text, paddingHorizontal: spacing.sm }, results: { marginTop: spacing.sm }, resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }, resultPoster: { width: 34, height: 48, borderRadius: 6, backgroundColor: colors.elevated }, resultCopy: { flex: 1, paddingHorizontal: spacing.sm }, resultTitle: { color: colors.text, fontSize: 12, fontWeight: '800' }, resultMeta: { color: colors.muted, fontSize: 9, marginTop: 3 }, resultAdd: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#7C5CFC', alignItems: 'center', justifyContent: 'center' }, entries: { marginHorizontal: spacing.lg, paddingBottom: spacing.lg }, entry: { flexDirection: 'row', alignItems: 'center', minHeight: 62, borderBottomWidth: 1, borderBottomColor: colors.border }, entryNumber: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, entryNumberText: { color: '#fff', fontSize: 9, fontWeight: '900' }, entryPoster: { width: 31, height: 44, borderRadius: 6, marginLeft: spacing.sm }, entryCopy: { flex: 1, paddingHorizontal: spacing.sm }, entryTitle: { color: colors.text, fontSize: 12, fontWeight: '800' }, entryMeta: { color: colors.muted, fontSize: 9, marginTop: 3 }, remove: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, emptyText: { color: colors.muted, fontSize: 11, lineHeight: 17 }, centerState: { alignItems: 'center', marginTop: 160 }, stateTitle: { color: colors.muted, fontWeight: '800' },
});
