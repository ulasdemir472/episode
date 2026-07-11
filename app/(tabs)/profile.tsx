import { useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { MotionPressable } from '@/components/MotionPressable';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchFriendships, Friendship, removeFriendship, respondFriendRequest, searchProfiles, sendFriendRequest } from '@/features/friends/friends-repository';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const profile = useProfileStore();
  const auth = useAuth();
  const library = useLibraryStore((state) => state.items);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [username, setUsername] = useState(profile.username);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '');
  const isEnglish = profile.language === 'en';
  const availableMedia = [...profile.favorites, ...library.map((item) => item.media)].filter((media, index, all) => all.findIndex((item) => item.id === media.id && item.type === media.type) === index);
  const initials = `${profile.firstName[0] ?? 'E'}${profile.lastName[0] ?? ''}`.toUpperCase();

  const saveProfile = () => {
    profile.setProfileDetails({ firstName, lastName, username, avatarUrl });
    Alert.alert(isEnglish ? 'Saved' : 'Kaydedildi', isEnglish ? 'Your profile will sync shortly.' : 'Profilin kisa sure icinde senkronize olacak.');
  };

  return <Screen>
    <ImageBackground source={profile.coverUrl ? { uri: profile.coverUrl } : undefined} style={styles.cover}>
      <LinearGradient colors={['rgba(7,7,10,.1)', colors.background]} style={StyleSheet.absoluteFill} />
    </ImageBackground>

    <View style={styles.profileHead}>
      <View style={styles.avatar}>{profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials}</Text>}</View>
      <Text style={styles.name}>{profile.firstName || profile.lastName ? `${profile.firstName} ${profile.lastName}`.trim() : isEnglish ? 'Your profile' : 'Profilin'}</Text>
      <Text style={styles.stats}>{profile.username ? `@${profile.username} · ` : ''}{profile.favorites.length} {isEnglish ? 'favorites' : 'favori'} · {library.length} {isEnglish ? 'in library' : 'listede'}</Text>
    </View>

    <View style={styles.accountPanel}>
      <View style={styles.accountInfo}>
        <Ionicons name={auth.user ? auth.syncStatus === 'error' ? 'cloud-offline-outline' : 'cloud-done-outline' : 'cloud-offline-outline'} size={21} color={auth.user ? auth.syncStatus === 'error' ? colors.primary : colors.success : colors.warning} />
        <View style={styles.accountCopy}>
          <Text style={styles.accountTitle}>{auth.user ? (isEnglish ? 'Account connected' : 'Hesap bagli') : (isEnglish ? 'Local profile' : 'Yerel profil')}</Text>
          <Text style={styles.accountDetail}>{auth.user?.email ?? (isEnglish ? 'Sign in to sync across devices.' : 'Cihazlar arasi senkronizasyon icin giris yap.')}</Text>
          {auth.user && <Text style={[styles.syncStatus, auth.syncStatus === 'error' && styles.syncError]}>{auth.syncStatus === 'syncing' ? (isEnglish ? 'Syncing...' : 'Senkronize ediliyor...') : auth.syncStatus === 'error' ? (auth.syncError ?? (isEnglish ? 'Sync failed' : 'Senkronizasyon basarisiz')) : (isEnglish ? 'Synced' : 'Senkronize')}</Text>}
        </View>
      </View>
      {auth.user ? <MotionPressable onPress={() => auth.signOut()} style={styles.accountAction}><Text style={styles.accountActionText}>{isEnglish ? 'Sign out' : 'Cikis yap'}</Text></MotionPressable> : <MotionPressable onPress={() => router.push('/auth' as Href)} style={[styles.accountAction, styles.accountActionPrimary]}><Text style={styles.accountActionPrimaryText}>{isEnglish ? 'Sign in' : 'Giris yap'}</Text></MotionPressable>}
    </View>

    <View style={styles.panel}>
      <View style={styles.panelTitle}><Ionicons name="person-outline" size={18} color={colors.primary} /><Text style={styles.heading}>{isEnglish ? 'Profile details' : 'Profil bilgileri'}</Text></View>
      <View style={styles.inputs}><TextInput value={firstName} onChangeText={setFirstName} placeholder={isEnglish ? 'First name' : 'Ad'} placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={lastName} onChangeText={setLastName} placeholder={isEnglish ? 'Last name' : 'Soyad'} placeholderTextColor={colors.muted} style={styles.input} /></View>
      <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder={isEnglish ? 'Username' : 'Kullanici adi'} placeholderTextColor={colors.muted} style={styles.inputFull} />
      <TextInput value={avatarUrl} onChangeText={setAvatarUrl} autoCapitalize="none" placeholder={isEnglish ? 'Avatar image URL' : 'Profil fotografi URL'} placeholderTextColor={colors.muted} style={styles.inputFull} />
      <Pressable style={styles.save} onPress={saveProfile}><Text style={styles.saveText}>{isEnglish ? 'Save' : 'Kaydet'}</Text></Pressable>
    </View>

    <View style={styles.panel}>
      <View style={styles.panelTitle}><Ionicons name="language-outline" size={18} color={colors.primary} /><Text style={styles.heading}>{isEnglish ? 'App language' : 'Uygulama dili'}</Text></View>
      <View style={styles.language}><Pressable style={[styles.languageOption, profile.language === 'tr' && styles.languageActive]} onPress={() => profile.setLanguage('tr')}><Text style={[styles.languageText, profile.language === 'tr' && styles.languageTextActive]}>Turkce</Text></Pressable><Pressable style={[styles.languageOption, profile.language === 'en' && styles.languageActive]} onPress={() => profile.setLanguage('en')}><Text style={[styles.languageText, profile.language === 'en' && styles.languageTextActive]}>English</Text></Pressable></View>
    </View>

    <FriendsPanel userId={auth.user?.id} isEnglish={isEnglish} />

    <View style={styles.sectionHeader}><Text style={styles.heading}>{isEnglish ? 'Profile photo' : 'Profil fotografi'}</Text><Text style={styles.caption}>{isEnglish ? 'Use a poster' : 'Poster kullan'}</Text></View>
    {availableMedia.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coverChoices}>{availableMedia.map((media) => <Pressable key={`avatar-${media.type}-${media.id}`} onPress={() => { profile.setAvatar(media.posterUrl); setAvatarUrl(media.posterUrl); }} style={[styles.posterChoice, profile.avatarUrl === media.posterUrl && styles.coverSelected]}><Image source={{ uri: media.posterUrl }} style={styles.posterImage} /><Text numberOfLines={1} style={styles.coverTitle}>{media.title}</Text></Pressable>)}</ScrollView> : <Text style={styles.empty}>{isEnglish ? 'Add favorites or library titles to choose a profile photo.' : 'Profil fotografi secmek icin favori veya listene yapim ekle.'}</Text>}

    <View style={styles.sectionHeader}><Text style={styles.heading}>{isEnglish ? 'Profile cover' : 'Profil kapagi'}</Text><Text style={styles.caption}>{isEnglish ? 'Choose from your titles' : 'Yapimlarindan sec'}</Text></View>
    {availableMedia.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coverChoices}>{availableMedia.map((media) => <Pressable key={`cover-${media.type}-${media.id}`} onPress={() => profile.setCover(media.backdropUrl || media.posterUrl)} style={[styles.coverChoice, profile.coverUrl === (media.backdropUrl || media.posterUrl) && styles.coverSelected]}><Image source={{ uri: media.backdropUrl || media.posterUrl }} style={styles.coverImage} /><Text numberOfLines={1} style={styles.coverTitle}>{media.title}</Text></Pressable>)}</ScrollView> : <Text style={styles.empty}>{isEnglish ? 'Add favorites or library titles to choose a cover.' : 'Kapak secmek icin favori veya listene yapim ekle.'}</Text>}

    <View style={styles.sectionHeader}><Text style={styles.heading}>{isEnglish ? 'My favorites' : 'Favorilerim'}</Text><Text style={styles.caption}>{profile.favorites.length}</Text></View>
    {profile.favorites.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favorites}>{profile.favorites.map((media) => <MediaCard key={`${media.type}-${media.id}`} media={media} width={132} />)}</ScrollView> : <View style={styles.favoriteEmpty}><Ionicons name="heart-outline" size={28} color={colors.muted} /><Text style={styles.empty}>{isEnglish ? 'Tap the heart on a movie or show.' : 'Dizi veya film detayindaki kalbe dokun.'}</Text></View>}
  </Screen>;
}

