import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { router, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/infrastructure/supabase/client';
import { registerPushToken } from '@/features/notifications/device-service';
import { notificationRoute } from '@/features/notifications/notification-routing';
import { markNotificationsRead } from '@/features/notifications/notification-repository';

export async function enableNotifications(userId?: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('new-episodes', { name: 'Episode', importance: Notifications.AndroidImportance.HIGH });
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  if (userId) await registerPushToken(userId);
  return true;
}

export async function notificationsAreEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

let reminderQueue: Promise<void> = Promise.resolve();

export function scheduleEpisodeReminder(episodeId: string, title: string, body: string, date: Date) {
  const task = reminderQueue.then(async () => {
    const reminderKey = `episode:${episodeId}`;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const duplicates = scheduled.filter((notification) => notification.content.data?.reminderKey === reminderKey
      || (notification.content.data?.route === '/releases' && notification.content.title === title && notification.content.body === body));
    await Promise.all(duplicates.map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
    return Notifications.scheduleNotificationAsync({ content: { title, body, sound: 'default', data: { route: '/releases', reminderKey } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date } });
  });
  reminderQueue = task.then(() => undefined, () => undefined);
  return task;
}

export function NotificationBridge() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const userId = auth.user?.id;
  const [response, setResponse] = useState<Notifications.NotificationResponse | null>(null);
  const handledResponse = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.getLastNotificationResponseAsync().then(setResponse).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(setResponse);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!userId || auth.loading || !response) return;
    if (handledResponse.current === response.notification.request.identifier) return;
    handledResponse.current = response.notification.request.identifier;
    const data = response.notification.request.content.data ?? {};
    // A notification from a previous account must never open in another account.
    if (!data.userId || data.userId === userId) {
      router.push(notificationRoute(data) as Href);
      if (typeof data.notificationId === 'string') void markNotificationsRead(userId, data.notificationId).then(() => queryClient.invalidateQueries({ queryKey: ['notification-count', userId] })).catch(() => undefined);
    }
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }, [auth.loading, queryClient, response, userId]);
  useEffect(() => {
    if (!userId || !supabase) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      void queryClient.invalidateQueries({ queryKey: ['notification-count', userId] });
      void queryClient.invalidateQueries({ queryKey: ['notification-permission', userId] });
    };
    const register = () => Notifications.getPermissionsAsync().then((permission) => permission.granted ? registerPushToken(userId) : undefined).catch(() => undefined);
    if (Platform.OS !== 'web') void register();
    const channel = supabase.channel(`notification-inbox:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, refresh).subscribe();
    const foreground = AppState.addEventListener('change', (state) => { if (state === 'active') { refresh(); if (Platform.OS !== 'web') void register(); } });
    const received = Platform.OS !== 'web' ? Notifications.addNotificationReceivedListener(refresh) : undefined;
    return () => { foreground.remove(); received?.remove(); void supabase?.removeChannel(channel); };
  }, [queryClient, userId]);
  return null;
}
