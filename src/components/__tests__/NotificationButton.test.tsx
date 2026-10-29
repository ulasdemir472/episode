import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { NotificationButton } from '../NotificationButton';
import { fetchUnreadCount } from '@/features/notifications/notification-repository';
import { useProfileStore } from '@/store/profile-store';
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'alice' } }) }));
jest.mock('@/features/notifications/notification-repository', () => ({ fetchUnreadCount: jest.fn(async () => 3) }));
it.each(['tr', 'en'] as const)('opens the inbox from a compact bell with an unread count in %s', async (language) => {
  useProfileStore.setState({ language });
  jest.mocked(fetchUnreadCount).mockResolvedValue(3);
  const screen = await render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })}><NotificationButton /></QueryClientProvider>);
  await screen.findByText('3');
  expect(screen.queryByText(language === 'en' ? 'My notifications' : 'Bildirimlerim')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /3/ }));
  expect(router.push).toHaveBeenCalledWith('/notifications');
});
