import { canPersistReviewTarget } from '../user-sync-service';
import { LibraryItem } from '@/domain/media';

const movieItem: LibraryItem = {
  status: 'completed',
  media: { id: 10, type: 'movie', title: 'Movie', overview: '', posterUrl: '', backdropUrl: '', rating: 8, year: '2026', genres: [] },
};

const tvItem: LibraryItem = {
  status: 'watching',
  media: { id: 20, type: 'tv', title: 'Show', overview: '', posterUrl: '', backdropUrl: '', rating: 8, year: '2026', genres: [] },
};

describe('canPersistReviewTarget', () => {
  it('allows completed movies and watched episodes', () => {
    expect(canPersistReviewTarget('media:movie:10', [movieItem], {})).toBe(true);
    expect(canPersistReviewTarget('episode:20:2:3', [tvItem], { '20:2:3': true })).toBe(true);
  });

  it('blocks reviews for unwatched targets before server RLS rejects the whole sync', () => {
    expect(canPersistReviewTarget('media:movie:11', [movieItem], {})).toBe(false);
    expect(canPersistReviewTarget('episode:20:2:4', [tvItem], { '20:2:3': true })).toBe(false);
  });
});
