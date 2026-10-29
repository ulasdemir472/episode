import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppNotification, notificationCopy } from '@/features/notifications/notification-copy';
import { notificationRoute } from '@/features/notifications/notification-routing';
import { fetchNotificationPreferences, fetchNotifications, markNotificationsRead, NotificationPreferences, updateNotificationPreferences } from '@/features/notifications/notification-repository';
import { enableNotifications, notificationsAreEnabled } from '@/services/notifications';
import { useProfileStore } from '@/store/profile-store';
import { t } from '@/i18n/strings';
import { colors, radius, spacing } from '@/theme/tokens';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const language = useProfileStore((state) => state.language);
  const client = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const query = useInfiniteQuery({ queryKey: ['notifications', user?.id, unreadOnly], initialPageParam: 0, queryFn: ({ pageParam }) => fetchNotifications(user!.id, pageParam, unreadOnly), getNextPageParam: (last) => last.nextPage, enabled: Boolean(user), staleTime: 15_000, refetchOnMount: 'always' });
  const preferences = useQuery({ queryKey: ['notification-preferences', user?.id], queryFn: () => fetchNotificationPreferences(user!.id), enabled: Boolean(user) });
  const permission = useQuery({ queryKey: ['notification-permission', user?.id], queryFn: notificationsAreEnabled, enabled: Boolean(user), staleTime: 0, refetchOnMount: 'always' });
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['notifications', user?.id] }), client.invalidateQueries({ queryKey: ['notification-count', user?.id] })]); };
  const read = useMutation({ mutationFn: (id?: string) => markNotificationsRead(user!.id, id), onSuccess: refresh, onError: () => Alert.alert(t(language, 'error'), t(language, 'notificationSaveError')) });
  const savePreferences = useMutation({ mutationFn: (patch: Partial<Pick<NotificationPreferences, 'new_episodes' | 'social' | 'push_enabled'>>) => updateNotificationPreferences(user!.id, patch), onSuccess: () => client.invalidateQueries({ queryKey: ['notification-preferences', user?.id] }), onError: () => Alert.alert(t(language, 'error'), t(language, 'notificationSaveError')) });
  const enable = async () => {
    if (!user || enabling) return;
    setEnabling(true);
    try {
      const granted = await enableNotifications(user.id);
      if (!granted) Alert.alert(t(language, 'preferences'), t(language, 'permissionNeeded'));
      else { await updateNotificationPreferences(user.id, { push_enabled: true, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul' }); await client.invalidateQueries({ queryKey: ['notification-preferences', user.id] }); }
      await permission.refetch();
    } catch { Alert.alert(t(language, 'error'), t(language, 'registrationError')); }
    finally { setEnabling(false); }
  };
  const open = (notification: AppNotification) => {
    if (!notification.read_at) read.mutate(notification.id);
    router.push(notificationRoute(notification.data) as Href);
  };
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];
  const header = <>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel={t(language, 'back')} onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable><Text style={styles.title}>{t(language, 'notifications')}</Text></View>
    <View style={styles.preferences}><Text style={styles.sectionTitle}>{t(language, 'preferences')}</Text>
      {preferences.isLoading ? <ActivityIndicator color={colors.primary} /> : preferences.isError ? <Pressable onPress={() => preferences.refetch()}><Text style={styles.error}>{t(language, 'notificationSaveError')} {t(language, 'retry')}</Text></Pressable> : preferences.data && <>
        <Preference label={t(language, 'episodeNotifications')} value={preferences.data.new_episodes} disabled={savePreferences.isPending} onChange={(value) => savePreferences.mutate({ new_episodes: value })} />
        <Preference label={t(language, 'socialNotifications')} value={preferences.data.social} disabled={savePreferences.isPending} onChange={(value) => savePreferences.mutate({ social: value })} />
        <Preference label={t(language, 'pushNotifications')} value={preferences.data.push_enabled && permission.data === true} disabled={savePreferences.isPending || enabling} onChange={(value) => value ? void enable() : savePreferences.mutate({ push_enabled: false })} />
      </>}
      <Text style={styles.note}>{t(language, 'episodeNotificationNote')}</Text>
      {permission.data === false && <Pressable disabled={enabling} accessibilityRole="button" onPress={() => void enable()} style={styles.enable}><Text style={styles.enableText}>{enabling ? t(language, 'loading') : t(language, 'enablePush')}</Text></Pressable>}
    </View>
    <View style={styles.actions}><View style={styles.filters}>{[false, true].map((value) => <Pressable key={String(value)} accessibilityRole="tab" accessibilityState={{ selected: unreadOnly === value }} onPress={() => setUnreadOnly(value)} style={[styles.filter, unreadOnly === value && styles.active]}><Text style={[styles.filterText, unreadOnly === value && styles.activeText]}>{t(language, value ? 'unread' : 'all')}</Text></Pressable>)}</View><Pressable accessibilityRole="button" disabled={read.isPending} onPress={() => read.mutate(undefined)} style={styles.mark}><Text style={styles.markText}>{t(language, 'markAllRead')}</Text></Pressable></View>
  </>;
  return <Screen scroll={false}><FlatList data={rows} keyExtractor={(item) => item.id} ListHeaderComponent={header} contentContainerStyle={styles.list} refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { void query.refetch(); void preferences.refetch(); void permission.refetch(); }} onEndReached={() => { if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage(); }} onEndReachedThreshold={0.4} ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null} ListEmptyComponent={query.isLoading ? <ActivityIndicator color={colors.primary} /> : query.isError ? <View style={styles.empty}><Text style={styles.body}>{t(language, 'notificationError')}</Text><Pressable accessibilityRole="button" onPress={() => query.refetch()} style={styles.enable}><Text style={styles.enableText}>{t(language, 'retry')}</Text></Pressable></View> : <View style={styles.empty}><Ionicons name="notifications-off-outline" size={38} color={colors.muted} /><Text style={styles.emptyTitle}>{t(language, unreadOnly ? 'noUnread' : 'noNotifications')}</Text><Text style={styles.body}>{t(language, 'noNotificationsBody')}</Text></View>} renderItem={({ item }) => {
    const copy = notificationCopy(item, language);
    return <Pressable accessibilityRole="button" accessibilityLabel={`${copy.title}, ${copy.body}${item.read_at ? '' : `, ${t(language, 'unread')}`}`} onPress={() => open(item)} style={[styles.item, !item.read_at && styles.unreadItem]}><View style={styles.icon}><Ionicons name={item.type === 'new_episode' ? 'tv-outline' : item.type === 'comment_like' ? 'heart-outline' : item.type === 'comment_reply' ? 'chatbubble-outline' : 'people-outline'} color={colors.primary} size={23} /></View><View style={styles.copy}><Text style={styles.itemTitle}>{copy.title}</Text><Text style={styles.body}>{copy.body}</Text><Text style={styles.date}>{new Date(item.created_at).toLocaleString(language === 'en' ? 'en-US' : 'tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text></View>{!item.read_at && <View style={styles.dot} />}</Pressable>;
  }} /></Screen>;
}

function Preference({ label, value, disabled, onChange }: { label: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) { return <View style={styles.preference}><Text style={styles.preferenceLabel}>{label}</Text><Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary, false: colors.elevated }} /></View>; }
const styles = StyleSheet.create({ list: { paddingBottom: 40 }, header: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.text, fontSize: 25, fontWeight: '900', flex: 1 }, preferences: { marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 17, marginBottom: spacing.sm }, preference: { minHeight: 48, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'space-between' }, preferenceLabel: { flex: 1, color: colors.text, fontSize: 14 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm }, enable: { padding: 13, alignSelf: 'flex-start', marginTop: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primary }, enableText: { color: '#fff', fontWeight: '800', fontSize: 13 }, actions: { padding: spacing.lg, gap: spacing.md }, filters: { flexDirection: 'row', gap: spacing.sm }, filter: { borderRadius: radius.pill, backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 12 }, active: { backgroundColor: colors.text }, filterText: { color: colors.muted, fontWeight: '800' }, activeText: { color: colors.background }, mark: { alignSelf: 'flex-end', minHeight: 40, justifyContent: 'center' }, markText: { color: colors.primary, fontSize: 13, fontWeight: '700' }, item: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.surface }, unreadItem: { borderColor: 'rgba(255,90,71,.4)' }, icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, itemTitle: { color: colors.text, fontSize: 15, fontWeight: '800' }, body: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 }, date: { color: colors.muted, fontSize: 12, marginTop: 8 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }, empty: { margin: spacing.xl, alignItems: 'center' }, emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: spacing.md }, error: { color: colors.primary, lineHeight: 20 } });
