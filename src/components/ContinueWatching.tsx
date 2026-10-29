import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { LibraryItem } from '@/domain/media';
import { catalogService } from '@/services/tmdb';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';
import { ContentTransition } from '@/components/ContentTransition';
class EpisodeNotAiredError extends Error {}

export function ContinueWatching({ item }: { item: LibraryItem }) {
  const language = useProfileStore((state) => state.language);
  const en = language === 'en';
  const next = item.progress?.nextEpisode;
  const mark = useMutation({ mutationFn: async () => {
    if (!next) return;
    const [details, episodes] = await Promise.all([catalogService.seriesDetails(item.media.id, language), catalogService.seasonEpisodes(item.media.id, next.season, language)]);
    const episode = episodes.find((entry) => entry.number === next.episode);
    if (!episode) throw new Error('Episode metadata unavailable');
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (episode.airDate && episode.airDate > date) throw new EpisodeNotAiredError(en ? 'This episode has not aired yet.' : 'Bu bölüm henüz yayınlanmadı.');
    useLibraryStore.getState().toggleEpisode(item.media, next.season, next.episode, details.seasons, episode?.runtime ?? details.episodeRunTime);
  }, onError: (error) => Alert.alert(en ? 'Could not update episode' : 'Bölüm güncellenemedi', error instanceof EpisodeNotAiredError ? error.message : (en ? 'Could not load episode details. Check your connection and try again.' : 'Bölüm bilgileri alınamadı. Bağlantını kontrol edip tekrar dene.')) });
  if (!next) return null;
  return <ContentTransition changeKey={`${item.media.id}:${next.season}:${next.episode}`} style={styles.row}><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/media/[id]', params: { id: String(item.media.id), type: 'tv', season: String(next.season) } })} style={styles.link}><Image source={{ uri: item.media.posterUrl }} style={styles.poster} /><View style={styles.copy}><Text style={styles.title}>{item.media.title}</Text><Text style={styles.subtitle}>S{next.season} · {en ? 'E' : 'B'}{next.episode}</Text></View></Pressable><Pressable disabled={mark.isPending} accessibilityRole="checkbox" accessibilityState={{ checked: false, disabled: mark.isPending }} accessibilityLabel={`${item.media.title} S${next.season} ${en ? 'E' : 'B'}${next.episode} ${en ? 'mark as watched' : 'izlendi işaretle'}`} onPress={() => mark.mutate()} style={styles.check}>{mark.isPending ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="checkmark" size={24} color={colors.success} />}</Pressable></ContentTransition>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, link: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, poster: { width: 45, height: 64, borderRadius: radius.sm }, copy: { flex: 1 }, title: { color: colors.text, fontSize: 15, fontWeight: '800' }, subtitle: { color: colors.muted, marginTop: 5, fontSize: 13 }, check: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated } });
