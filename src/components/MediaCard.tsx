import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Media } from '@/domain/media';
import { colors, radius, spacing } from '@/theme/tokens';
import { useCommunityStore } from '@/store/community-store';
import { MotionPressable } from '@/components/MotionPressable';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';

export function MediaCard({ media, width = 146, inGrid = false }: { media: Media; width?: number; inGrid?: boolean }) {
  const en = useProfileStore((state) => state.language) === 'en';
  const personalRating = useCommunityStore((state) => state.ratings[`media:${media.type}:${media.id}`]);
  const libraryItem = useLibraryStore((state) => state.items.find((item) => item.media.id === media.id && item.media.type === media.type));
  const nextEpisode = libraryItem?.progress?.nextEpisode;
  const watched = libraryItem?.status === 'completed';
  const watchedLabel = en ? 'Watched' : 'İzlendi';
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`${media.title} ${en ? 'details' : 'detayını aç'}${watched ? `, ${watchedLabel}` : ''}${personalRating ? `, ${en ? 'your rating' : 'puanın'} ${personalRating}` : ''}`}
      onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(media.id), data: JSON.stringify(media) } })}
      style={[styles.root, { width, marginRight: inGrid ? 0 : spacing.md }]}
    >
      <View style={[styles.posterFrame, { width, height: width * 1.48 }]}>
        <Image source={{ uri: media.posterUrl }} style={styles.poster} />
        <View style={styles.rating}><Ionicons name="star" color={colors.warning} size={11} /><Text style={styles.ratingText}>{media.rating}</Text></View>
        {personalRating && <View style={styles.personalRating}><Ionicons name="person" color="#fff" size={10} /><Text style={styles.personalRatingText}>{en ? 'You' : 'Sen'} {personalRating}/10</Text></View>}
        {watched && <View style={styles.watched}><Ionicons name="checkmark-circle" color={colors.success} size={13} /><Text style={styles.watchedText}>{watchedLabel}</Text></View>}
      </View>
      <Text style={styles.title} numberOfLines={1}>{media.title}</Text>
      <Text style={styles.meta}>{media.year} · {media.type === 'tv' ? (en ? 'Show' : 'Dizi') : (en ? 'Movie' : 'Film')}</Text>
      {nextEpisode ? <Text style={styles.progress}>{en ? 'Continue' : 'Kaldığın yer'} · S{nextEpisode.season} {en ? 'E' : 'B'}{nextEpisode.episode}</Text> : null}
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  root: { marginRight: spacing.md },
  posterFrame: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.elevated },
  poster: { width: '100%', height: '100%' },
  rating: { position: 'absolute', top: 9, right: 9, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(7,7,10,.78)', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 4 },
  ratingText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  personalRating: { position: 'absolute', top: 40, right: 9, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(124,92,252,.92)', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 4 },
  personalRatingText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  watched: { position: 'absolute', bottom: 8, left: 8, maxWidth: '90%', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(7,35,26,.96)', borderColor: 'rgba(101,214,166,.5)', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 4 },
  watchedText: { color: '#fff', fontSize: 10, fontWeight: '800', flexShrink: 1 },
  title: { color: colors.text, fontWeight: '700', fontSize: 14, marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  progress: { color: colors.success, fontSize: 10, fontWeight: '800', marginTop: 4 },
});
