import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, AppStateStatus, Linking } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationSettings } from '../NotificationSettings';
import { fetchNotificationPreferences, updateNotificationPreferences } from '@/features/notifications/notification-repository';
import { enableNotifications, notificationsAreEnabled } from '@/services/notifications';
import { useProfileStore } from '@/store/profile-store';
const mockUser = { id: 'alice' };
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/features/notifications/notification-repository', () => ({ fetchNotificationPreferences: jest.fn(), updateNotificationPreferences: jest.fn() }));
jest.mock('@/services/notifications', () => ({ enableNotifications: jest.fn(), notificationsAreEnabled: jest.fn() }));
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })}><NotificationSettings /></QueryClientProvider>);
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks(); useProfileStore.setState({ language: 'tr' });
  jest.mocked(fetchNotificationPreferences).mockResolvedValue({ user_id: 'alice', new_episodes: true, social: true, push_enabled: true, time_zone: 'Europe/Istanbul', created_at: '2026-10-30' });
  jest.mocked(updateNotificationPreferences).mockResolvedValue();
  jest.mocked(notificationsAreEnabled).mockResolvedValue(false);
  jest.mocked(enableNotifications).mockResolvedValue(true);
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); jest.restoreAllMocks(); });
it.each(['tr', 'en'] as const)('opens device notification settings in %s', async (language) => {
  useProfileStore.setState({ language });
  const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const screen = await mount();
  await fireEvent.press(screen.getByText(language === 'en' ? 'Phone notification settings' : 'Telefon bildirim ayarları'));
  expect(open).toHaveBeenCalledTimes(1);
});
it('redirects a denied push toggle to the device instead of requesting permission again', async () => {
  const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const screen = await mount();
  const toggle = await screen.findByLabelText('Telefon bildirimleri');
  await fireEvent(toggle, 'valueChange', true);
  expect(open).toHaveBeenCalled();
  expect(enableNotifications).not.toHaveBeenCalled();
});
it('refreshes permission and registers push after returning from device settings', async () => {
  let onState!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => { onState = callback; return { remove: jest.fn() }; });
  jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const screen = await mount();
  await screen.findByLabelText('Yeni bölümler');
  await fireEvent.press(screen.getByText('Telefon bildirim ayarları'));
  jest.mocked(notificationsAreEnabled).mockResolvedValue(true);
  await act(async () => { onState('active'); });
  await waitFor(() => expect(enableNotifications).toHaveBeenCalledWith('alice'));
  await waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalledWith('alice', expect.objectContaining({ push_enabled: true })));
});
it('saves episode and social preferences independently', async () => {
  const screen = await mount();
  await fireEvent(await screen.findByLabelText('Yeni bölümler'), 'valueChange', false);
  await waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalledWith('alice', { new_episodes: false }));
});
