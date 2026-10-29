import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomeScreen from '../../../../app/(tabs)/index';
import ReleasesScreen from '../../../../app/(tabs)/releases';
import { catalogService } from '@/services/tmdb';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/components/NotificationButton', () => ({ NotificationButton: () => null }));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'alice' } }) }));
jest.mock('@/services/tmdb', () => ({ catalogService: { trending: jest.fn(), episodeSchedule: jest.fn(), recommendations: jest.fn() } }));
beforeEach(() => {
  jest.useFakeTimers(); useLibraryStore.getState().clearUserData(); useProfileStore.setState({ language: 'tr', favorites: [] });
  useLibraryStore.getState().toggleEpisode({ id: 1, type: 'tv', title: 'My show', overview: '', posterUrl: '', backdropUrl: '', year: '2026', rating: 8, genres: [] }, 1, 1, [{ id: 1, number: 1, name: 'Season 1', episodeCount: 3 }]);
  jest.mocked(catalogService.trending).mockResolvedValue([]);
  jest.mocked(catalogService.episodeSchedule).mockResolvedValue([]);
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });
const mount = (element: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } })}>{element}</QueryClientProvider>);
it('keeps continue watching out of Home', async () => {
  const screen = await mount(<HomeScreen />);
  expect(screen.queryByText('Kaldığın yer')).toBeNull();
  expect(screen.queryByLabelText(/izlendi işaretle/)).toBeNull();
});
it('keeps continue watching in Episodes without a push activation button', async () => {
  const screen = await mount(<ReleasesScreen />);
  expect(screen.getByText('Kaldığın yer')).toBeTruthy();
  expect(screen.getByLabelText('My show S1 B2 izlendi işaretle')).toBeTruthy();
  expect(screen.queryByText('Telefon bildirimlerini aç')).toBeNull();
});
