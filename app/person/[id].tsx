import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ChoicePicker } from '@/components/ChoicePicker';
import { MediaCard } from '@/components/MediaCard';
import { PersonPortrait } from '@/components/PeopleCredits';
import { mediaKey, type MediaType } from '@/domain/media';
import { catalogService } from '@/services/tmdb';
import { useProfileStore } from '@/store/profile-store';
import { t } from '@/i18n/strings';
import { colors, radius, spacing } from '@/theme/tokens';

export default function PersonScreen() {
  const language = useProfileStore(state => state.language);
  const en = language === 'en';
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id);
  const validId = Number.isSafeInteger(id) && id > 0;
  const [type, setType] = useState<'all' | MediaType>('all');
  const [expandedBiography, setExpandedBiography] = useState(false);
  const { width } = useWindowDimensions();
  const columns = Math.min(4, Math.max(2, Math.floor((width - 48) / 158)));
  const cardWidth = (width - 48 - (columns - 1) * 12) / columns;
  const person = useQuery({ queryKey: ['person-details', id, language], queryFn: () => catalogService.personDetails(id, language), enabled: validId });
  const credits = person.data?.credits.filter(media => type === 'all' || media.type === type) ?? [];
  const back = <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Go back' : 'Geri dön'} onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable>;

  if (!validId || person.isError) return <Screen>{back}<View style={styles.state}><Text style={styles.message}>{en ? 'Could not load this person.' : 'Kişi bilgileri yüklenemedi.'}</Text>{validId && <Pressable accessibilityRole="button" onPress={() => person.refetch()} style={styles.retry}><Text style={styles.retryText}>{t(language, 'retry')}</Text></Pressable>}</View></Screen>;
  if (!person.data) return <Screen>{back}<ActivityIndicator accessibilityLabel={en ? 'Loading person' : 'Kişi yükleniyor'} color={colors.primary} style={styles.state} /></Screen>;

  const header = <View style={styles.header}>{back}
    <View style={styles.identity}><PersonPortrait key={`${id}:${person.data.profileUrl}`} person={person.data} large /><Text style={styles.name}>{person.data.name}</Text></View>
    {!!person.data.biography && <><Text numberOfLines={expandedBiography ? undefined : 4} style={styles.biography}>{person.data.biography}</Text>{person.data.biography.length > 220 && <Pressable accessibilityRole="button" accessibilityState={{ expanded: expandedBiography }} onPress={() => setExpandedBiography(!expandedBiography)} style={styles.retry}><Text style={styles.retryText}>{expandedBiography ? (en ? 'Show less' : 'Daha az göster') : (en ? 'Read more' : 'Devamını oku')}</Text></Pressable>}</>}
    <Text style={styles.heading}>{en ? 'Filmography' : 'Filmografi'}</Text>
    <View style={styles.filters}><ChoicePicker label={en ? 'Content' : 'İçerik'} value={type} onChange={setType} closeLabel={en ? 'Close' : 'Kapat'} options={[{ value: 'all', label: en ? 'Movies & shows' : 'Filmler ve diziler' }, { value: 'movie', label: en ? 'Movies' : 'Filmler' }, { value: 'tv', label: en ? 'Shows' : 'Diziler' }]} /></View>
  </View>;
  return <Screen scroll={false}><FlatList key={columns} data={credits} keyExtractor={mediaKey} numColumns={columns} ListHeaderComponent={header} contentContainerStyle={styles.list} columnWrapperStyle={styles.row} initialNumToRender={12} renderItem={({item}) => <MediaCard media={item} width={cardWidth} inGrid />} ListEmptyComponent={<Text style={styles.message}>{en ? 'No titles found.' : 'Yapım bulunamadı.'}</Text>} /></Screen>;
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg }, back: { alignSelf: 'flex-start', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, marginBottom: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg }, name: { flex: 1, color: colors.text, fontSize: 28, fontWeight: '800', lineHeight: 34 },
  biography: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: spacing.lg }, heading: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: spacing.xl, marginBottom: spacing.md },
  filters: { flexDirection: 'row' }, list: { paddingBottom: 120 }, row: { paddingHorizontal: spacing.lg, justifyContent: 'space-between', marginBottom: spacing.lg }, state: { marginTop: 90, alignItems: 'center' }, message: { color: colors.muted, textAlign: 'center', padding: spacing.lg }, retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md }, retryText: { color: colors.primary },
});
