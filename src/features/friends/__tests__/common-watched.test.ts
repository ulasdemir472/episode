import { commonWatched } from '../common-watched';
import type { LibraryItem, Media } from '@/domain/media';

const movie: Media = { id: 1, type: 'movie', title: 'Movie', overview: '', genres: [], posterUrl: '', backdropUrl: '', rating: 8, year: '2020' };
const item = (media: Media, status: LibraryItem['status'], watched = 0): LibraryItem => ({ media, status, ...(media.type === 'tv' ? { progress: { watched, total: 20 } } : {}) });

it('matches watched titles by both media type and ID', () => {
  const show: Media = { ...movie, type: 'tv', title: 'Show' };
  expect(commonWatched([item(movie, 'completed')], [item(show, 'completed')])).toEqual([]);
  expect(commonWatched([item(movie, 'completed'), item(show, 'watching', 2)], [item(movie, 'completed'), item(show, 'watching', 5)])).toEqual([movie, show]);
});
it('excludes unwatched titles even when they are saved by both people', () => {
  expect(commonWatched([item(movie, 'completed')], [item(movie, 'watchlist')])).toEqual([]);
  expect(commonWatched([item(movie, 'watching')], [item(movie, 'completed')])).toEqual([]);
  const show = { ...movie, type: 'tv' as const };
  expect(commonWatched([item(show, 'watching', 0)], [item(show, 'watching', 4)])).toEqual([]);
});
it('includes actual watched episodes in dropped shows and fully completed shows', () => {
  const show = { ...movie, type: 'tv' as const };
  expect(commonWatched([item(show, 'dropped', 3)], [item(show, 'watching', 1)])).toEqual([show]);
  expect(commonWatched([item(show, 'completed')], [item(show, 'completed')])).toEqual([show]);
});
it('deduplicates matches, uses the viewers metadata and does not change either library', () => {
  const own = [item(movie, 'completed')];
  const other = [item({ ...movie, title: 'Old stored title' }, 'completed'), item(movie, 'completed')];
  expect(commonWatched(own, other)).toEqual([movie]);
  expect(other[0]!.media.title).toBe('Old stored title');
  expect(own).toHaveLength(1);
});
it('handles either history being empty', () => {
  expect(commonWatched([], [item(movie, 'completed')])).toEqual([]);
  expect(commonWatched([item(movie, 'completed')], [])).toEqual([]);
});
