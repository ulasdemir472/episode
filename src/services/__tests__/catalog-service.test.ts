import { createCatalogService } from '../tmdb';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { CacheStore } from '../cache/cache-store';
import { normalizeTmdbPath } from '../../../supabase/functions/_shared/catalog-contract';

jest.mock('@/infrastructure/supabase/client', () => ({ requireSupabase: jest.fn() }));
const cache = (): CacheStore => ({ get: async () => undefined, set: async () => undefined, remove: async () => undefined, clear: async () => undefined });
const invoke = jest.fn();
const item = { id: 12, media_type: 'movie', original_title: 'Movie', overview: 'Overview', genre_ids: [18], vote_average: 8, release_date: '2026-01-01', runtime: 123 };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireSupabase).mockReturnValue({ functions: { invoke } } as unknown as ReturnType<typeof requireSupabase>);
  invoke.mockImplementation(async (_name: string, { body }: { body: { service: string; path: string } }) => {
    normalizeTmdbPath(body.path);
    const path = new URL('https://tmdb.example' + body.path).pathname;
    let data: unknown;
    if (path === '/tv/20') data = { id: 20, name: 'Show', original_name: 'Show', episode_run_time: [24], seasons: [{ id: 1, season_number: 1, name: 'Season 1', episode_count: 3, air_date: '2026-01-01' }] };
    else if (path.includes('/season/')) data = { episodes: [1, 2, 3].map((number) => ({ id: number, season_number: 1, episode_number: number, name: 'Episode ' + number, overview: '', air_date: new Date().toISOString().slice(0, 10), vote_average: 8, runtime: 24 })) };
    else if (path.endsWith('/recommendations') || path.includes('/search/') || path.includes('/discover/')) data = { results: [{ ...item, id: 13 }], total_pages: 2 };
    else if (path.endsWith('/watch/providers')) data = { results: { TR: { link: 'https://www.themoviedb.org/movie/12/watch', flatrate: [{ provider_id: 1, provider_name: 'Provider' }] } } };
    else if (path.endsWith('/credits')) data = { cast: [{ id: 1, name: 'Actor', character: 'Character' }], crew: [{ name: 'Director', job: 'Director' }] };
    else if (path.endsWith('/videos')) data = { results: [{ site: 'YouTube', type: 'Trailer', key: 'trailer-key' }] };
    else data = item;
    return { data, error: null };
  });
});
it('loads movie details, recommendations and provider information through server-approved paths', async () => {
  const service = createCatalogService(cache());
  const movie = await service.mediaDetails('movie', 12, 'tr');
  expect(movie).toMatchObject({ type: 'movie', title: 'Movie', genres: ['Drama'], runtimeMinutes: 123 });
  expect(await service.recommendations(movie, 'tr')).toHaveLength(1);
  const extras = await service.titleExtras(movie, 'TR', 'tr');
  expect(extras).toMatchObject({ providers: { flatrate: [{ provider_name: 'Provider' }] }, director: 'Director', trailerUrl: 'https://www.youtube.com/watch?v=trailer-key' });
  expect(await service.titleRuntimeMinutes(movie, 'tr')).toBe(123);
});
it('includes every episode of a batch release instead of only the last and next episode', async () => {
  const service = createCatalogService(cache());
  const releases = await service.episodeSchedule([{ id: 20, type: 'tv', title: 'Show', genres: [], overview: '', posterUrl: '', backdropUrl: '', rating: 8, year: '2026' }], 'en');
  expect(releases.map((release) => release.id)).toEqual(['20:1:1', '20:1:2', '20:1:3']);
});
it('retains server status codes so quota and authorization errors remain distinguishable', async () => {
  invoke.mockResolvedValue({ error: { message: 'Limit reached', context: { status: 429 } }, data: null });
  const service = createCatalogService(cache());
  await expect(service.mediaDetails('movie', 12, 'en')).rejects.toMatchObject({ status: 429, service: 'TMDB' });
});
it('returns a next-page cursor for search and filtered discovery', async () => {
  const service = createCatalogService(cache());
  expect(await service.searchPage('Movie', 1, 'en')).toMatchObject({ nextPage: 2 });
  expect(await service.discoverPage('movie', { year: '2026', minRating: 7, page: 2 }, 'tr')).toMatchObject({ nextPage: undefined });
});
