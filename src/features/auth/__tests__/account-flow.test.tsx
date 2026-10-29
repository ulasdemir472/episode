import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../AuthProvider';
import { deleteUserAccount } from '../account-service';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { useCommunityStore } from '@/store/community-store';
import { supabase } from '@/infrastructure/supabase/client';

jest.mock('../account-service', () => ({ deleteUserAccount: jest.fn() }));
jest.mock('@/features/notifications/device-service', () => ({ unregisterPushToken: jest.fn(async () => undefined) }));
jest.mock('@/features/sync/user-sync-service', () => ({ hydrateAndSyncUser: jest.fn(async () => undefined), persistCurrentUserState: jest.fn(async () => undefined), StaleSyncError: class extends Error {} }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-linking', () => ({ getInitialURL: jest.fn(async () => null), addEventListener: jest.fn(() => ({ remove: jest.fn() })), parse: jest.fn(() => ({})) }));
jest.mock('@/infrastructure/supabase/client', () => ({ isSupabaseConfigured: true, supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'alice', email: 'alice@example.test' } } } })), onAuthStateChange: jest.fn(() => ({ data: { listener: null, subscription: { unsubscribe: jest.fn() } } })), signOut: jest.fn(async () => ({ error: null })) } } }));
function Probe() {
  const auth = useAuth();
  const [result, setResult] = useState('');
  return <View><Text>{auth.user?.id ?? 'signed-out'}</Text><Button title="Delete" onPress={() => { void auth.deleteAccount().then((value) => setResult(value.error ?? 'confirmed')); }} /><Text>{result}</Text></View>;
}
beforeEach(() => {
  jest.clearAllMocks();
  useLibraryStore.getState().clearUserData(); useProfileStore.getState().clearUserData(); useCommunityStore.getState().clearUserData();
  useProfileStore.setState({ language: 'tr' });
  useLibraryStore.getState().upsert({ id: 12, type: 'movie', title: 'Movie', genres: [], overview: '', year: '2026', posterUrl: '', backdropUrl: '', rating: 8 }, 'completed');
});
it.each(['tr', 'en'] as const)('keeps the account and local data after a failed deletion, with a %s error', async (language) => {
  useProfileStore.setState({ language });
  jest.mocked(deleteUserAccount).mockRejectedValue(new Error('offline'));
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const screen = await render(<QueryClientProvider client={client}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>);
  await screen.findByText('alice');
  client.setQueryData(['private-data'], 'keep');
  await fireEvent.press(screen.getByText('Delete'));
  await screen.findByText(language === 'en' ? 'Your account could not be deleted. Check your connection and try again.' : 'Hesabın silinemedi. Bağlantını kontrol edip tekrar dene.');
  expect(useLibraryStore.getState().items).toHaveLength(1);
  expect(client.getQueryData(['private-data'])).toBe('keep');
  expect(supabase!.auth.signOut).not.toHaveBeenCalled();
});
it('clears local account data only after deletion is confirmed', async () => {
  jest.mocked(deleteUserAccount).mockResolvedValue();
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const screen = await render(<QueryClientProvider client={client}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>);
  await screen.findByText('alice');
  client.setQueryData(['private-data'], 'remove');
  await fireEvent.press(screen.getByText('Delete'));
  await screen.findByText('confirmed');
  await waitFor(() => expect(useLibraryStore.getState().items).toHaveLength(0));
  expect(client.getQueryData(['private-data'])).toBeUndefined();
});
