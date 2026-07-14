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

export async function scheduleEpisodeReminder(title: string, body: string, date: Date) {
  return Notifications.scheduleNotificationAsync({ content: { title, body, sound: 'default', data: { route: '/releases' } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date } });
}

export function NotificationBridge() {
  const auth = useAuth();
  useEffect(() => {
    if (!auth.user) return;
    Notifications.getPermissionsAsync().then((permission) => permission.granted ? registerPushToken(auth.user!.id) : undefined).catch(() => undefined);
  }, [auth.user]);
  return null;
}