function FriendsPanel({ userId, isEnglish }: { userId?: string; isEnglish: boolean }) {
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const friendsQuery = useQuery({ queryKey: ['friends', userId], queryFn: () => fetchFriendships(userId!), enabled: Boolean(userId), staleTime: 10_000 });
  const searchQuery = useQuery({ queryKey: ['profile-search', userId, query], queryFn: () => searchProfiles(query, userId!), enabled: Boolean(userId && query.trim().length >= 2), staleTime: 5_000 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['friends', userId] });
  const sendMutation = useMutation({ mutationFn: (targetUserId: string) => sendFriendRequest(userId!, targetUserId), onSuccess: () => { setQuery(''); refresh(); queryClient.invalidateQueries({ queryKey: ['profile-search', userId] }); } });
  const respondMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) => respondFriendRequest(id, status), onSuccess: refresh });
  const removeMutation = useMutation({ mutationFn: removeFriendship, onSuccess: refresh });
  const rows = friendsQuery.data ?? [];
  const incoming = rows.filter((friendship) => friendship.direction === 'incoming');
  const outgoing = rows.filter((friendship) => friendship.direction === 'outgoing');
  const friends = rows.filter((friendship) => friendship.direction === 'friend');

  if (!userId) {
    return <View style={styles.panel}><View style={styles.panelTitle}><Ionicons name="people-outline" size={18} color={colors.primary} /><Text style={styles.heading}>{isEnglish ? 'Friends' : 'Arkadaslar'}</Text></View><Text style={styles.emptyInline}>{isEnglish ? 'Sign in to add friends.' : 'Arkadas eklemek icin giris yap.'}</Text></View>;
  }

  return <View style={styles.panel}>
    <View style={styles.panelTitle}><Ionicons name="people-outline" size={18} color={colors.primary} /><Text style={styles.heading}>{isEnglish ? 'Friends' : 'Arkadaslar'}</Text></View>
    <TextInput value={query} onChangeText={setQuery} autoCapitalize="none" placeholder={isEnglish ? 'Search username or name' : 'Kullanici adi veya isim ara'} placeholderTextColor={colors.muted} style={styles.inputFull} />
    {friendsQuery.error && <Text style={styles.errorText}>{isEnglish ? 'Friend schema is not ready. Run the latest Supabase migration.' : 'Arkadaslik semasi hazir degil. Son Supabase migration dosyasini calistir.'}</Text>}
    {searchQuery.data?.map((profile) => <View key={profile.id} style={styles.friendRow}><ProfileMini profile={profile} /><MotionPressable disabled={sendMutation.isPending} onPress={() => sendMutation.mutate(profile.id)} style={styles.smallAction}><Text style={styles.smallActionText}>{isEnglish ? 'Add' : 'Ekle'}</Text></MotionPressable></View>)}
    <FriendSection title={isEnglish ? 'Requests' : 'Istekler'} rows={incoming} empty={isEnglish ? 'No incoming requests.' : 'Gelen istek yok.'} renderActions={(row) => <View style={styles.friendActions}><MotionPressable onPress={() => respondMutation.mutate({ id: row.id, status: 'accepted' })} style={styles.smallAction}><Text style={styles.smallActionText}>{isEnglish ? 'Accept' : 'Kabul'}</Text></MotionPressable><MotionPressable onPress={() => respondMutation.mutate({ id: row.id, status: 'declined' })} style={styles.ghostAction}><Text style={styles.ghostActionText}>{isEnglish ? 'Decline' : 'Reddet'}</Text></MotionPressable></View>} />
    <FriendSection title={isEnglish ? 'Friends' : 'Arkadaslarim'} rows={friends} empty={isEnglish ? 'No friends yet.' : 'Henuz arkadas yok.'} renderActions={(row) => <MotionPressable onPress={() => removeMutation.mutate(row.id)} style={styles.iconAction}><Ionicons name="person-remove-outline" size={16} color={colors.primary} /></MotionPressable>} />
    <FriendSection title={isEnglish ? 'Sent' : 'Gonderilen'} rows={outgoing} empty={isEnglish ? 'No pending sent requests.' : 'Bekleyen gonderilen istek yok.'} renderActions={(row) => <MotionPressable onPress={() => removeMutation.mutate(row.id)} style={styles.ghostAction}><Text style={styles.ghostActionText}>{isEnglish ? 'Cancel' : 'Iptal'}</Text></MotionPressable>} />
  </View>;
}

