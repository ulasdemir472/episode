import { useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const profile = useProfileStore();
  const library = useLibraryStore((state) => state.items);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const isEnglish = profile.language === 'en';
  const availableCovers = [...profile.favorites, ...library.map((item) => item.media)].filter((media, index, all) => all.findIndex((item) => item.id === media.id) === index);
  const initials = `${profile.firstName[0] ?? 'E'}${profile.lastName[0] ?? ''}`.toUpperCase();

  return <Screen>
    <ImageBackground source={profile.coverUrl ? { uri: profile.coverUrl } : undefined} style={styles.cover}>
      <LinearGradient colors={['rgba(7,7,10,.1)', colors.background]} style={StyleSheet.absoluteFill} />
    </ImageBackground>
    <View style={styles.profileHead}><View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View><Text style={styles.name}>{profile.firstName || profile.lastName ? `${profile.firstName} ${profile.lastName}`.trim() : isEnglish ? 'Your profile' : 'Profilin'}</Text><Text style={styles.stats}>{profile.favorites.length} {isEnglish ? 'favorites' : 'favori'} · {library.length} {isEnglish ? 'in library' : 'listede'}</Text></View>

    <View style={styles.panel}><View style={styles.panelTitle}><Ionicons name="person-outline" size={18} color={colors.primary} /><Text style={styles.heading}>{isEnglish ? 'Profile details' : 'Profil bilgileri'}</Text></View><View style={styles.inputs}><TextInput value={firstName} onChangeText={setFirstName} placeholder={isEnglish ? 'First name' : 'Ad'} placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={lastName} onChangeText={setLastName} placeholder={isEnglish ? 'Last name' : 'Soyad'} placeholderTextColor={colors.muted} style={styles.input} /></View><Pressable style={styles.save} onPress={() => profile.setName(firstName, lastName)}><Text style={styles.saveText}>{isEnglish ? 'Save' : 'Kaydet'}</Text></Pressable></View>

    <View style={styles.panel}><View style={styles.panelTitle}><Ionicons name="language-outline" size={18} color={colors.primary} /><Text style={styles.heading}>{isEnglish ? 'App language' : 'Uygulama dili'}</Text></View><View style={styles.language}><Pressable style={[styles.languageOption, profile.language === 'tr' && styles.languageActive]} onPress={() => profile.setLanguage('tr')}><Text style={[styles.languageText, profile.language === 'tr' && styles.languageTextActive]}>Türkçe</Text></Pressable><Pressable style={[styles.languageOption, profile.language === 'en' && styles.languageActive]} onPress={() => profile.setLanguage('en')}><Text style={[styles.languageText, profile.language === 'en' && styles.languageTextActive]}>English</Text></Pressable></View></View>

    <View style={styles.sectionHeader}><Text style={styles.heading}>{isEnglish ? 'Profile cover' : 'Profil kapağı'}</Text><Text style={styles.caption}>{isEnglish ? 'Choose from your titles' : 'Yapımlarından seç'}</Text></View>
    {availableCovers.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coverChoices}>{availableCovers.map((media) => <Pressable key={media.id} onPress={() => profile.setCover(media.backdropUrl || media.posterUrl)} style={[styles.coverChoice, profile.coverUrl === (media.backdropUrl || media.posterUrl) && styles.coverSelected]}><Image source={{ uri: media.backdropUrl || media.posterUrl }} style={styles.coverImage} /><Text numberOfLines={1} style={styles.coverTitle}>{media.title}</Text></Pressable>)}</ScrollView> : <Text style={styles.empty}>{isEnglish ? 'Add favorites or library titles to choose a cover.' : 'Kapak seçmek için favori veya listene yapım ekle.'}</Text>}

    <View style={styles.sectionHeader}><Text style={styles.heading}>{isEnglish ? 'My favorites' : 'Favorilerim'}</Text><Text style={styles.caption}>{profile.favorites.length}</Text></View>
    {profile.favorites.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favorites}>{profile.favorites.map((media) => <MediaCard key={`${media.type}-${media.id}`} media={media} width={132} />)}</ScrollView> : <View style={styles.favoriteEmpty}><Ionicons name="heart-outline" size={28} color={colors.muted} /><Text style={styles.empty}>{isEnglish ? 'Tap the heart on a movie or show.' : 'Dizi veya film detayındaki kalbe dokun.'}</Text></View>}
  </Screen>;
}

const styles = StyleSheet.create({
  cover: { height: 230, backgroundColor: colors.elevated }, profileHead: { alignItems: 'center', marginTop: -55, paddingHorizontal: spacing.lg }, avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 28, fontWeight: '900' }, name: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: spacing.sm }, stats: { color: colors.muted, fontSize: 12, marginTop: 4 },
  panel: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, panelTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }, heading: { color: colors.text, fontSize: 17, fontWeight: '800' }, inputs: { flexDirection: 'row', gap: spacing.sm }, input: { flex: 1, height: 46, borderRadius: radius.sm, backgroundColor: colors.elevated, color: colors.text, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border }, save: { alignSelf: 'flex-end', marginTop: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 9 }, saveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  language: { flexDirection: 'row', gap: spacing.sm }, languageOption: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.sm, backgroundColor: colors.elevated }, languageActive: { backgroundColor: colors.text }, languageText: { color: colors.muted, fontWeight: '800' }, languageTextActive: { color: colors.background }, sectionHeader: { marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, caption: { color: colors.primary, fontSize: 11, fontWeight: '700' }, coverChoices: { paddingHorizontal: spacing.lg, gap: spacing.sm }, coverChoice: { width: 145, padding: 4, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' }, coverSelected: { borderColor: colors.primary }, coverImage: { width: 133, height: 78, borderRadius: radius.sm, backgroundColor: colors.elevated }, coverTitle: { color: colors.text, fontSize: 10, fontWeight: '700', marginTop: 6 }, favorites: { paddingHorizontal: spacing.lg }, empty: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: spacing.xl }, favoriteEmpty: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.xl },
});
