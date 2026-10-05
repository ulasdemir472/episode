import { CachePolicy } from './cache-store';

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

export const cachePolicies = {
  trending: { ttlMs: 30 * minute, staleIfErrorMs: day },
  discover: { ttlMs: hour, staleIfErrorMs: 3 * day },
  recommendations: { ttlMs: 6 * hour, staleIfErrorMs: 7 * day },
  search: { ttlMs: day, staleIfErrorMs: 7 * day },
  seriesDetails: { ttlMs: day, staleIfErrorMs: 7 * day },
  seasonEpisodes: { ttlMs: 12 * hour, staleIfErrorMs: 7 * day },
  externalIds: { ttlMs: 30 * day, staleIfErrorMs: 30 * day },
  imdbTitle: { ttlMs: 7 * day, staleIfErrorMs: 30 * day },
  imdbSeason: { ttlMs: 7 * day, staleIfErrorMs: 30 * day },
  schedule: { ttlMs: 2 * hour, staleIfErrorMs: day },
} satisfies Record<string, CachePolicy>;
