import { CachePolicy, CacheRecord, CacheStore } from './cache-store';

export class RequestCache {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly memory = new Map<string, CacheRecord<unknown>>();

  constructor(
    private readonly store: CacheStore,
    private readonly now: () => number = Date.now,
    private readonly maxMemoryEntries = 100,
  ) {}

  getOrLoad<T>(key: string, policy: CachePolicy, loader: () => Promise<T>): Promise<T> {
    const running = this.inFlight.get(key);
    if (running) return running as Promise<T>;

    const task = this.resolve(key, policy, loader);
    this.inFlight.set(key, task);
    return task.finally(() => {
      if (this.inFlight.get(key) === task) this.inFlight.delete(key);
    });
  }

  async invalidate(key: string): Promise<void> {
    this.memory.delete(key);
    await this.store.remove(key);
  }

  async clear(): Promise<void> {
    this.memory.clear();
    await this.store.clear();
  }

  private async resolve<T>(key: string, policy: CachePolicy, loader: () => Promise<T>): Promise<T> {
    const cached = (this.memory.get(key) as CacheRecord<T> | undefined) ?? await this.store.get<T>(key);
    const currentTime = this.now();

    if (cached) {
      this.remember(key, cached);
      if (cached.expiresAt > currentTime) return cached.value;
    }

    try {
      const value = await loader();
      const storedAt = this.now();
      const record: CacheRecord<T> = {
        schemaVersion: 1,
        value,
        storedAt,
        expiresAt: storedAt + policy.ttlMs,
        staleUntil: storedAt + policy.ttlMs + policy.staleIfErrorMs,
      };
      this.remember(key, record);
      await this.store.set(key, record).catch(() => undefined);
      return value;
    } catch (error) {
      if (cached && cached.staleUntil > currentTime) return cached.value;
      throw error;
    }
  }

  private remember<T>(key: string, record: CacheRecord<T>): void {
    this.memory.delete(key);
    this.memory.set(key, record as CacheRecord<unknown>);
    if (this.memory.size <= this.maxMemoryEntries) return;
    const oldestKey = this.memory.keys().next().value as string | undefined;
    if (oldestKey) this.memory.delete(oldestKey);
  }
}
