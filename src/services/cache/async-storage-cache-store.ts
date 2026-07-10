import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheRecord, CacheStore } from './cache-store';

const CACHE_PREFIX = '@episode/api-cache/v1/';
const INDEX_KEY = `${CACHE_PREFIX}index`;

function isCacheRecord(value: unknown): value is CacheRecord<unknown> {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<CacheRecord<unknown>>;
  return record.schemaVersion === 1
    && typeof record.storedAt === 'number'
    && typeof record.expiresAt === 'number'
    && typeof record.staleUntil === 'number'
    && 'value' in record;
}

export class AsyncStorageCacheStore implements CacheStore {
  private indexMutation: Promise<void> = Promise.resolve();

  constructor(private readonly maxEntries = 250) {}

  async get<T>(key: string): Promise<CacheRecord<T> | undefined> {
    const storageKey = this.storageKey(key);
    try {
      const serialized = await AsyncStorage.getItem(storageKey);
      if (!serialized) return undefined;
      const parsed: unknown = JSON.parse(serialized);
      if (!isCacheRecord(parsed)) {
        await AsyncStorage.removeItem(storageKey);
        return undefined;
      }
      return parsed as CacheRecord<T>;
    } catch {
      // Corrupt cache data must never break the main API flow.
      await AsyncStorage.removeItem(storageKey).catch(() => undefined);
      return undefined;
    }
  }

  async set<T>(key: string, record: CacheRecord<T>): Promise<void> {
    const storageKey = this.storageKey(key);
    await AsyncStorage.setItem(storageKey, JSON.stringify(record));
    await this.updateIndex(storageKey);
  }

  async remove(key: string): Promise<void> {
    const storageKey = this.storageKey(key);
    await AsyncStorage.removeItem(storageKey);
    await this.mutateIndex((keys) => keys.filter((item) => item !== storageKey));
  }

  async clear(): Promise<void> {
    await this.mutateIndex(async (keys) => {
      if (keys.length > 0) await AsyncStorage.multiRemove(keys);
      return [];
    });
  }

  private storageKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  private async updateIndex(storageKey: string): Promise<void> {
    await this.mutateIndex(async (keys) => {
      const next = [...keys.filter((item) => item !== storageKey), storageKey];
      const overflow = next.length - this.maxEntries;
      if (overflow <= 0) return next;
      const evicted = next.slice(0, overflow);
      await AsyncStorage.multiRemove(evicted);
      return next.slice(overflow);
    });
  }

  private async mutateIndex(mutation: (keys: string[]) => string[] | Promise<string[]>): Promise<void> {
    this.indexMutation = this.indexMutation.catch(() => undefined).then(async () => {
      const serialized = await AsyncStorage.getItem(INDEX_KEY);
      let keys: string[] = [];
      try {
        const parsed: unknown = serialized ? JSON.parse(serialized) : [];
        if (Array.isArray(parsed)) keys = parsed.filter((item): item is string => typeof item === 'string');
      } catch {
        keys = [];
      }
      const next = await mutation(keys);
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
    });
    return this.indexMutation;
  }
}
