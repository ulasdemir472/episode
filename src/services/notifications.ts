import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/infrastructure/supabase/client';

async function registerPushToken(_userId: string): Promise<void> {
  if (!supabase || Platform.OS === 'web') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc('register_device_token', { target_token: token, target_platform: Platform.OS === 'android' ? 'android' : 'ios' });
  if (error) throw error;
}

export async function enableNotifications(userId?: string): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('new-episodes', { name: 'Yeni bölümler ve sosyal', importance: Notifications.AndroidImportance.HIGH });
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
  useEffect(() => {
    if (!auth.user) return;
    Notifications.getPermissionsAsync().then((permission) => permission.granted ? registerPushToken(auth.user!.id) : undefined).catch(() => undefined);
  }, [auth.user]);
  return null;
}
