import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function enableNotifications(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('new-episodes', { name: 'Yeni bölümler', importance: Notifications.AndroidImportance.HIGH });
  }
  return true;
}

export async function scheduleEpisodeReminder(title: string, body: string, date: Date) {
  return Notifications.scheduleNotificationAsync({ content: { title, body, data: { route: '/releases' } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date } });
}
