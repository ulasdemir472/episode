import { useState } from 'react';
import { Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { MotionPressable } from '@/components/MotionPressable';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchFriendships } from '@/features/friends/friends-repository';
import { uploadAvatar } from '@/features/profile/avatar-service';
import { formatWatchHours, useWatchMinutes } from '@/features/profile/watch-time';
import { ScrollFocusTarget } from '@/features/onboarding/ScrollFocusTarget';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const profile = useProfileStore();
  const auth = useAuth();
  const params = useLocalSearchParams<{ tutorialTarget?: string }>();
  const library = useLibraryStore((state) => state.items);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [username, setUsername] = useState(profile.username);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const isEnglish = profile.language === 'en';
  const watchedMinutes = useWatchMinutes(library);
  const watchedHours = formatWatchHours(watchedMinutes, profile.language);
  const availableMedia = [...profile.favorites, ...library.map((item) => item.media)].filter((media, index, all) => all.findIndex((item) => item.id === media.id && item.type === media.type) === index);
  const initials = `${profile.firstName[0] ?? 'E'}${profile.lastName[0] ?? ''}`.toUpperCase();

  const saveProfile = () => {
    profile.setProfileDetails({ firstName, lastName, username, avatarUrl: profile.avatarUrl });
    Alert.alert(isEnglish ? 'Saved' : 'Kaydedildi', isEnglish ? 'Your profile will sync shortly.' : 'Profilin kisa sure icinde senkronize olacak.');
  };

  const pickAvatar = async () => {
    if (!auth.user) {
      router.push('/auth' as Href);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(isEnglish ? 'Permission needed' : 'Izin gerekli', isEnglish ? 'Allow photo access to choose a profile photo.' : 'Profil fotografi secmek icin fotograf erisimine izin vermelisin.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      mediaTypes: ['images'],
      quality: 0.72,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) {
      Alert.alert(isEnglish ? 'Photo could not be read' : 'Fotograf okunamadi', isEnglish ? 'Please try another image.' : 'Baska bir gorsel dene.');
      return;
    }
    setAvatarUploading(true);
    try {
      const publicUrl = await uploadAvatar({ userId: auth.user.id, base64: asset.base64, mimeType: asset.mimeType });
      profile.setAvatar(publicUrl);
      Alert.alert(isEnglish ? 'Photo updated' : 'Fotograf guncellendi', isEnglish ? 'Your new profile photo will sync shortly.' : 'Yeni profil fotografin kisa sure icinde senkronize olacak.');
    } catch {
      Alert.alert(isEnglish ? 'Upload failed' : 'Yuklenemedi', isEnglish ? 'Run the avatar storage migration and try again.' : 'Avatar storage migration dosyasini calistirip tekrar dene.');
    } finally {
      setAvatarUploading(false);
    }
  };

  return <Screen>
    <ImageBackground source={profile.coverUrl ? { uri: profile.coverUrl } : undefined} style={styles.cover}>
      <LinearGradient colors={['rgba(7,7,10,.1)', colors.background]} style={StyleSheet.absoluteFill} />
    </ImageBackground>

    <View style={styles.profileHead}>
      <View style={styles.avatar}>{profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials}</Text>}</View>
      <Text style={styles.name}>{profile.firstName || profile.lastName ? `${profile.firstName} ${profile.lastName}`.trim() : isEnglish ? 'Your profile' : 'Profilin'}</Text>
      <Text style={styles.stats}>{profile.username ? `@${profile.username} · ` : ''}{watchedHours} {isEnglish ? 'hours watched' : 'saat izlendi'} · {library.length} {isEnglish ? 'titles' : 'yapım'}</Text>
    </View>

    <View style={styles.accountPanel}>
      <View style={styles.accountInfo}>
        <Ionicons name={auth.user ? auth.syncStatus === 'error' ? 'cloud-offline-outline' : 'cloud-done-outline' : 'cloud-offline-outline'} size={21} color={auth.user ? auth.syncStatus === 'error' ? colors.primary : colors.success : colors.warning} />
        <View style={styles.accountCopy}>
          <Text style={styles.accountTitle}>{auth.user ? (isEnglish ? 'Account connected' : 'Hesap bagli') : (isEnglish ? 'Local profile' : 'Yerel profil')}</Text>
          <Text style={styles.accountDetail}>{auth.user?.email ?? (isEnglish ? 'Sign in to sync across devices.' : 'Cihazlar arasi senkronizasyon icin giris yap.')}</Text>
          {auth.user && <Text style={[styles.syncStatus, auth.syncStatus === 'error' && styles.syncError]}>{auth.syncStatus === 'syncing' ? (isEnglish ? 'Syncing...' : 'Senkronize ediliyor...') : auth.syncStatus === 'error' ? (auth.syncError ?? (isEnglish ? 'Sync failed' : 'Senkronizasyon basarisiz')) : (isEnglish ? 'Synced' : 'Senkronize')}</Text>}
          {auth.user && auth.syncStatus === 'error' ? <Pressable onPress={() => void auth.retrySync()} style={styles.retrySync}><Text style={styles.retrySyncText}>{isEnglish ? 'Try again' : 'Tekrar dene'}</Text></Pressable> : null}
        </View>
      </View>
      {auth.user ? <MotionPressable onPress={() => auth.signOut()} style={styles.accountAction}><Text style={styles.accountActionText}>{isEnglish ? 'Sign out' : 'Cikis yap'}</Text></MotionPressable> : <MotionPressable onPress={() => router.push('/auth' as Href)} style={[styles.accountAction, styles.accountActionPrimary]}><Text style={styles.accountActionPrimaryText}>{isEnglish ? 'Sign in' : 'Giris yap'}</Text></MotionPressable>}
    </View>

    <View style={styles.panel}>
      <View style={styles.panelTitle}><Ionicons name="person-outline" size={18} color={colors.primary} /><Text style={styles.heading}>{isEnglish ? 'Profile details' : 'Profil bilgileri'}</Text></View>
      <View style={styles.inputs}><TextInput value={firstName} onChangeText={setFirstName} placeholder={isEnglish ? 'First name' : 'Ad'} placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={lastName} onChangeText={setLastName} placeholder={isEnglish ? 'Last name' : 'Soyad'} placeholderTextColor={colors.muted} style={styles.input} /></View>
      <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder={isEnglish ? 'Username' : 'Kullanici adi'} placeholderTextColor={colors.muted} style={styles.inputFull} />
      <View style={styles.profileActions}><Pressable style={styles.secondaryAction} onPress={pickAvatar} disabled={avatarUploading}><Ionicons name="image-outline" size={16} color={colors.text} /><Text style={styles.secondaryActionText}>{avatarUploading ? (isEnglish ? 'Uploading...' : 'Yukleniyor...') : (isEnglish ? 'Choose photo' : 'Fotograf sec')}</Text></Pressable><Pressable style={styles.save} onPress={saveProfile}><Text style={styles.saveText}>{isEnglish ? 'Save' : 'Kaydet'}</Text></Pressable></View>
    </View>

    <View style={styles.panel}>
      <View style={styles.panelTitle}><Ionicons name="language-outline" size={18} color={colors.primary} /><Text style={styles.heading}>{isEnglish ? 'App language' : 'Uygulama dili'}</Text></View>
      <View style={styles.language}><Pressable style={[styles.languageOption, profile.language === 'tr' && styles.languageActive]} onPress={() => profile.setLanguage('tr')}><Text style={[styles.languageText, profile.language === 'tr' && styles.languageTextActive]}>Turkce</Text></Pressable><Pressable style={[styles.languageOption, profile.language === 'en' && styles.languageActive]} onPress={() => profile.setLanguage('en')}><Text style={[styles.languageText, profile.language === 'en' && styles.languageTextActive]}>English</Text></Pressable></View>
    </View>

    <ScrollFocusTarget active={params.tutorialTarget === 'friends'}>
      <FriendsPanel userId={auth.user?.id} isEnglish={isEnglish} />
    </ScrollFocusTarget>

    <View style={styles.sectionHeader}><Text style={styles.heading}>{isEnglish ? 'Profile cover' : 'Profil kapağı'}</Text>{profile.coverUrl ? <Pressable onPress={() => profile.setCover(undefined)} style={styles.removeCover}><Ionicons name="trash-outline" size={14} color={colors.primary} /><Text style={styles.removeCoverText}>{isEnglish ? 'Remove' : 'Kaldır'}</Text></Pressable> : <Text style={styles.caption}>{isEnglish ? 'Choose from your titles' : 'Yapımlarından seç'}</Text>}</View>
    {availableMedia.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coverChoices}>{availableMedia.map((media) => <Pressable key={`cover-${media.type}-${media.id}`} onPress={() => profile.setCover(media.backdropUrl || media.posterUrl)} style={[styles.coverChoice, profile.coverUrl === (media.backdropUrl || media.posterUrl) && styles.coverSelected]}><Image source={{ uri: media.backdropUrl || media.posterUrl }} style={styles.coverImage} /><Text numberOfLines={1} style={styles.coverTitle}>{media.title}</Text></Pressable>)}</ScrollView> : <Text style={styles.empty}>{isEnglish ? 'Add favorites or library titles to choose a cover.' : 'Kapak secmek icin favori veya listene yapim ekle.'}</Text>}

    <View style={styles.sectionHeader}><Text style={styles.heading}>{isEnglish ? 'My favorites' : 'Favorilerim'}</Text><Text style={styles.caption}>{profile.favorites.length}</Text></View>
    {profile.favorites.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favorites}>{profile.favorites.map((media) => <MediaCard key={`${media.type}-${media.id}`} media={media} width={132} />)}</ScrollView> : <View style={styles.favoriteEmpty}><Ionicons name="heart-outline" size={28} color={colors.muted} /><Text style={styles.empty}>{isEnglish ? 'Tap the heart on a movie or show.' : 'Dizi veya film detayindaki kalbe dokun.'}</Text></View>}
  </Screen>;
}

