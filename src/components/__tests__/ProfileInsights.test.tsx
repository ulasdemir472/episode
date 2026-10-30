import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileInsights } from '../ProfileInsights';
import { catalogService } from '@/services/tmdb';
import type { LibraryItem, Media } from '@/domain/media';

jest.mock('@/services/tmdb', () => ({ catalogService: { mediaDetails: jest.fn() }, translateGenre: (genre: string) => genre }));
const stored: Media = { id: 1668, type: 'tv', title: 'Sıkı Dostlar', overview: '', genres: ['Comedy'], year: '1994', rating: 8, posterUrl: '', backdropUrl: '' };
const library: LibraryItem[] = [{ media: stored, status: 'watching', progress: { watched: 100, total: 236 } }];
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });

it('refreshes a legacy Turkish title and refetches details when the app language changes', async () => {
  jest.mocked(catalogService.mediaDetails).mockResolvedValue({ ...stored, title: 'Friends' });
  const queryClient = client();
  const ui = (language: 'tr' | 'en') => <QueryClientProvider client={queryClient}><ProfileInsights library={library} language={language} /></QueryClientProvider>;
  const screen = await render(ui('en'));
  expect(await screen.findByText('Friends')).toBeTruthy();
  expect(screen.queryByText('Sıkı Dostlar')).toBeNull();
  expect(catalogService.mediaDetails).toHaveBeenCalledWith('tv', 1668, 'en');
  expect(screen.getByText('100 episodes')).toBeTruthy();
  await screen.rerender(ui('tr'));
  expect(await screen.findByText('Friends')).toBeTruthy();
  expect(await screen.findByText('100 bölüm')).toBeTruthy();
  expect(catalogService.mediaDetails).toHaveBeenCalledWith('tv', 1668, 'tr');
  expect(library[0]!.media.title).toBe('Sıkı Dostlar');
});

it('does not fetch a title for an empty viewing history', async () => {
  const screen = await render(<QueryClientProvider client={client()}><ProfileInsights library={[]} language="en" /></QueryClientProvider>);
  expect(screen.getByText('Most watched show')).toBeTruthy();
  expect(catalogService.mediaDetails).not.toHaveBeenCalled();
});
