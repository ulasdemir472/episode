import { Media, SeasonSummary } from '@/domain/media';
import { useLibraryStore } from '../library-store';

const show: Media = { id: 20, type: 'tv', title: 'Show', overview: '', posterUrl: '', backdropUrl: '', year: '2026', rating: 8, genres: [] };
const movie: Media = { ...show, id: 10, type: 'movie', title: 'Movie' };
const seasons: SeasonSummary[] = [
  { id: 1, number: 1, name: 'Season 1', episodeCount: 3 },
  { id: 2, number: 2, name: 'Season 2', episodeCount: 2 },
];

describe('library business rules', () => {
  beforeEach(() => useLibraryStore.getState().clearUserData());

  it('adds and removes a movie from the library', () => {
    useLibraryStore.getState().upsert(movie, 'watchlist');
    expect(useLibraryStore.getState().items).toMatchObject([{ status: 'watchlist', media: { id: 10 } }]);
    useLibraryStore.getState().remove(movie);
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

  it('moves the most recently updated show to the front', () => {
    const otherShow = { ...show, id: 21, title: 'Other Show' };
    useLibraryStore.getState().toggleEpisode(show, 1, 1, seasons);
    useLibraryStore.getState().toggleEpisode(otherShow, 1, 1, seasons);
    useLibraryStore.getState().toggleEpisode(show, 1, 2, seasons);
    expect(useLibraryStore.getState().items.map((item) => item.media.id)).toEqual([20, 21]);
  });

  it('reopens a completed show when a new episode has aired', () => {
    useLibraryStore.getState().markThrough(show, 2, 2, seasons);
    useLibraryStore.getState().reopenForEpisode(show, 3, 1);
    expect(useLibraryStore.getState().items[0]).toMatchObject({
      status: 'watching',
      progress: { watched: 5, total: 6, nextEpisode: { season: 3, episode: 1 } },
    });
  });

  it('stores the runtime when an episode is marked watched', () => {
    useLibraryStore.getState().toggleEpisode(show, 1, 1, seasons, 23);
    expect(useLibraryStore.getState().episodeRuntimes['20:1:1']).toBe(23);
    expect(useLibraryStore.getState().items[0]?.progress?.runtimeMinutes).toBe(23);
  });

  it('backfills a series runtime and replaces it with an exact episode runtime', () => {
    useLibraryStore.getState().markThrough(show, 1, 2, seasons);
    useLibraryStore.getState().recordEpisodeRuntimes(show.id, {}, 25);
    expect(useLibraryStore.getState().episodeRuntimes).toMatchObject({ '20:1:1': 25, '20:1:2': 25 });
    useLibraryStore.getState().recordEpisodeRuntimes(show.id, { '20:1:2': 31 }, 25);
    expect(useLibraryStore.getState().episodeRuntimes['20:1:2']).toBe(31);
  });

  it('does not publish another store update when episode runtimes are already current', () => {
    useLibraryStore.getState().toggleEpisode(show, 1, 1, seasons, 25);
    const previousState = useLibraryStore.getState();
    useLibraryStore.getState().recordEpisodeRuntimes(show.id, { '20:1:1': 25 }, 25);
    expect(useLibraryStore.getState()).toBe(previousState);
  });

  it('uses stored season metadata to advance from the continue button', () => {
    useLibraryStore.getState().toggleEpisode(show, 1, 1, seasons, 24);
    expect(useLibraryStore.getState().items[0]?.progress?.nextEpisode).toEqual({ season: 1, episode: 2 });
    useLibraryStore.getState().toggleEpisode(show, 1, 2, [], 24);
    expect(useLibraryStore.getState().items[0]?.progress?.nextEpisode).toEqual({ season: 1, episode: 3 });
  });

  it('keeps a movie and show with the same numeric id separate', () => {
    const sameIdMovie = { ...movie, id: show.id };
    useLibraryStore.getState().upsert(sameIdMovie, 'completed');
    useLibraryStore.getState().toggleEpisode(show, 1, 1, seasons);
    expect(useLibraryStore.getState().items).toHaveLength(2);
    useLibraryStore.getState().remove(show);
    expect(useLibraryStore.getState().items).toMatchObject([{ media: { type: 'movie' }, status: 'completed' }]);
  });

  it('keeps an offline deletion deleted when stale server data arrives', () => {
    useLibraryStore.getState().upsert(movie, 'watchlist');
    const remote = [...useLibraryStore.getState().items];
    useLibraryStore.getState().acknowledgeChanges(useLibraryStore.getState().pendingChanges);
    useLibraryStore.getState().remove(movie);
    useLibraryStore.getState().mergeRemote(remote, {}, {});
    expect(useLibraryStore.getState().items).toEqual([]);
    expect(useLibraryStore.getState().pendingChanges['library:movie:10']).toBeDefined();
  });

  it('does not restore an unchecked episode from stale server progress', () => {
    useLibraryStore.getState().toggleEpisode(show, 1, 1, seasons);
    useLibraryStore.getState().acknowledgeChanges(useLibraryStore.getState().pendingChanges);
    useLibraryStore.getState().toggleEpisode(show, 1, 1, seasons);
    useLibraryStore.getState().mergeRemote([], { '20:1:1': true }, { '20:1:1': 30 });
    expect(useLibraryStore.getState().watchedEpisodes['20:1:1']).toBeUndefined();
    expect(useLibraryStore.getState().episodeRuntimes['20:1:1']).toBeUndefined();
  });

  it('accepts another device deletion after local changes were acknowledged', () => {
    useLibraryStore.getState().upsert(movie, 'watchlist');
    useLibraryStore.getState().acknowledgeChanges(useLibraryStore.getState().pendingChanges);
    useLibraryStore.getState().mergeRemote([], {}, {});
    expect(useLibraryStore.getState().items).toEqual([]);
  });

  it('does not acknowledge a newer edit made while a write was in flight', () => {
    useLibraryStore.getState().upsert(movie, 'watchlist');
    const sent = { ...useLibraryStore.getState().pendingChanges };
    useLibraryStore.getState().upsert(movie, 'completed');
    useLibraryStore.getState().acknowledgeChanges(sent);
    expect(useLibraryStore.getState().pendingChanges['library:movie:10']).toBeDefined();
  });

  it('preserves the original watched date when runtime metadata changes', () => {
    useLibraryStore.getState().toggleEpisode(show, 1, 1, seasons);
    const original = useLibraryStore.getState().episodeWatchedAt['20:1:1'];
    useLibraryStore.getState().recordEpisodeRuntimes(show.id, { '20:1:1': 31 });
    expect(useLibraryStore.getState().episodeWatchedAt['20:1:1']).toBe(original);
  });

  it('isolates persisted data when another user signs in', () => {
    useLibraryStore.getState().bindUser('alice');
    useLibraryStore.getState().upsert(movie, 'completed');
    useLibraryStore.getState().bindUser('bob');
    expect(useLibraryStore.getState().items).toEqual([]);
    expect(useLibraryStore.getState().pendingChanges).toEqual({});
  });
});
