import { requireSupabase } from '@/infrastructure/supabase/client';
import type { Database } from '@/infrastructure/supabase/database.types';

export type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row'];
export async function fetchNotifications(userId: string, page = 0, unreadOnly = false) {
  let query = requireSupabase().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false });
  if (unreadOnly) query = query.is('read_at', null);
  const { data, error } = await query.range(page * 30, page * 30 + 29);
  if (error) throw error;
  return { items: data ?? [], nextPage: data?.length === 30 ? page + 1 : undefined };
}
export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await requireSupabase().from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}
export async function markNotificationsRead(userId: string, notificationId?: string): Promise<void> {
  let query = requireSupabase().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  if (notificationId) query = query.eq('id', notificationId);
  const { error } = await query;
  if (error) throw error;
}
export async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const client = requireSupabase();
  const result = await client.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (result.error) throw result.error;
  if (result.data) return result.data;
  const created = await client.from('notification_preferences').insert({ user_id: userId, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul' }).select().single();
  if (created.error) throw created.error;
  return created.data;
}
export async function updateNotificationPreferences(userId: string, patch: Partial<Pick<NotificationPreferences, 'new_episodes' | 'social' | 'push_enabled' | 'time_zone'>>): Promise<void> {
  const { error } = await requireSupabase().from('notification_preferences').update(patch).eq('user_id', userId).select('user_id').single();
  if (error) throw error;
}
