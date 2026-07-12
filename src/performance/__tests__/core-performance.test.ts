import { CacheRecord, CacheStore } from '@/services/cache/cache-store';
import { RequestCache } from '@/services/cache/request-cache';
import { Media, SeasonSummary } from '@/domain/media';
import { useLibraryStore } from '@/store/library-store';

class MemoryCacheStore implements CacheStore {
  private readonly records = new Map<string, CacheRecord<unknown>>();

  async get<T>(key: string): Promise<CacheRecord<T> | undefined> {
    return this.records.get(key) as CacheRecord<T> | undefined;
  }

  async set<T>(key: string, record: CacheRecord<T>): Promise<void> {
    this.records.set(key, record as CacheRecord<unknown>);
  }

  async remove(key: string): Promise<void> {
    this.records.delete(key);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

const policy = { ttlMs: 60_000, staleIfErrorMs: 60_000 };
const show: Media = { id: 99, type: 'tv', title: 'Long Show', overview: '', posterUrl: '', backdropUrl: '', year: '2026', rating: 8, genres: [] };

describe('core performance regression budgets', () => {
  beforeEach(() => useLibraryStore.setState({ items: [], watchedEpisodes: {} }));

  it('coalesces 2,000 concurrent cache requests within the regression budget', async () => {
    const cache = new RequestCache(new MemoryCacheStore());
    const loader = jest.fn(async () => ({ title: 'Episode' }));
    const startedAt = performance.now();

    const results = await Promise.all(Array.from({ length: 2_000 }, () => cache.getOrLoad('shared', policy, loader)));
    const durationMs = performance.now() - startedAt;

    expect(results).toHaveLength(2_000);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(durationMs).toBeLessThan(1_500);
  });

  it('serves 5,000 fresh memory-cache reads within the regression budget', async () => {
    const cache = new RequestCache(new MemoryCacheStore());
    const loader = jest.fn(async () => 42);
    await cache.getOrLoad('hot', policy, loader);
    const startedAt = performance.now();

    await Promise.all(Array.from({ length: 5_000 }, () => cache.getOrLoad('hot', policy, loader)));
    const durationMs = performance.now() - startedAt;

    expect(loader).toHaveBeenCalledTimes(1);
    expect(durationMs).toBeLessThan(1_500);
  });

  it('calculates progress for 10,000 episodes within the regression budget', () => {
    const seasons: SeasonSummary[] = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      number: index + 1,
      name: `Season ${index + 1}`,
      episodeCount: 100,
    }));
    const startedAt = performance.now();

    useLibraryStore.getState().markThrough(show, 100, 100, seasons);
    const durationMs = performance.now() - startedAt;

    expect(Object.keys(useLibraryStore.getState().watchedEpisodes)).toHaveLength(10_000);
    expect(useLibraryStore.getState().items[0]).toMatchObject({ status: 'completed', progress: { watched: 10_000, total: 10_000 } });
    expect(durationMs).toBeLessThan(1_500);
  });
});
