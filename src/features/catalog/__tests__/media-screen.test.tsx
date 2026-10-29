import { act, fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MediaDetailScreen from '../../../../app/media/[id]';
import { catalogService } from '@/services/tmdb';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import type { Media } from '@/domain/media';

const mockParams = { id: '12', type: 'movie' };
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'alice' } }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/components/CommunityPanel', () => ({ CommunityPanel: jest.requireActual('react-native').View }));
jest.mock('@/services/tmdb', () => ({ catalogService: { mediaDetails: jest.fn(), imdbTitleRating: jest.fn(), recommendations: jest.fn(), titleExtras: jest.fn() }, translateGenre: (value: string) => value }));
const movie: Media = { id: 12, type: 'movie', title: 'Movie loaded by id', overview: 'Overview', genres: ['Drama'], year: '2026', rating: 8, posterUrl: 'https://example.test/poster.jpg', backdropUrl: 'https://example.test/backdrop.jpg', runtimeMinutes: 120 };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}><MediaDetailScreen /></QueryClientProvider>);
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useLibraryStore.getState().clearUserData(); useProfileStore.getState().clearUserData();
  jest.mocked(catalogService.mediaDetails).mockResolvedValue(movie);
  jest.mocked(catalogService.imdbTitleRating).mockResolvedValue(undefined);
  jest.mocked(catalogService.recommendations).mockResolvedValue([]);
  jest.mocked(catalogService.titleExtras).mockResolvedValue({ providers: undefined, cast: [], director: undefined, trailerUrl: undefined });
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });
it.each(['tr', 'en'] as const)('loads a standalone media link and displays controls in %s', async (language) => {
  useProfileStore.setState({ language });
  const screen = await mount();
  expect(await screen.findByText('Movie loaded by id')).toBeTruthy();
  expect(catalogService.mediaDetails).toHaveBeenCalledWith('movie', 12, language);
  expect(screen.getByText(language === 'en' ? 'Add to list' : 'Listeme ekle')).toBeTruthy();
  expect(screen.getByText(language === 'en' ? 'Where to watch' : 'Nereden izlerim?')).toBeTruthy();
});
it('preserves the previous status when undoing a removal', async () => {
  useProfileStore.setState({ language: 'tr' });
  useLibraryStore.getState().upsert(movie, 'completed');
  const screen = await mount();
  await screen.findByText('Movie loaded by id');
  await fireEvent.press(screen.getByText('Listemde'));
  await fireEvent.press(screen.getByText('Listemden kaldır'));
  expect(useLibraryStore.getState().items).toHaveLength(0);
  await fireEvent.press(screen.getByText('Geri al'));
  expect(useLibraryStore.getState().items).toMatchObject([{ status: 'completed', media: { id: 12 } }]);
});
it('shows an actionable error for failed detail fetches', async () => {
  useProfileStore.setState({ language: 'en' });
  jest.mocked(catalogService.mediaDetails).mockRejectedValue(new Error('offline'));
  const screen = await mount();
  expect(await screen.findByText('Could not load this title. Check your connection and try again.')).toBeTruthy();
  expect(screen.getByText('Try again')).toBeTruthy();
});
