import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/components/Screen';
import { Media } from '@/domain/media';
import { useLibraryStore } from '@/store/library-store';
import { colors, radius, spacing } from '@/theme/tokens';

export default function MediaDetailScreen() {
  const params = useLocalSearchParams<{ data?: string }>();
  const media = params.data ? JSON.parse(params.data) as Media : undefined;
  const saved = useLibraryStore((state) => media ? state.isSaved(media.id) : false);
  const upsert = useLibraryStore((state) => state.upsert); const remove = useLibraryStore((state) => state.remove);
  if (!media) return null;
  const toggle = () => {
    Haptics.selectionAsync();
    if (saved) remove(media.id);
    else upsert(media, 'watchlist');
  };
  return <Screen><ImageBackground source={{ uri: media.backdropUrl }} style={styles.hero}><LinearGradient colors={['rgba(7,7,10,.1)', colors.background]} style={StyleSheet.absoluteFill} /><Pressable accessibilityLabel="Geri" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" color="#fff" size={24} /></Pressable></ImageBackground><View style={styles.body}><Text style={styles.type}>{media.type === 'tv' ? 'DİZİ' : 'FİLM'} · {media.year}</Text><Text style={styles.title}>{media.title}</Text><View style={styles.meta}><Ionicons name="star" color={colors.warning} size={15} /><Text style={styles.rating}>{media.rating}</Text><Text style={styles.genres}>{media.genres.join('  ·  ')}</Text></View><Text style={styles.overview}>{media.overview}</Text><Pressable style={[styles.action, saved && styles.saved]} onPress={toggle}><Ionicons name={saved ? 'checkmark' : 'add'} size={21} color="#fff" /><Text style={styles.actionText}>{saved ? 'Listemde' : 'Listeme ekle'}</Text></Pressable><View style={styles.rule} /><Text style={styles.section}>İzleme durumu</Text><Text style={styles.hint}>Listene ekledikten sonra bölümleri izledikçe işaretleyebilir ve yeni bölüm bildirimleri alabilirsin.</Text></View></Screen>;
}
const styles = StyleSheet.create({ hero: { height: 330 }, back: { position: 'absolute', top: spacing.md, left: spacing.md, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' }, body: { paddingHorizontal: spacing.lg, marginTop: -45 }, type: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 38, lineHeight: 42, fontWeight: '900', letterSpacing: -1.3, marginTop: spacing.sm }, meta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing.md }, rating: { color: colors.text, fontWeight: '800' }, genres: { color: colors.muted, fontSize: 12 }, overview: { color: '#C1BFC4', lineHeight: 23, fontSize: 14, marginTop: spacing.lg }, action: { marginTop: spacing.lg, height: 52, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }, saved: { backgroundColor: colors.success }, actionText: { color: '#fff', fontWeight: '900' }, rule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xl }, section: { color: colors.text, fontSize: 18, fontWeight: '800' }, hint: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: spacing.sm } });
