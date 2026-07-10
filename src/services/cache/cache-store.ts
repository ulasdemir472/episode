export interface CacheRecord<T> {
  schemaVersion: 1;
  value: T;
  storedAt: number;
  expiresAt: number;
  staleUntil: number;
}

export interface CacheStore {
  get<T>(key: string): Promise<CacheRecord<T> | undefined>;
  set<T>(key: string, record: CacheRecord<T>): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface CachePolicy {
  ttlMs: number;
  staleIfErrorMs: number;
}
