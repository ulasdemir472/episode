import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContinueWatching } from '../ContinueWatching';
import { catalogService } from '@/services/tmdb';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { Media } from '@/domain/media';

jest.mock('@/services/tmdb', () => ({ catalogService: { seriesDetails: jest.fn(), seasonEpisodes: jest.fn() } }));
const show: Media = { id: 12, type: 'tv', title: 'Show', genres: [], overview: '', posterUrl: '', backdropUrl: '', year: '2026', rating: 8 };
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useLibraryStore.getState().clearUserData();
  useProfileStore.setState({ language: 'tr' });
  useLibraryStore.getState().toggleEpisode(show, 1, 1, [{ id: 1, number: 1, name: 'Season 1', episodeCount: 3 }]);
  jest.mocked(catalogService.seriesDetails).mockResolvedValue({ seasons: [{ id: 1, number: 1, name: 'Season 1', episodeCount: 3 }], episodeRunTime: 24 });
  jest.mocked(catalogService.seasonEpisodes).mockResolvedValue([{ id: 2, number: 2, seasonNumber: 1, title: 'Two', overview: '', runtime: 31, airDate: '2026-01-01', tmdbRating: 8 }]);
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } })}><ContinueWatching item={useLibraryStore.getState().items[0]!} /></QueryClientProvider>);
it('marks the next episode watched and advances progress in one tap', async () => {
  const screen = await mount();
  await fireEvent.press(screen.getByLabelText('Show S1 B2 izlendi işaretle'));
  await waitFor(() => expect(useLibraryStore.getState().watchedEpisodes['12:1:2']).toBe(true));
  expect(useLibraryStore.getState().items[0]?.progress?.nextEpisode).toEqual({ season: 1, episode: 3 });
  expect(useLibraryStore.getState().episodeRuntimes['12:1:2']).toBe(31);
});
it('does not mark an unreleased episode watched', async () => {
  jest.mocked(catalogService.seasonEpisodes).mockResolvedValue([{ id: 2, number: 2, seasonNumber: 1, title: 'Two', overview: '', airDate: '2099-01-01', tmdbRating: 8 }]);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = await mount();
  await fireEvent.press(screen.getByLabelText('Show S1 B2 izlendi işaretle'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('Bölüm güncellenemedi', 'Bu bölüm henüz yayınlanmadı.'));
  expect(useLibraryStore.getState().watchedEpisodes['12:1:2']).toBeUndefined();
  alert.mockRestore();
});
