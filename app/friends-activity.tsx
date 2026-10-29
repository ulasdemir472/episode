import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ProfileActivityRow } from '@/components/ProfileActivityRow';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchFriendsFeed } from '@/features/friends/friends-repository';
import { useProfileStore } from '@/store/profile-store';
import { t } from '@/i18n/strings';
import { colors, radius, spacing } from '@/theme/tokens';

export default function FriendsActivityScreen() {
  const { user } = useAuth();
  const language = useProfileStore((state) => state.language);
  const en = language === 'en';
  const feed = useQuery({ queryKey: ['friends-feed', user?.id], queryFn: () => fetchFriendsFeed(user!.id), enabled: Boolean(user), staleTime: 30_000, refetchOnMount: 'always' });
  return <Screen scroll={false}><FlatList data={feed.data ?? []} keyExtractor={(item) => item.activity.id} contentContainerStyle={{ paddingBottom: 40 }} refreshing={feed.isRefetching} onRefresh={() => { void feed.refetch(); }} ListHeaderComponent={<View style={styles.header}><Pressable onPress={() => router.back()} accessibilityLabel={t(language, 'back')} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable><Text style={styles.title}>{en ? 'Friends are watching' : 'Arkadaşların ne izliyor?'}</Text></View>} ListEmptyComponent={feed.isLoading ? <ActivityIndicator color={colors.primary} /> : feed.isError ? <Pressable onPress={() => feed.refetch()}><Text style={styles.empty}>{en ? 'Could not load activity.' : 'Hareketler yüklenemedi.'} {t(language, 'retry')}</Text></Pressable> : <Text style={styles.empty}>{en ? 'Your friends’ recent ratings and comments will appear here.' : 'Arkadaşlarının son puanları ve yorumları burada görünecek.'}</Text>} renderItem={({ item }) => <View style={styles.item}><Pressable onPress={() => router.push({ pathname: '/profile/[id]', params: { id: item.profile.id } })}><Text style={styles.name}>{`${item.profile.firstName} ${item.profile.lastName}`.trim() || item.profile.username}</Text></Pressable><ProfileActivityRow activity={item.activity} /></View>} /></Screen>;
}
const styles = StyleSheet.create({ header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.text, flex: 1, fontSize: 24, fontWeight: '900' }, item: { marginHorizontal: spacing.lg, marginBottom: spacing.md, paddingTop: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface }, name: { color: colors.text, fontWeight: '800', fontSize: 14, marginHorizontal: spacing.md }, empty: { margin: spacing.xl, color: colors.muted, textAlign: 'center', fontSize: 14, lineHeight: 22 } });
