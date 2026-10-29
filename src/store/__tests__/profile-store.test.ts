import { useProfileStore } from '../profile-store';
import type { Media } from '@/domain/media';

const movie: Media = { id: 12, type: 'movie', title: 'Movie', genres: [], overview: '', posterUrl: '', backdropUrl: '', rating: 8, year: '2026' };
const remote = { username: 'alice', firstName: 'Alice', lastName: 'Example', language: 'en' as const, favorites: [movie], coverUrl: 'https://example.com/cover.jpg' };
beforeEach(() => useProfileStore.getState().clearUserData());

it('separates favorites by media type as well as id', () => {
  useProfileStore.getState().toggleFavorite(movie);
  useProfileStore.getState().toggleFavorite({ ...movie, type: 'tv' });
  expect(useProfileStore.getState().favorites).toHaveLength(2);
  useProfileStore.getState().toggleFavorite(movie);
  expect(useProfileStore.getState().favorites).toMatchObject([{ type: 'tv' }]);
});
it('loads the server language when there is no local language change', () => {
  useProfileStore.getState().mergeRemote(remote);
  expect(useProfileStore.getState().language).toBe('en');
});
it('preserves a deliberate local language change', () => {
  useProfileStore.getState().mergeRemote(remote);
  useProfileStore.getState().setLanguage('tr');
  useProfileStore.getState().mergeRemote(remote);
  expect(useProfileStore.getState().language).toBe('tr');
});
it('does not restore a removed cover or favorite during an offline merge', () => {
  useProfileStore.getState().mergeRemote(remote);
  useProfileStore.getState().setCover(undefined);
  useProfileStore.getState().toggleFavorite(movie);
  useProfileStore.getState().mergeRemote(remote);
  expect(useProfileStore.getState().coverUrl).toBeUndefined();
  expect(useProfileStore.getState().favorites).toEqual([]);
});