function FriendSection({ title, rows, empty, renderActions }: { title: string; rows: Friendship[]; empty: string; renderActions: (row: Friendship) => ReactNode }) {
  return <View style={styles.friendSection}><Text style={styles.friendSectionTitle}>{title}</Text>{rows.length === 0 ? <Text style={styles.friendEmpty}>{empty}</Text> : rows.map((row) => <View key={row.id} style={styles.friendRow}><ProfileMini profile={row.profile} />{renderActions(row)}</View>)}</View>;
}

function ProfileMini({ profile }: { profile: { firstName: string; lastName: string; username: string; avatarUrl?: string } }) {
  const label = `${profile.firstName} ${profile.lastName}`.trim() || (profile.username ? `@${profile.username}` : 'Episode');
  const initials = `${profile.firstName[0] ?? profile.username[0] ?? 'E'}${profile.lastName[0] ?? ''}`.toUpperCase();
  return <View style={styles.profileMini}>{profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.miniAvatar} /> : <View style={styles.miniAvatarFallback}><Text style={styles.miniAvatarText}>{initials}</Text></View>}<View style={styles.miniCopy}><Text style={styles.miniName}>{label}</Text>{profile.username ? <Text style={styles.miniUsername}>@{profile.username}</Text> : null}</View></View>;
}

