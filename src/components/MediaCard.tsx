import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Media } from '@/domain/media';
import { colors, radius, spacing } from '@/theme/tokens';

export function MediaCard({ media, width = 146 }: { media: Media; width?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${media.title} detayını aç`} onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(media.id), data: JSON.stringify(media) } })} style={({ pressed }) => [styles.root, { width }, pressed && styles.pressed]}>
      <Image source={{ uri: media.posterUrl }} style={[styles.poster, { width, height: width * 1.48 }]} />
      <View style={styles.rating}><Ionicons name="star" color={colors.warning} size={11} /><Text style={styles.ratingText}>{media.rating}</Text></View>
      <Text style={styles.title} numberOfLines={1}>{media.title}</Text>
      <Text style={styles.meta}>{media.year} · {media.type === 'tv' ? 'Dizi' : 'Film'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { marginRight: spacing.md }, pressed: { opacity: 0.78 },
  poster: { borderRadius: radius.md, backgroundColor: colors.elevated },
  rating: { position: 'absolute', top: 9, right: 9, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(7,7,10,.78)', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 4 },
  ratingText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  title: { color: colors.text, fontWeight: '700', fontSize: 14, marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
});

