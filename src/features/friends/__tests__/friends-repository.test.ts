import { fetchFriendActivity } from '../friends-repository';
import { requireSupabase } from '@/infrastructure/supabase/client';

jest.mock('@/infrastructure/supabase/client', () => ({ requireSupabase: jest.fn() }));
const media = (id: number, type = 'movie') => ({ id, type, title: `Title ${id}`, genres: [], year: '2020', overview: '', posterUrl: '', backdropUrl: '', rating: 8 });
let library: { media: ReturnType<typeof media>; status: string; progress: unknown }[];
let failSecondPage: boolean;
const ranges = jest.fn();

beforeEach(() => {
  jest.clearAllMocks(); failSecondPage = false;
  library = [{ media: media(1), status: 'completed', progress: null }];
  const client = {
    rpc: jest.fn(async () => ({ data: true, error: null })),
    from: (table: string) => {
      const builder = {
        select: jest.fn(), eq: jest.fn(), order: jest.fn(), is: jest.fn(), limit: jest.fn(),
        single: async () => ({ data: { id: 'bob', username: 'bob', first_name: 'Bob', last_name: '', avatar_url: null }, error: null }),
        range: async (from: number, to: number) => {
          ranges(table, from, to);
          if (table === 'library_items') return failSecondPage && from > 0 ? { data: null, error: new Error('page failed') } : { data: library.slice(from, to + 1), error: null };
          return { data: [{ media_id: 1, season_number: 1, episode_number: 1, runtime_minutes: 30 }].slice(from, to + 1), error: null };
        },
        then: (resolve: (result: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      for (const method of ['select', 'eq', 'order', 'is', 'limit'] as const) builder[method].mockReturnValue(builder);
      return builder;
    },
  };
  jest.mocked(requireSupabase).mockReturnValue(client as unknown as ReturnType<typeof requireSupabase>);
});

it('loads a library beyond the server page limit so common titles are not silently missed', async () => {
  library = Array.from({ length: 1001 }, (_, i) => ({ media: media(i + 1), status: 'completed', progress: null }));
  const result = await fetchFriendActivity('alice', 'bob');
  expect(result.library).toHaveLength(1001);
  expect(result.library[1000]!.media.id).toBe(1001);
  expect(ranges).toHaveBeenCalledWith('library_items', 0, 999);
  expect(ranges).toHaveBeenCalledWith('library_items', 1000, 1999);
});
it('keeps episode progress on shows instead of movies with the same numerical ID', async () => {
  library.push({ media: media(1, 'tv'), status: 'watching', progress: { watched: 0, total: 10 } });
  const result = await fetchFriendActivity('alice', 'bob');
  expect(result.library.find(item => item.media.type === 'movie')!.progress).toBeUndefined();
  expect(result.library.find(item => item.media.type === 'tv')!.progress?.watched).toBe(1);
});
it('fails a partial library fetch instead of presenting an incomplete common list', async () => {
  library = Array.from({ length: 1001 }, (_, i) => ({ media: media(i + 1), status: 'completed', progress: null }));
  failSecondPage = true;
  await expect(fetchFriendActivity('alice', 'bob')).rejects.toThrow('page failed');
});
