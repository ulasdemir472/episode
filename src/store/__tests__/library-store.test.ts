import { Media, SeasonSummary } from '@/domain/media';
import { useLibraryStore } from '../library-store';

const show: Media = { id: 20, type: 'tv', title: 'Show', overview: '', posterUrl: '', backdropUrl: '', year: '2026', rating: 8, genres: [] };
const movie: Media = { ...show, id: 10, type: 'movie', title: 'Movie' };
const seasons: SeasonSummary[] = [
  { id: 1, number: 1, name: 'Season 1', episodeCount: 3 },
  { id: 2, number: 2, name: 'Season 2', episodeCount: 2 },
];

describe('library business rules', () => {
  beforeEach(() => useLibraryStore.setState({ items: [], watchedEpisodes: {} }));

  it('adds and removes a movie from the library', () => {
    useLibraryStore.getState().upsert(movie, 'watchlist');
    expect(useLibraryStore.getState().items).toMatchObject([{ status: 'watchlist', media: { id: 10 } }]);
    useLibraryStore.getState().remove(movie.id);
    expect(useLibraryStore.getState().items).toHaveLength(0);
  });

  it('moves a show to watching and exposes the next unwatched episode', () => {
    useLibraryStore.getState().toggleEpisode(show, 1, 1, seasons);
    expect(useLibraryStore.getState().items[0]).toMatchObject({ status: 'watching', progress: { watched: 1, total: 5, nextEpisode: { season: 1, episode: 2 } } });
  });

  it('marks every previous episode watched when marking through a later season', () => {
    useLibraryStore.getState().markThrough(show, 2, 1, seasons);
    expect(Object.keys(useLibraryStore.getState().watchedEpisodes)).toEqual(expect.arrayContaining(['20:1:1', '20:1:2', '20:1:3', '20:2:1']));
    expect(useLibraryStore.getState().items[0]).toMatchObject({ status: 'watching', progress: { watched: 4, nextEpisode: { season: 2, episode: 2 } } });
  });

  it('completes a show only when every known episode is watched', () => {
    useLibraryStore.getState().markThrough(show, 2, 2, seasons);
    expect(useLibraryStore.getState().items[0]).toMatchObject({ status: 'completed', progress: { watched: 5, total: 5 } });
    expect(useLibraryStore.getState().items[0]?.progress?.nextEpisode).toBeUndefined();
  });

  it('returns a completed show to watching when an episode is unchecked', () => {
    useLibraryStore.getState().markThrough(show, 2, 2, seasons);
    useLibraryStore.getState().toggleEpisode(show, 1, 2, seasons);
    expect(useLibraryStore.getState().items[0]).toMatchObject({ status: 'watching', progress: { watched: 4, nextEpisode: { season: 1, episode: 2 } } });
  });
});
