import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchUnreadCount } from '@/features/notifications/notification-repository';
import { t } from '@/i18n/strings';
import { useProfileStore } from '@/store/profile-store';
import { colors, radius, spacing } from '@/theme/tokens';

export function NotificationButton() {
  const { user } = useAuth();
  const language = useProfileStore((state) => state.language);
  const query = useQuery({ queryKey: ['notification-count', user?.id], queryFn: () => fetchUnreadCount(user!.id), enabled: Boolean(user), staleTime: 15_000, refetchOnMount: 'always' });
  if (!user) return null;
  const count = query.data ?? 0;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${t(language, 'notifications')}${count ? `, ${count} ${t(language, 'unread')}` : ''}`} onPress={() => router.push('/notifications' as Href)} style={styles.button}><Ionicons name="notifications-outline" size={20} color={colors.text} /><Text style={styles.label}>{t(language, 'notifications')}</Text>{count > 0 && <View style={styles.badge}><Text style={styles.count}>{count > 99 ? '99+' : count}</Text></View>}<Ionicons name="chevron-forward" size={16} color={colors.muted} /></Pressable>;
}
const styles = StyleSheet.create({ button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: spacing.lg, marginVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, label: { color: colors.text, fontWeight: '700', fontSize: 14, flex: 1 }, badge: { minWidth: 23, height: 23, borderRadius: 12, paddingHorizontal: 5, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, count: { color: '#fff', fontWeight: '800', fontSize: 12 } });
