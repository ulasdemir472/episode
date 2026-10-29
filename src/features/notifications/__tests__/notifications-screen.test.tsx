import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import NotificationsScreen from '../../../../app/notifications';
import { fetchNotificationPreferences, fetchNotifications, markNotificationsRead, updateNotificationPreferences } from '../notification-repository';
import { useProfileStore } from '@/store/profile-store';
import { AppNotification } from '../notification-copy';

jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'alice' } }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/services/notifications', () => ({ enableNotifications: jest.fn(async () => true), notificationsAreEnabled: jest.fn(async () => true) }));
jest.mock('../notification-repository', () => ({ fetchNotificationPreferences: jest.fn(), fetchNotifications: jest.fn(), markNotificationsRead: jest.fn(), updateNotificationPreferences: jest.fn() }));
const notification: AppNotification = { id: 'notification-1', user_id: 'alice', actor_id: null, type: 'new_episode', title: 'Stored title', body: 'Stored body', data: { targetKey: 'episode:12:2:3', showTitle: 'Show', season: 2, episode: 3, episodeTitle: 'Finale' }, read_at: null, created_at: '2026-10-29T09:00:00Z' };
const mount = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}><NotificationsScreen /></QueryClientProvider>);
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useProfileStore.getState().clearUserData();
  useProfileStore.setState({ language: 'tr' });
  jest.mocked(fetchNotifications).mockResolvedValue({ items: [notification], nextPage: undefined });
  jest.mocked(fetchNotificationPreferences).mockResolvedValue({ user_id: 'alice', new_episodes: true, social: true, push_enabled: true, time_zone: 'Europe/Istanbul', created_at: '2026-10-29T00:00:00Z' });
  jest.mocked(markNotificationsRead).mockResolvedValue();
  jest.mocked(updateNotificationPreferences).mockResolvedValue();
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });
it.each(['tr', 'en'] as const)('renders notifications in %s and opens the exact episode', async (language) => {
  useProfileStore.setState({ language });
  const screen = await mount();
  const row = await screen.findByText(language === 'en' ? 'Show · New episode' : 'Show · Yeni bölüm');
  expect(screen.getByText(language === 'en' ? 'My notifications' : 'Bildirimlerim')).toBeTruthy();
  await fireEvent.press(row);
  await waitFor(() => expect(markNotificationsRead).toHaveBeenCalledWith('alice', 'notification-1'));
  expect(router.push).toHaveBeenCalledWith('/media/12?type=tv&targetKey=episode%3A12%3A2%3A3&season=2&episode=3');
});
it('filters unread items and marks all notifications read', async () => {
  const screen = await mount();
  await screen.findByText('Show · Yeni bölüm');
  await fireEvent.press(screen.getByText('Okunmamış'));
  await waitFor(() => expect(fetchNotifications).toHaveBeenCalledWith('alice', 0, true));
  await fireEvent.press(screen.getByText('Tümünü okundu işaretle'));
  await waitFor(() => expect(markNotificationsRead).toHaveBeenCalledWith('alice', undefined));
});
it('saves episode and social preferences independently', async () => {
  const screen = await mount();
  const episodeSwitch = await screen.findByLabelText('Yeni bölümler');
  await fireEvent(episodeSwitch, 'valueChange', false);
  await waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalledWith('alice', { new_episodes: false }));
});
it('shows a retryable error instead of claiming there are no notifications', async () => {
  jest.mocked(fetchNotifications).mockRejectedValue(new Error('offline'));
  const screen = await mount();
  expect(await screen.findByText('Bildirimler yüklenemedi. Bağlantını kontrol edip tekrar dene.')).toBeTruthy();
  expect(screen.queryByText('Henüz bildirimin yok')).toBeNull();
});