function FriendsPanel({ userId, isEnglish }: { userId?: string; isEnglish: boolean }) {
  const friendsQuery = useQuery({ queryKey: ['friends', userId], queryFn: () => fetchFriendships(userId!), enabled: Boolean(userId), staleTime: 10_000 });
  const rows = friendsQuery.data ?? [];
  const friends = rows.filter((item) => item.direction === 'friend');
  const requests = rows.filter((item) => item.direction === 'incoming').length;
  return <Pressable onPress={() => userId ? router.push('/friends' as Href) : router.push('/auth' as Href)} style={styles.panel}>
    <View style={styles.friendShortcut}><View style={styles.panelTitleInline}><Ionicons name="people-outline" size={18} color={colors.primary} /><View><Text style={styles.heading}>{isEnglish ? 'Friends' : 'Arkadaşlar'}</Text><Text style={styles.emptyInline}>{userId ? `${friends.length} ${isEnglish ? 'friends' : 'arkadaş'}${requests ? ` · ${requests} ${isEnglish ? 'requests' : 'istek'}` : ''}` : isEnglish ? 'Sign in to add friends.' : 'Arkadaş eklemek için giriş yap.'}</Text></View></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  cover: { height: 230, backgroundColor: colors.elevated }, profileHead: { alignItems: 'center', marginTop: -55, paddingHorizontal: spacing.lg }, avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, avatarText: { color: '#fff', fontSize: 28, fontWeight: '900' }, name: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: spacing.sm }, stats: { color: colors.muted, fontSize: 12, marginTop: 4 },
  accountPanel: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, accountInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, accountCopy: { flex: 1 }, accountTitle: { color: colors.text, fontSize: 13, fontWeight: '900' }, accountDetail: { color: colors.muted, fontSize: 10, marginTop: 3 }, syncStatus: { color: colors.success, fontSize: 9, fontWeight: '800', marginTop: 5 }, syncError: { color: colors.primary }, accountAction: { alignSelf: 'flex-end', marginTop: spacing.md, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: colors.border }, accountActionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary }, accountActionText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, accountActionPrimaryText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  retrySync: { alignSelf: 'flex-start', marginTop: 7, paddingVertical: 4 }, retrySyncText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  panel: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, panelTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }, heading: { color: colors.text, fontSize: 17, fontWeight: '800' }, inputs: { flexDirection: 'row', gap: spacing.sm }, input: { flex: 1, height: 46, borderRadius: radius.sm, backgroundColor: colors.elevated, color: colors.text, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border }, inputFull: { height: 46, borderRadius: radius.sm, backgroundColor: colors.elevated, color: colors.text, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }, profileActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }, secondaryAction: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9 }, secondaryActionText: { color: colors.text, fontWeight: '800', fontSize: 12 }, save: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 9 }, saveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  language: { flexDirection: 'row', gap: spacing.sm }, languageOption: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.sm, backgroundColor: colors.elevated }, languageActive: { backgroundColor: colors.text }, languageText: { color: colors.muted, fontWeight: '800' }, languageTextActive: { color: colors.background }, sectionHeader: { marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, caption: { color: colors.primary, fontSize: 11, fontWeight: '700' }, removeCover: { flexDirection: 'row', alignItems: 'center', gap: 6 }, removeCoverText: { color: colors.primary, fontSize: 11, fontWeight: '800' }, coverChoices: { paddingHorizontal: spacing.lg, gap: spacing.sm }, coverChoice: { width: 145, padding: 4, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' }, coverSelected: { borderColor: colors.primary }, coverImage: { width: 133, height: 78, borderRadius: radius.sm, backgroundColor: colors.elevated }, coverTitle: { color: colors.text, fontSize: 10, fontWeight: '700', marginTop: 6 }, favorites: { paddingHorizontal: spacing.lg }, empty: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: spacing.xl }, emptyInline: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 }, favoriteEmpty: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.xl }, friendShortcut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, panelTitleInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  friendSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, friendSectionTitle: { color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: spacing.sm }, friendEmpty: { color: colors.muted, fontSize: 11 }, friendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.sm }, profileMini: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, miniAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.elevated }, miniAvatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, miniAvatarText: { color: colors.text, fontSize: 12, fontWeight: '900' }, miniCopy: { flex: 1 }, miniName: { color: colors.text, fontSize: 12, fontWeight: '800' }, miniUsername: { color: colors.muted, fontSize: 10, marginTop: 2 }, friendActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, smallAction: { borderRadius: radius.pill, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8 }, smallActionText: { color: '#fff', fontSize: 10, fontWeight: '900' }, ghostAction: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 }, ghostActionText: { color: colors.muted, fontSize: 10, fontWeight: '800' }, iconAction: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,90,71,.1)', alignItems: 'center', justifyContent: 'center' }, errorText: { color: colors.primary, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
});
