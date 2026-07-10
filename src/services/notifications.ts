import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function enableNotifications(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('new-episodes', { name: 'Yeni bölümler', importance: Notifications.AndroidImportance.HIGH });
  }
  await Notifications.scheduleNotificationAsync({
    content: { title: 'episode.', body: 'Bildirimler hazır 🎬 Yeni bölümleri artık kaçırmayacaksın.', sound: 'default', data: { route: '/releases', test: true } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
  });
  return true;
}

export async function scheduleEpisodeReminder(title: string, body: string, date: Date) {
  return Notifications.scheduleNotificationAsync({ content: { title, body, sound: 'default', data: { route: '/releases' } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date } });
}
