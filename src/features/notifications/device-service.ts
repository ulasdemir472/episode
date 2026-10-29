import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/infrastructure/supabase/client';

const TOKEN_KEY = 'episode-device-push-token';
export async function registerPushToken(userId: string): Promise<void> {
  if (!supabase || Platform.OS === 'web') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) throw new Error('Push project is not configured');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('new-episodes', { name: 'Episode', importance: Notifications.AndroidImportance.HIGH });
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { data: session } = await supabase.auth.getSession();
  if (session.session?.user.id !== userId) return;
  const { error } = await supabase.rpc('register_device_token', { target_token: token, target_platform: Platform.OS === 'android' ? 'android' : 'ios' });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((item) => String(item.content.data?.reminderKey ?? '').startsWith('episode:') || item.content.data?.route === '/releases').map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  } catch { /* Legacy reminder cleanup does not invalidate a confirmed push registration. */ }
}
export async function unregisterPushToken(userId: string): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (supabase && token) {
    const { error } = await supabase.from('devices').delete().eq('user_id', userId).eq('expo_push_token', token);
    if (error) throw error;
  }
  await AsyncStorage.removeItem(TOKEN_KEY);
  if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync();
}
