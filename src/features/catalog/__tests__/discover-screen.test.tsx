import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DiscoverScreen from '../../../../app/(tabs)/discover';
import { catalogService } from '@/services/tmdb';
import { useProfileStore } from '@/store/profile-store';
import { Media } from '@/domain/media';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/components/NotificationButton', () => ({ NotificationButton: () => null }));
jest.mock('@/services/tmdb', () => ({ catalogService: { trending: jest.fn(), searchPage: jest.fn(), discoverPage: jest.fn() } }));
const movie = (id: number, title: string): Media => ({ id, title, type: 'movie', overview: '', posterUrl: '', backdropUrl: '', year: '2026', rating: 8, genres: [] });
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}><DiscoverScreen /></QueryClientProvider>);
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); useProfileStore.setState({ language: 'tr' });
  jest.mocked(catalogService.trending).mockResolvedValue([movie(1, 'Trending movie')]);
  jest.mocked(catalogService.searchPage).mockImplementation(async (query) => ({ items: [movie(2, `Found ${query}`)], nextPage: undefined }));
  jest.mocked(catalogService.discoverPage).mockImplementation(async (_type, options) => ({ items: [movie(options?.genreId ?? 3, options?.genreId === 28 ? 'Action movie' : options?.genreId === 35 ? 'Comedy movie' : 'Popular movie')], nextPage: undefined }));
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });
it.each(['tr', 'en'] as const)('searches after debounce and renders results in %s', async (language) => {
  useProfileStore.setState({ language });
  const screen = await mount();
  await screen.findByText('Trending movie');
  await fireEvent.changeText(screen.getByLabelText(language === 'en' ? 'Search movies or shows' : 'Dizi veya film ara'), 'Inception');
  expect(catalogService.searchPage).not.toHaveBeenCalled();
  expect(screen.queryByText(language === 'en' ? 'No results found.' : 'Sonuç bulunamadı.')).toBeNull();
  await act(async () => { jest.advanceTimersByTime(500); });
  expect(await screen.findByText('Found Inception')).toBeTruthy();
  expect(catalogService.searchPage).toHaveBeenCalledWith('Inception', 1, language);
  await fireEvent.press(screen.getByLabelText(language === 'en' ? 'Clear search' : 'Aramayı temizle'));
  expect(await screen.findByText('Trending movie')).toBeTruthy();
});
it('uses distinct genre parameters and an explicitly selected numeric rating', async () => {
  const screen = await mount();
  await fireEvent.press(screen.getByLabelText('İçerik: Tümü'));
  await fireEvent.press(screen.getByRole('radio', { name: 'Filmler' }));
  await screen.findByText('Popular movie');
  await fireEvent.press(screen.getByLabelText('Tür: Tüm türler'));
  await fireEvent.press(screen.getByRole('radio', { name: 'Aksiyon' }));
  expect(await screen.findByText('Action movie')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Tür: Aksiyon'));
  await fireEvent.press(screen.getByRole('radio', { name: 'Komedi' }));
  expect(await screen.findByText('Comedy movie')).toBeTruthy();
  const ratingButton = screen.getByLabelText(/Tüm puanlar/);
  await fireEvent.press(ratingButton);
  await fireEvent.press(screen.getByRole('radio', { name: '6,5+' }));
  await waitFor(() => expect(catalogService.discoverPage).toHaveBeenLastCalledWith('movie', expect.objectContaining({ genreId: 35, minRating: 6.5 }), 'tr'));
});
it('shows a retryable error rather than an empty result when search fails', async () => {
  jest.mocked(catalogService.searchPage).mockRejectedValue(new Error('offline'));
  const screen = await mount();
  await fireEvent.changeText(screen.getByLabelText('Dizi veya film ara'), 'Movie');
  await act(async () => { jest.advanceTimersByTime(500); });
  expect(await screen.findByText(/İçerikler yüklenemedi/)).toBeTruthy();
  expect(screen.queryByText('Sonuç bulunamadı.')).toBeNull();
});
