import { CacheRecord, CacheStore } from '../cache-store';
import { RequestCache } from '../request-cache';

class MemoryCacheStore implements CacheStore {
  readonly records = new Map<string, CacheRecord<unknown>>();

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

const policy = { ttlMs: 1_000, staleIfErrorMs: 5_000 };

describe('RequestCache', () => {
  it('reuses a fresh value across cache instances', async () => {
    const store = new MemoryCacheStore();
    const loader = jest.fn(async () => ({ title: 'Episode' }));
    const first = new RequestCache(store, () => 1_000);

    await expect(first.getOrLoad('title', policy, loader)).resolves.toEqual({ title: 'Episode' });
    const afterAppRestart = new RequestCache(store, () => 1_500);
    await expect(afterAppRestart.getOrLoad('title', policy, loader)).resolves.toEqual({ title: 'Episode' });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent requests for the same resource', async () => {
    const cache = new RequestCache(new MemoryCacheStore());
    const loader = jest.fn(async () => 42);

    const first = cache.getOrLoad('same-key', policy, loader);
    const second = cache.getOrLoad('same-key', policy, loader);

    await expect(Promise.all([first, second])).resolves.toEqual([42, 42]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('serves stale data when the provider is temporarily unavailable', async () => {
    let now = 1_000;
    const cache = new RequestCache(new MemoryCacheStore(), () => now);
    await cache.getOrLoad('resilient', policy, async () => 'cached');
    now = 2_500;

    await expect(cache.getOrLoad('resilient', policy, async () => { throw new Error('offline'); })).resolves.toBe('cached');
  });
});
