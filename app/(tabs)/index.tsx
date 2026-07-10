import { ActivityIndicator, FlatList, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { SectionHeader } from '@/components/SectionHeader';
import { catalogService } from '@/services/tmdb';
import { colors, radius, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ['trending'], queryFn: catalogService.trending });
  const hero = data[0];
  return <Screen>
    <View style={styles.top}><View><Text style={styles.eyebrow}>BU GECE NE İZLİYORUZ?</Text><Text style={styles.logo}>episode<Text style={styles.dot}>.</Text></Text></View><View style={styles.avatar}><Text style={styles.avatarText}>UD</Text></View></View>
    {isLoading ? <ActivityIndicator color={colors.primary} style={{ height: 430 }} /> : isError ? <View style={styles.catalogError}><Ionicons name="cloud-offline-outline" size={32} color={colors.muted} /><Text style={styles.errorTitle}>Katalog yüklenemedi</Text><Pressable onPress={() => refetch()}><Text style={styles.retry}>Tekrar dene</Text></Pressable></View> : hero && <ImageBackground source={{ uri: hero.backdropUrl }} style={styles.hero} imageStyle={styles.heroImage}>
      <LinearGradient colors={['transparent', 'rgba(7,7,10,.3)', colors.background]} style={StyleSheet.absoluteFill} />
      <View style={styles.heroContent}><View style={styles.badge}><Text style={styles.badgeText}>HAFTANIN SEÇİMİ</Text></View><Text style={styles.heroTitle}>{hero.title}</Text><Text numberOfLines={2} style={styles.overview}>{hero.overview}</Text><Pressable style={styles.button} onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(hero.id), data: JSON.stringify(hero) } })}><Ionicons name="play" size={17} color="#fff" /><Text style={styles.buttonText}>Detayları Gör</Text></Pressable></View>
    </ImageBackground>}
    <SectionHeader title="Gündemde" caption="BU HAFTA" />
    <FlatList horizontal data={data} keyExtractor={(item) => String(item.id)} renderItem={({ item }) => <MediaCard media={item} />} contentContainerStyle={styles.list} showsHorizontalScrollIndicator={false} />
    <SectionHeader title="Senin için" caption="KÜRATÖR SEÇİMİ" />
    <FlatList horizontal data={[...data].reverse()} keyExtractor={(item) => `rec-${item.id}`} renderItem={({ item }) => <MediaCard media={item} width={128} />} contentContainerStyle={styles.list} showsHorizontalScrollIndicator={false} />
  </Screen>;
}
const styles = StyleSheet.create({ top: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.6, fontWeight: '700' }, logo: { color: colors.text, fontSize: 30, letterSpacing: -1.5, fontWeight: '900' }, dot: { color: colors.primary }, avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.text, fontSize: 12, fontWeight: '800' }, hero: { height: 430, justifyContent: 'flex-end' }, heroImage: { borderRadius: radius.lg, marginHorizontal: spacing.md }, heroContent: { padding: spacing.xl }, badge: { alignSelf: 'flex-start', backgroundColor: colors.primary, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.sm }, badgeText: { color: '#fff', fontSize: 9, letterSpacing: 1, fontWeight: '900' }, heroTitle: { color: '#fff', fontSize: 38, lineHeight: 40, letterSpacing: -1.3, fontWeight: '900', marginTop: spacing.sm }, overview: { color: '#D4D2D0', fontSize: 13, lineHeight: 19, marginTop: spacing.sm, maxWidth: 330 }, button: { marginTop: spacing.md, alignSelf: 'flex-start', flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: 'rgba(255,255,255,.16)', borderColor: 'rgba(255,255,255,.22)', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 12 }, list: { paddingLeft: spacing.lg, paddingRight: spacing.sm }, catalogError: { height: 330, alignItems: 'center', justifyContent: 'center' }, errorTitle: { color: colors.text, fontWeight: '800', marginTop: spacing.md }, retry: { color: colors.primary, fontWeight: '800', marginTop: spacing.sm } });
