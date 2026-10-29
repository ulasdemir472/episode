import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchUnreadCount } from '@/features/notifications/notification-repository';
import { t } from '@/i18n/strings';
import { useProfileStore } from '@/store/profile-store';
import { colors } from '@/theme/tokens';

export function NotificationButton() {
  const { user } = useAuth();
  const language = useProfileStore((state) => state.language);
  const query = useQuery({ queryKey: ['notification-count', user?.id], queryFn: () => fetchUnreadCount(user!.id), enabled: Boolean(user), staleTime: 15_000, refetchOnMount: 'always' });
  if (!user) return null;
  const count = query.data ?? 0;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${t(language, 'notifications')}${count ? `, ${count} ${t(language, 'unread')}` : ''}`} onPress={() => router.push('/notifications' as Href)} style={styles.button}><Ionicons name="notifications-outline" size={24} color={colors.text} />{count > 0 && <View style={styles.badge}><Text style={styles.count}>{count > 99 ? '99+' : count}</Text></View>}</Pressable>;
}
const styles = StyleSheet.create({ button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, badge: { position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' }, count: { color: '#fff', fontWeight: '800', fontSize: 9 } });
