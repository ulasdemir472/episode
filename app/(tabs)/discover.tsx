import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { MediaCard } from '@/components/MediaCard';
import { catalogService } from '@/services/tmdb';
import { colors, radius, spacing } from '@/theme/tokens';

export default function DiscoverScreen() {
  const [query, setQuery] = useState('');
  const search = useQuery({ queryKey: ['search', query], queryFn: () => catalogService.search(query), enabled: query.trim().length > 1 });
  const trending = useQuery({ queryKey: ['trending'], queryFn: catalogService.trending });
  const data = query.trim().length > 1 ? search.data ?? [] : trending.data ?? [];
  return <Screen>
    <View style={styles.header}><Text style={styles.kicker}>YENİ BİR HİKÂYE BUL</Text><Text style={styles.title}>Keşfet</Text><View style={styles.search}><Ionicons name="search" size={20} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Dizi veya film ara..." placeholderTextColor={colors.muted} style={styles.input} autoCorrect={false} returnKeyType="search" />{query.length > 0 && <Ionicons name="close-circle" size={19} color={colors.muted} onPress={() => setQuery('')} />}</View></View>
    {(search.isFetching || trending.isLoading) ? <ActivityIndicator color={colors.primary} /> : <FlatList scrollEnabled={false} data={data} keyExtractor={(item) => `${item.type}-${item.id}`} numColumns={2} columnWrapperStyle={styles.row} contentContainerStyle={styles.grid} renderItem={({ item }) => <MediaCard media={item} width={158} />} ListEmptyComponent={<Text style={styles.empty}>Sonuç bulunamadı.</Text>} />}
  </Screen>;
}
const styles = StyleSheet.create({ header: { padding: spacing.lg }, kicker: { color: colors.primary, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' }, title: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1.2, marginTop: 3 }, search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, height: 52, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: spacing.lg }, input: { color: colors.text, flex: 1, fontSize: 15 }, grid: { paddingHorizontal: spacing.lg }, row: { justifyContent: 'space-between', marginBottom: spacing.lg }, empty: { color: colors.muted, textAlign: 'center', marginTop: 80 } });

