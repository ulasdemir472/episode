import { fetchPages, persistCurrentUserState, StaleSyncError } from '../user-sync-service';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import { useCommunityStore } from '@/store/community-store';
import { Media } from '@/domain/media';

jest.mock('@/infrastructure/supabase/client', () => ({ requireSupabase: jest.fn() }));
type Write = { table: string; method: string; data?: unknown; filters: unknown[] };
const writes: Write[] = [];
let handleWrite: (write: Write) => Promise<{ error: Error | null }>;
const movie: Media = { id: 12, type: 'movie', title: 'Movie', year: '2026', overview: '', genres: [], posterUrl: '', backdropUrl: '', rating: 8 };
beforeEach(() => {
  useLibraryStore.getState().clearUserData(); useProfileStore.getState().clearUserData(); useCommunityStore.getState().clearUserData();
  writes.length = 0;
  handleWrite = async () => ({ error: null });
  const from = (table: string) => {
    const write: Write = { table, method: '', filters: [] };
    const query = {
      upsert: (data: unknown) => { write.method = 'upsert'; write.data = data; return query; },
      update: (data: unknown) => { write.method = 'update'; write.data = data; return query; },
      delete: () => { write.method = 'delete'; return query; },
      eq: (...filter: unknown[]) => { write.filters.push(filter); return query; },
      in: (...filter: unknown[]) => { write.filters.push(filter); return query; },
      then: (resolve: (result: { error: Error | null }) => unknown, reject: (error: unknown) => unknown) => { writes.push(write); return handleWrite(write).then(resolve, reject); },
    };
    return query;
  };
  jest.mocked(requireSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof requireSupabase>);
});
it('does not rewrite synced library history when nothing changed', async () => {
  useLibraryStore.getState().upsert(movie, 'completed');
  await persistCurrentUserState('alice');
  expect(writes).toHaveLength(1);
  await persistCurrentUserState('alice');
  expect(writes).toHaveLength(1);
});
it('preserves offline changes on failure and acknowledges them after retry', async () => {
  useLibraryStore.getState().upsert(movie, 'completed');
  handleWrite = async () => ({ error: new Error('offline') });
  await expect(persistCurrentUserState('alice')).rejects.toThrow('offline');
  expect(useLibraryStore.getState().pendingChanges['library:movie:12']).toBeDefined();
  handleWrite = async () => ({ error: null });
  await persistCurrentUserState('alice');
  expect(useLibraryStore.getState().pendingChanges).toEqual({});
});
it('does not lose a deletion made while a previous save is in flight', async () => {
  useLibraryStore.getState().upsert(movie, 'watchlist');
  let release: (result: { error: null }) => void = () => undefined;
  handleWrite = () => new Promise((resolve) => { release = resolve; });
  const pending = persistCurrentUserState('alice');
  for (let turn = 0; !writes.length && turn < 10; turn++) await Promise.resolve();
  expect(writes).toHaveLength(1);
  useLibraryStore.getState().remove(movie);
  release({ error: null });
  await pending;
  expect(useLibraryStore.getState().pendingChanges['library:movie:12']).toBeDefined();
  handleWrite = async () => ({ error: null });
  await persistCurrentUserState('alice');
  expect(writes[1]).toMatchObject({ table: 'library_items', method: 'delete', filters: [['user_id', 'alice'], ['media_type', 'movie'], ['media_id', [12]]] });
});
it('stops a stale account operation before sending any writes', async () => {
  useLibraryStore.getState().upsert(movie, 'completed');
  await expect(persistCurrentUserState('alice', () => false)).rejects.toBeInstanceOf(StaleSyncError);
  expect(writes).toEqual([]);
});
it('writes a large episode update in bounded batches and keeps original watch dates', async () => {
  const dates = Object.fromEntries(Array.from({ length: 1200 }, (_, index) => [`12:1:${index + 1}`, '2026-10-01T10:00:00Z']));
  useLibraryStore.setState({ watchedEpisodes: Object.fromEntries(Object.keys(dates).map((key) => [key, true])), episodeWatchedAt: dates, pendingChanges: Object.fromEntries(Object.keys(dates).map((key) => [`episode:${key}`, 'revision'])) });
  await persistCurrentUserState('alice');
  expect(writes).toHaveLength(3);
  expect(writes.map((write) => (write.data as unknown[]).length)).toEqual([500, 500, 200]);
  expect((writes[0]!.data as Record<string, unknown>[])[0]).toMatchObject({ watched_at: '2026-10-01T10:00:00Z' });
});
it('persists clearing a name as an empty string instead of violating NOT NULL', async () => {
  useProfileStore.getState().setName('Alice', 'Example');
  useProfileStore.getState().acknowledgeChanges(useProfileStore.getState().pendingChanges);
  useProfileStore.getState().setName('', '');
  await persistCurrentUserState('alice');
  expect(writes[0]).toMatchObject({ table: 'profiles', data: { first_name: '', last_name: '' } });
});
it('hydrates more than one server page without truncating a large library', async () => {
  const rows = Array.from({ length: 1200 }, (_, index) => index);
  const loader = jest.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
  expect(await fetchPages(loader)).toHaveLength(1200);
  expect(loader.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
});
