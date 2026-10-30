import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LibraryItem } from '@/domain/media';
import { calculateViewingInsights } from '@/features/profile/watch-time';
import { colors, radius, spacing } from '@/theme/tokens';
import { catalogService, translateGenre } from '@/services/tmdb';

export function ProfileInsights({ library, episodeRuntimes = {}, language = 'tr' }: { library: LibraryItem[]; episodeRuntimes?: Record<string, number>; language?: 'tr' | 'en' }) {
  const insights = calculateViewingInsights(library, episodeRuntimes);
  const topMedia = insights.topMedia;
  const topTitle = useQuery({
    queryKey: ['media-details', topMedia?.type, topMedia?.id, language],
    queryFn: () => catalogService.mediaDetails(topMedia!.type, topMedia!.id, language),
    enabled: Boolean(topMedia),
    staleTime: 24 * 60 * 60_000,
  });
  const en = language === 'en';
  const percent = en ? `${insights.dominantPercent}%` : `%${insights.dominantPercent}`;
  const balance = insights.dominantType === 'balanced' ? (en ? 'Balanced' : 'Dengeli') : insights.dominantType === 'tv' ? `${percent} ${en ? 'series' : 'dizi'}` : insights.dominantType === 'movie' ? `${percent} ${en ? 'movies' : 'film'}` : '—';
  return <View style={styles.root}>
    <View style={styles.heading}><Ionicons name="analytics-outline" size={17} color={colors.secondary} /><Text style={styles.title}>{en ? 'Viewing insights' : 'İzleme özeti'}</Text></View>
    <View style={styles.cards}>
      <Insight icon="color-palette-outline" label={en ? 'Favorite genre' : 'Favori tür'} value={insights.favoriteGenre ? translateGenre(insights.favoriteGenre, en) : '—'} />
      <Insight icon="tv-outline" label={en ? 'Most watched show' : 'En çok izlenen dizi'} value={topTitle.data?.title ?? (topMedia && topTitle.isPending ? '…' : insights.topTitle ?? '—')} detail={insights.topTitle ? `${insights.topTitleEpisodes} ${en ? 'episodes' : 'bölüm'}` : undefined} />
      <Insight icon="pie-chart-outline" label={en ? 'Viewing balance' : 'İzleme dağılımı'} value={balance} />
    </View>
  </View>;
}

function Insight({ icon, label, value, detail }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; detail?: string }) {
  return <View style={styles.card}><Ionicons name={icon} size={17} color={colors.primary} /><Text style={styles.label}>{label}</Text><Text numberOfLines={2} style={styles.value}>{value}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}</View>;
}

const styles = StyleSheet.create({ root: { marginHorizontal: spacing.lg, marginTop: spacing.lg }, heading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: spacing.sm }, title: { color: colors.text, fontSize: 15, fontWeight: '900' }, cards: { flexDirection: 'row', gap: spacing.sm }, card: { flex: 1, minHeight: 112, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, label: { color: colors.muted, fontSize: 8, fontWeight: '800', marginTop: 8 }, value: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: '900', marginTop: 4 }, detail: { color: colors.success, fontSize: 8, fontWeight: '800', marginTop: 3 } });
