import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Media } from '@/domain/media';
import { colors, radius, spacing } from '@/theme/tokens';
import { useCommunityStore } from '@/store/community-store';
import { MotionPressable } from '@/components/MotionPressable';

export function MediaCard({ media, width = 146 }: { media: Media; width?: number }) {
  const personalRating = useCommunityStore((state) => state.ratings[`media:${media.type}:${media.id}`]);
  return (
    <MotionPressable accessibilityRole="button" accessibilityLabel={`${media.title} detayını aç${personalRating ? `, puanın ${personalRating}` : ''}`} onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(media.id), data: JSON.stringify(media) } })} style={[styles.root, { width }]}>
      <Image source={{ uri: media.posterUrl }} style={[styles.poster, { width, height: width * 1.48 }]} />
      <View style={styles.rating}><Ionicons name="star" color={colors.warning} size={11} /><Text style={styles.ratingText}>{media.rating}</Text></View>
      {personalRating && <View style={styles.personalRating}><Ionicons name="person" color="#fff" size={10} /><Text style={styles.personalRatingText}>Sen {personalRating}/10</Text></View>}
      <Text style={styles.title} numberOfLines={1}>{media.title}</Text>
      <Text style={styles.meta}>{media.year} · {media.type === 'tv' ? 'Dizi' : 'Film'}</Text>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  root: { marginRight: spacing.md },
  poster: { borderRadius: radius.md, backgroundColor: colors.elevated },
  rating: { position: 'absolute', top: 9, right: 9, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(7,7,10,.78)', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 4 },
  ratingText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  personalRating: { position: 'absolute', top: 40, right: 9, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(124,92,252,.92)', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 4 },
  personalRatingText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  title: { color: colors.text, fontWeight: '700', fontSize: 14, marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
});