const styles = StyleSheet.create({
  cover: { height: 230, backgroundColor: colors.elevated }, profileHead: { alignItems: 'center', marginTop: -55, paddingHorizontal: spacing.lg }, avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, avatarText: { color: '#fff', fontSize: 28, fontWeight: '900' }, name: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: spacing.sm }, stats: { color: colors.muted, fontSize: 12, marginTop: 4 },
  accountPanel: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, accountInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, accountCopy: { flex: 1 }, accountTitle: { color: colors.text, fontSize: 13, fontWeight: '900' }, accountDetail: { color: colors.muted, fontSize: 10, marginTop: 3 }, syncStatus: { color: colors.success, fontSize: 9, fontWeight: '800', marginTop: 5 }, syncError: { color: colors.primary }, accountAction: { alignSelf: 'flex-end', marginTop: spacing.md, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: colors.border }, accountActionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary }, accountActionText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, accountActionPrimaryText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  panel: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, panelTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }, heading: { color: colors.text, fontSize: 17, fontWeight: '800' }, inputs: { flexDirection: 'row', gap: spacing.sm }, input: { flex: 1, height: 46, borderRadius: radius.sm, backgroundColor: colors.elevated, color: colors.text, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border }, inputFull: { height: 46, borderRadius: radius.sm, backgroundColor: colors.elevated, color: colors.text, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }, save: { alignSelf: 'flex-end', marginTop: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 9 }, saveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  language: { flexDirection: 'row', gap: spacing.sm }, languageOption: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.sm, backgroundColor: colors.elevated }, languageActive: { backgroundColor: colors.text }, languageText: { color: colors.muted, fontWeight: '800' }, languageTextActive: { color: colors.background }, sectionHeader: { marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, caption: { color: colors.primary, fontSize: 11, fontWeight: '700' }, coverChoices: { paddingHorizontal: spacing.lg, gap: spacing.sm }, coverChoice: { width: 145, padding: 4, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' }, posterChoice: { width: 90, padding: 4, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' }, coverSelected: { borderColor: colors.primary }, coverImage: { width: 133, height: 78, borderRadius: radius.sm, backgroundColor: colors.elevated }, posterImage: { width: 78, height: 116, borderRadius: radius.sm, backgroundColor: colors.elevated }, coverTitle: { color: colors.text, fontSize: 10, fontWeight: '700', marginTop: 6 }, favorites: { paddingHorizontal: spacing.lg }, empty: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: spacing.xl }, emptyInline: { color: colors.muted, fontSize: 12, lineHeight: 18 }, favoriteEmpty: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.xl },
  friendSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, friendSectionTitle: { color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: spacing.sm }, friendEmpty: { color: colors.muted, fontSize: 11 }, friendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.sm }, profileMini: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, miniAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.elevated }, miniAvatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, miniAvatarText: { color: colors.text, fontSize: 12, fontWeight: '900' }, miniCopy: { flex: 1 }, miniName: { color: colors.text, fontSize: 12, fontWeight: '800' }, miniUsername: { color: colors.muted, fontSize: 10, marginTop: 2 }, friendActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, smallAction: { borderRadius: radius.pill, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8 }, smallActionText: { color: '#fff', fontSize: 10, fontWeight: '900' }, ghostAction: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 }, ghostActionText: { color: colors.muted, fontSize: 10, fontWeight: '800' }, iconAction: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,90,71,.1)', alignItems: 'center', justifyContent: 'center' }, errorText: { color: colors.primary, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
});
