import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchNotificationPreferences, NotificationPreferences, updateNotificationPreferences } from '@/features/notifications/notification-repository';
import { enableNotifications, notificationsAreEnabled } from '@/services/notifications';
import { useProfileStore } from '@/store/profile-store';
import { t } from '@/i18n/strings';
import { colors, radius, spacing } from '@/theme/tokens';

export function NotificationSettings() {
  const { user } = useAuth();
  const language = useProfileStore((state) => state.language);
  const en = language === 'en';
  const client = useQueryClient();
  const returningFromSettings = useRef(false);
  const preferences = useQuery({ queryKey: ['notification-preferences', user?.id], queryFn: () => fetchNotificationPreferences(user!.id), enabled: Boolean(user) });
  const permission = useQuery({ queryKey: ['notification-permission', user?.id], queryFn: notificationsAreEnabled, enabled: Boolean(user), staleTime: 0, refetchOnMount: 'always' });
  const error = useCallback(() => Alert.alert(t(language, 'error'), t(language, 'notificationSaveError')), [language]);
  const save = useMutation({ mutationFn: (patch: Partial<NotificationPreferences>) => updateNotificationPreferences(user!.id, patch), onSuccess: () => client.invalidateQueries({ queryKey: ['notification-preferences', user?.id] }), onError: error });
  const openSettings = () => {
    returningFromSettings.current = true;
    void Linking.openSettings().catch(() => { returningFromSettings.current = false; error(); });
  };
  const refetchPermission = permission.refetch;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void refetchPermission().then(async ({ data: allowed }) => {
        if (!returningFromSettings.current || !user) return;
        returningFromSettings.current = false;
        if (allowed) await enableNotifications(user.id);
        await updateNotificationPreferences(user.id, { push_enabled: Boolean(allowed), time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul' });
        await client.invalidateQueries({ queryKey: ['notification-preferences', user.id] });
      }).catch(error);
    });
    return () => subscription.remove();
  }, [user, client, refetchPermission, error]);
  if (!user) return null;
  return <View style={styles.panel}><Text style={styles.heading}>{en ? 'Notifications' : 'Bildirimler'}</Text>
    {preferences.isLoading ? <ActivityIndicator color={colors.primary} /> : preferences.isError ? <Pressable onPress={() => preferences.refetch()}><Text style={styles.link}>{t(language, 'retry')}</Text></Pressable> : preferences.data && <>
      <Preference label={t(language, 'episodeNotifications')} value={preferences.data.new_episodes} disabled={save.isPending} onChange={(value) => save.mutate({ new_episodes: value })} />
      <Preference label={t(language, 'socialNotifications')} value={preferences.data.social} disabled={save.isPending} onChange={(value) => save.mutate({ social: value })} />
      <Preference label={t(language, 'pushNotifications')} value={preferences.data.push_enabled && permission.data === true} disabled={save.isPending || permission.isLoading} onChange={(value) => {
        if (value && permission.data !== true) { openSettings(); return; }
        if (value) void enableNotifications(user.id).then(() => save.mutate({ push_enabled: true })).catch(error);
        else save.mutate({ push_enabled: false });
      }} />
    </>}
    <Pressable accessibilityRole="button" onPress={openSettings} style={styles.row}><View style={styles.copy}><Text style={styles.label}>{en ? 'Phone notification settings' : 'Telefon bildirim ayarları'}</Text><Text style={styles.description}>{en ? 'Manage permission in your device settings.' : 'Bildirim iznini telefonunun ayarlarından yönet.'}</Text></View><View style={styles.control}><Ionicons name="open-outline" size={20} color={colors.primary} /></View></Pressable>
  </View>;
}
function Preference({ label, value, disabled, onChange }: { label: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.row}><View style={styles.copy}><Text style={styles.label}>{label}</Text></View><View style={styles.control}><Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.elevated }} /></View></View>;
}
const styles = StyleSheet.create({ panel: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }, heading: { color: colors.text, fontWeight: '800', fontSize: 17, marginBottom: spacing.sm }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingVertical: 8, gap: 12 }, label: { color: colors.text, fontSize: 14, lineHeight: 20 }, copy: { flex: 1 }, control: { width: 52, minHeight: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }, link: { color: colors.primary, paddingVertical: 10 } });
