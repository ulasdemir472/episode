import { LibraryItem, Media } from '@/domain/media';
import { calculateWatchMinutes, formatWatchHours } from '../watch-time';

const show: Media = { id: 1, type: 'tv', title: 'Show', overview: '', posterUrl: '', backdropUrl: '', year: '2026', rating: 8, genres: [] };
const movie: Media = { ...show, id: 2, type: 'movie', title: 'Movie' };

describe('watch time calculation', () => {
  it('calculates locally without external catalog data', () => {
    const library: LibraryItem[] = [
      { media: show, status: 'watching', progress: { watched: 10, total: 20 } },
      { media: movie, status: 'completed' },
      { media: { ...movie, id: 3 }, status: 'watchlist' },
    ];

    expect(calculateWatchMinutes(library)).toBe(10 * 45 + 110);
    expect(calculateWatchMinutes(library, { '1:1:1': 22, '1:1:2': 24 })).toBe(22 + 24 + 8 * 45 + 110);
  });

  it('formats the calculated minutes as hours', () => {
    expect(formatWatchHours(90, 'en')).toBe('1.5');
  });
});
