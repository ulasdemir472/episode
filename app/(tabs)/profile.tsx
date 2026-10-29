import { useState } from 'react';
import { Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { NotificationButton } from '@/components/NotificationButton';
import { t } from '@/i18n/strings';
import { MediaCard } from '@/components/MediaCard';
import { ProfileInsights } from '@/components/ProfileInsights';
import { WatchLevelBadge } from '@/components/WatchLevelBadge';
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
  const episodeRuntimes = useLibraryStore((state) => state.episodeRuntimes);
  const [firstName, setFirstName] = useState<string>();
  const [lastName, setLastName] = useState<string>();
  const [username, setUsername] = useState<string>();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEnglish = profile.language === 'en';
  const watchTime = useWatchMinutes(library, episodeRuntimes);
  const watchedHours = watchTime.isLoading ? '…' : formatWatchHours(watchTime.minutes, profile.language);
  const availableMedia = [...profile.favorites, ...library.map((item) => item.media)].filter((media, index, all) => all.findIndex((item) => item.id === media.id && item.type === media.type) === index);
  const initials = `${profile.firstName[0] ?? 'E'}${profile.lastName[0] ?? ''}`.toUpperCase();

  const saveProfile = async () => {
    if (saving) return;
    if (username && !/^[a-z0-9._]{3,24}$/i.test(username)) { Alert.alert(isEnglish ? 'Check your username' : 'Kullanıcı adını kontrol et', isEnglish ? 'Use 3–24 letters, numbers, dots or underscores.' : '3–24 harf, rakam, nokta veya alt çizgi kullan.'); return; }
    setSaving(true);
    profile.setProfileDetails({ firstName: firstName ?? profile.firstName, lastName: lastName ?? profile.lastName, username: username ?? profile.username, avatarUrl: profile.avatarUrl });
    try { await auth.flushSync(); setFirstName(undefined); setLastName(undefined); setUsername(undefined); Alert.alert(isEnglish ? 'Saved' : 'Kaydedildi'); }
    catch (error) { const duplicate = error && typeof error === 'object' && 'code' in error && error.code === '23505'; Alert.alert(t(profile.language, 'error'), duplicate ? (isEnglish ? 'This username is already taken.' : 'Bu kullanıcı adı zaten alınmış.') : t(profile.language, 'savedLocally')); }
    finally { setSaving(false); }
  };

  const pickAvatar = async () => {
    if (!auth.user) {
      router.push('/auth' as Href);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(isEnglish ? 'Permission needed' : 'İzin gerekli', isEnglish ? 'Allow photo access to choose a profile photo.' : 'Profil fotoğrafı seçmek için fotoğraf erişimine izin vermelisin.');
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
      Alert.alert(isEnglish ? 'Photo could not be read' : 'Fotoğraf okunamadı', isEnglish ? 'Please try another image.' : 'Başka bir görsel dene.');
      return;
    }
    setAvatarUploading(true);
    try {
      const publicUrl = await uploadAvatar({ userId: auth.user.id, base64: asset.base64, mimeType: asset.mimeType });
      profile.setAvatar(publicUrl);
      Alert.alert(isEnglish ? 'Photo updated' : 'Fotoğraf güncellendi', isEnglish ? 'Your new profile photo will sync shortly.' : 'Yeni profil fotoğrafın kısa süre içinde senkronize olacak.');
    } catch {
      Alert.alert(isEnglish ? 'Upload failed' : 'Yüklenemedi', isEnglish ? 'Check your connection and try again.' : 'Bağlantını kontrol edip tekrar dene.');
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
      <Text style={styles.stats}>{profile.username ? `@${profile.username} · ` : ''}{watchTime.estimated ? t(profile.language, 'estimated') + ' ' : ''}{watchedHours} {isEnglish ? 'hours watched' : 'saat izlendi'} · {library.length} {isEnglish ? 'titles' : 'yapım'}</Text>
    </View>
    <WatchLevelBadge minutes={watchTime.minutes} isLoading={watchTime.isLoading} language={profile.language} />
    <ProfileInsights library={library} episodeRuntimes={episodeRuntimes} language={profile.language} />

    <NotificationButton />
    <Pressable onPress={() => router.push('/settings' as Href)} style={styles.panel}><View style={styles.friendShortcut}><Ionicons name="settings-outline" size={21} color={colors.primary} /><Text style={styles.heading}>{isEnglish ? 'Settings' : 'Ayarlar'}</Text><Ionicons name="chevron-forward" size={20} color={colors.muted} /></View></Pressable>

    <View style={styles.panel}>
      <View style={styles.panelTitle}><Ionicons name="person-outline" size={18} color={colors.primary} /><Text style={styles.heading}>{isEnglish ? 'Profile details' : 'Profil bilgileri'}</Text></View>
      <View style={styles.inputs}><TextInput value={firstName ?? profile.firstName} onChangeText={setFirstName} placeholder={isEnglish ? 'First name' : 'Ad'} placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={lastName ?? profile.lastName} onChangeText={setLastName} placeholder={isEnglish ? 'Last name' : 'Soyad'} placeholderTextColor={colors.muted} style={styles.input} /></View>
      <TextInput value={username ?? profile.username} onChangeText={setUsername} autoCapitalize="none" placeholder={isEnglish ? 'Username' : 'Kullanıcı adı'} placeholderTextColor={colors.muted} style={styles.inputFull} />
      <View style={styles.profileActions}><Pressable style={styles.secondaryAction} onPress={pickAvatar} disabled={avatarUploading}><Ionicons name="image-outline" size={16} color={colors.text} /><Text style={styles.secondaryActionText}>{avatarUploading ? (isEnglish ? 'Uploading...' : 'Yükleniyor...') : (isEnglish ? 'Choose photo' : 'Fotoğraf seç')}</Text></Pressable><Pressable style={styles.save} disabled={saving} onPress={() => void saveProfile()}><Text style={styles.saveText}>{isEnglish ? 'Save' : 'Kaydet'}</Text></Pressable></View>
    </View>



    <ScrollFocusTarget active={params.tutorialTarget === 'friends'}>
      <FriendsPanel userId={auth.user?.id} isEnglish={isEnglish} />
    </ScrollFocusTarget>
    <View style={styles.sectionHeader}><Text style={styles.heading}>{isEnglish ? 'Profile cover' : 'Profil kapağı'}</Text>{profile.coverUrl ? <Pressable onPress={() => profile.setCover(undefined)} style={styles.removeCover}><Ionicons name="trash-outline" size={14} color={colors.primary} /><Text style={styles.removeCoverText}>{isEnglish ? 'Remove' : 'Kaldır'}</Text></Pressable> : <Text style={styles.caption}>{isEnglish ? 'Choose from your titles' : 'Yapımlarından seç'}</Text>}</View>
    {availableMedia.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coverChoices}>{availableMedia.map((media) => <Pressable key={`cover-${media.type}-${media.id}`} onPress={() => profile.setCover(media.backdropUrl || media.posterUrl)} style={[styles.coverChoice, profile.coverUrl === (media.backdropUrl || media.posterUrl) && styles.coverSelected]}><Image source={{ uri: media.backdropUrl || media.posterUrl }} style={styles.coverImage} /><Text numberOfLines={1} style={styles.coverTitle}>{media.title}</Text></Pressable>)}</ScrollView> : <Text style={styles.empty}>{isEnglish ? 'Add favorites or library titles to choose a cover.' : 'Kapak seçmek için favori veya listene yapım ekle.'}</Text>}

    <View style={styles.sectionHeader}><Text style={styles.heading}>{isEnglish ? 'My favorites' : 'Favorilerim'}</Text><Text style={styles.caption}>{profile.favorites.length}</Text></View>
    {profile.favorites.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favorites}>{profile.favorites.map((media) => <MediaCard key={`${media.type}-${media.id}`} media={media} width={132} />)}</ScrollView> : <View style={styles.favoriteEmpty}><Ionicons name="heart-outline" size={28} color={colors.muted} /><Text style={styles.empty}>{isEnglish ? 'Tap the heart on a movie or show.' : 'Dizi veya film detayındaki kalbe dokun.'}</Text></View>}



    <View style={styles.legalPanel}>
      <Text style={styles.legalTitle}>Episode v1.0.0</Text>
      <Text style={styles.legalSubtitle}>
        {isEnglish
          ? 'Episode is a personal movie and TV show tracking and discovery tool. It does not provide video streaming or playback.'
          : 'Episode, kişisel bir dizi ve film takip ve keşif uygulamasıdır. Video akışı veya izleme hizmeti sunmaz.'}
      </Text>
      <View style={styles.attributionDivider} />
      <Text style={styles.attributionText}>
        {isEnglish
          ? 'This product uses the TMDB API but is not endorsed or certified by TMDB.'
          : 'Bu ürün TMDB API kullanmaktadır ancak TMDB tarafından onaylanmamış veya sertifikalandırılmamıştır.'}
      </Text>
      <Text style={styles.attributionText}>
        {isEnglish
          ? 'IMDb ratings provided via OMDb API.'
          : 'IMDb puanları OMDb API aracılığıyla sağlanmaktadır.'}
      </Text>
    </View>
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
  accountPanel: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, accountInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, accountCopy: { flex: 1 }, accountTitle: { color: colors.text, fontSize: 13, fontWeight: '900' }, accountDetail: { color: colors.muted, fontSize: 10, marginTop: 3 }, syncStatus: { color: colors.success, fontSize: 9, fontWeight: '800', marginTop: 5 }, syncError: { color: colors.primary },
  accountActionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.md },
  accountAction: { borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: colors.border },
  accountActionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  accountActionText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  accountActionPrimaryText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  dangerZone: { marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(255,90,71,.04)', borderWidth: 1, borderColor: 'rgba(255,90,71,.15)', alignItems: 'center', gap: 6 },
  deleteAction: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,90,71,.4)', backgroundColor: 'rgba(255,90,71,.08)' },
  deleteActionText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  dangerHint: { color: colors.muted, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  retrySync: { alignSelf: 'flex-start', marginTop: 7, paddingVertical: 4 }, retrySyncText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  panel: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, panelTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }, heading: { color: colors.text, fontSize: 17, fontWeight: '800' }, inputs: { flexDirection: 'row', gap: spacing.sm }, input: { flex: 1, height: 46, borderRadius: radius.sm, backgroundColor: colors.elevated, color: colors.text, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border }, inputFull: { height: 46, borderRadius: radius.sm, backgroundColor: colors.elevated, color: colors.text, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm }, profileActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }, secondaryAction: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9 }, secondaryActionText: { color: colors.text, fontWeight: '800', fontSize: 12 }, save: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 9 }, saveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  language: { flexDirection: 'row', gap: spacing.sm }, languageOption: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.sm, backgroundColor: colors.elevated }, languageActive: { backgroundColor: colors.text }, languageText: { color: colors.muted, fontWeight: '800' }, languageTextActive: { color: colors.background }, sectionHeader: { marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, caption: { color: colors.primary, fontSize: 11, fontWeight: '700' }, removeCover: { flexDirection: 'row', alignItems: 'center', gap: 6 }, removeCoverText: { color: colors.primary, fontSize: 11, fontWeight: '800' }, coverChoices: { paddingHorizontal: spacing.lg, gap: spacing.sm }, coverChoice: { width: 145, padding: 4, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' }, coverSelected: { borderColor: colors.primary }, coverImage: { width: 133, height: 78, borderRadius: radius.sm, backgroundColor: colors.elevated }, coverTitle: { color: colors.text, fontSize: 10, fontWeight: '700', marginTop: 6 }, favorites: { paddingHorizontal: spacing.lg }, empty: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: spacing.xl }, emptyInline: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 }, favoriteEmpty: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.xl }, friendShortcut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, panelTitleInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  friendSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, friendSectionTitle: { color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: spacing.sm }, friendEmpty: { color: colors.muted, fontSize: 11 }, friendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.sm }, profileMini: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, miniAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.elevated }, miniAvatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, miniAvatarText: { color: colors.text, fontSize: 12, fontWeight: '900' }, miniCopy: { flex: 1 }, miniName: { color: colors.text, fontSize: 12, fontWeight: '800' }, miniUsername: { color: colors.muted, fontSize: 10, marginTop: 2 }, friendActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, smallAction: { borderRadius: radius.pill, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8 }, smallActionText: { color: '#fff', fontSize: 10, fontWeight: '900' }, ghostAction: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 }, ghostActionText: { color: colors.muted, fontSize: 10, fontWeight: '800' }, iconAction: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,90,71,.1)', alignItems: 'center', justifyContent: 'center' }, errorText: { color: colors.primary, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  legalPanel: { marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: 40, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  legalTitle: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  legalSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  attributionDivider: { width: '40%', height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  attributionText: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', opacity: 0.8, marginTop: 2 },
});
