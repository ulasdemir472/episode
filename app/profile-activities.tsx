import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ProfileActivityRow } from '@/components/ProfileActivityRow';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchFriendActivity } from '@/features/friends/friends-repository';
import { colors, radius, spacing } from '@/theme/tokens';

export default function ProfileActivitiesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const query = useQuery({ queryKey: ['friend-profile', auth.user?.id, id], queryFn: () => fetchFriendActivity(auth.user!.id, id!), enabled: Boolean(auth.user && id), staleTime: 30_000 });
  return <Screen>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable><View style={styles.heading}><Text style={styles.title}>Tüm hareketler</Text><Text style={styles.subtitle}>{query.data ? `${query.data.activities.length} hareket` : 'Yükleniyor…'}</Text></View><View style={styles.spacer} /></View>
    {query.isLoading ? <Text style={styles.state}>Hareketler yükleniyor…</Text> : query.data?.activities.length ? <View style={styles.list}>{query.data.activities.map((activity) => <ProfileActivityRow key={activity.id} activity={activity} />)}</View> : <Text style={styles.state}>{query.error instanceof Error ? query.error.message : 'Henüz puan veya yorum hareketi yok.'}</Text>}
  </Screen>;
}

const styles = StyleSheet.create({ header: { height: 62, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, heading: { alignItems: 'center' }, title: { color: colors.text, fontSize: 17, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 10, marginTop: 2 }, spacer: { width: 40 }, list: { margin: spacing.lg, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, state: { color: colors.muted, textAlign: 'center', marginTop: 120 } });
