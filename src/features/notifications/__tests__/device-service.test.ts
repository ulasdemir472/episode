import * as Notifications from 'expo-notifications';
import { registerPushToken, unregisterPushToken } from '../device-service';
import { supabase } from '@/infrastructure/supabase/client';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'project-1' } } } } }));
jest.mock('expo-notifications', () => ({ getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExpoPushToken[device]' })), setNotificationChannelAsync: jest.fn(), getAllScheduledNotificationsAsync: jest.fn(async () => []), cancelScheduledNotificationAsync: jest.fn(), cancelAllScheduledNotificationsAsync: jest.fn(), AndroidImportance: { HIGH: 4 } }));
jest.mock('@/infrastructure/supabase/client', () => ({ supabase: { rpc: jest.fn(), auth: { getSession: jest.fn() }, from: jest.fn() } }));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(supabase!.rpc).mockResolvedValue({ error: null } as never);
  jest.mocked(supabase!.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'alice' } } }, error: null } as never);
});
it('registers the token only for the current session', async () => {
  await registerPushToken('alice');
  expect(supabase!.rpc).toHaveBeenCalledWith('register_device_token', { target_token: 'ExpoPushToken[device]', target_platform: 'ios' });
  jest.mocked(supabase!.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'bob' } } }, error: null } as never);
  await registerPushToken('alice');
  expect(supabase!.rpc).toHaveBeenCalledTimes(1);
});
it('reports registration errors instead of pretending notifications are ready', async () => {
  jest.mocked(supabase!.rpc).mockResolvedValue({ error: new Error('offline') } as never);
  await expect(registerPushToken('alice')).rejects.toThrow('offline');
});
it('removes only this account and device registration when signing out', async () => {
  await registerPushToken('alice');
  const eq = jest.fn().mockReturnThis();
  const query = { delete: jest.fn().mockReturnThis(), eq, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  eq.mockImplementation(() => query);
  jest.mocked(supabase!.from).mockReturnValue(query as never);
  await unregisterPushToken('alice');
  expect(eq.mock.calls).toEqual([['user_id', 'alice'], ['expo_push_token', 'ExpoPushToken[device]']]);
  expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
});
