import { EpisodeDetails, EpisodeRelease, Media, MediaType, SeriesDetails } from '@/domain/media';
import { AsyncStorageCacheStore } from '@/services/cache/async-storage-cache-store';
import { CachePolicy, CacheStore } from '@/services/cache/cache-store';
import { cachePolicies } from '@/services/cache/policies';
import { RequestCache } from '@/services/cache/request-cache';
import { ExternalApiError } from '@/services/external-api-error';

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_URL = 'https://image.tmdb.org/t/p';
const REQUEST_TIMEOUT_MS = 15_000;

type TmdbResult = { id: number; media_type?: MediaType | 'person'; title?: string; name?: string; overview: string; poster_path?: string; backdrop_path?: string; release_date?: string; first_air_date?: string; vote_average: number; genre_ids?: number[] };
type TmdbSeries = { episode_run_time?: number[]; seasons: { id: number; season_number: number; name: string; episode_count: number; air_date?: string; poster_path?: string }[] };
type TmdbSeason = { episodes: { id: number; episode_number: number; season_number: number; name: string; overview: string; air_date?: string; runtime?: number; still_path?: string; vote_average: number }[] };
type TmdbScheduleEpisode = { id: number; season_number: number; episode_number: number; name: string; air_date: string };
type TmdbSchedule = { last_episode_to_air?: TmdbScheduleEpisode | null; next_episode_to_air?: TmdbScheduleEpisode | null };
type OmdbResponse = { Response?: string; Error?: string };
type OmdbTitle = OmdbResponse & { imdbRating?: string };
type OmdbSeason = OmdbResponse & { Episodes?: { Episode: string; imdbRating?: string }[] };

const genres: Record<number, string> = { 18: 'Drama', 28: 'Aksiyon', 35: 'Komedi', 80: 'Suç', 878: 'Bilim Kurgu', 9648: 'Gizem', 16: 'Animasyon', 10765: 'Bilim Kurgu & Fantastik' };

function mapMedia(item: TmdbResult, fallbackType: MediaType = 'movie'): Media {
  const type = item.media_type === 'tv' || item.media_type === 'movie' ? item.media_type : fallbackType;
  return { id: item.id, type, title: item.title ?? item.name ?? 'İsimsiz', overview: item.overview, posterUrl: item.poster_path ? `${IMAGE_URL}/w500${item.poster_path}` : '', backdropUrl: item.backdrop_path ? `${IMAGE_URL}/w1280${item.backdrop_path}` : '', year: (item.release_date ?? item.first_air_date ?? '').slice(0, 4), rating: Math.round(item.vote_average * 10) / 10, genres: (item.genre_ids ?? []).map((id) => genres[id]).filter((value): value is string => Boolean(value)) };
}

async function fetchJson<T>(service: 'TMDB' | 'OMDb', url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new ExternalApiError(service, response.status, `${service} isteği başarısız (${response.status})`);
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ExternalApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new ExternalApiError(service, 408, `${service} isteği zaman aşımına uğradı.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapInBatches<T, TResult>(items: T[], batchSize: number, mapper: (item: T) => Promise<TResult>): Promise<TResult[]> {
  const results: TResult[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    results.push(...await Promise.all(items.slice(index, index + batchSize).map(mapper)));
  }
  return results;
}

export function createCatalogService(cacheStore: CacheStore) {
  const requestCache = new RequestCache(cacheStore);

  async function tmdb<T>(path: string, policy: CachePolicy): Promise<T> {
    const token = process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN;
    if (!token) throw new Error('TMDB API anahtarı tanımlı değil.');
    return requestCache.getOrLoad(`tmdb:${encodeURIComponent(path)}`, policy, () => fetchJson<T>('TMDB', `${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } }));
  }

  async function omdb<T extends OmdbResponse>(params: Record<string, string>, policy: CachePolicy): Promise<T | undefined> {
    const apiKey = process.env.EXPO_PUBLIC_OMDB_API_KEY;
    if (!apiKey) return undefined;
    const normalizedParams = Object.entries(params).sort(([left], [right]) => left.localeCompare(right));
    const cacheKey = normalizedParams.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
    const query = new URLSearchParams({ apikey: apiKey, ...Object.fromEntries(normalizedParams) });
    const data = await requestCache.getOrLoad(`omdb:${cacheKey}`, policy, () => fetchJson<T>('OMDb', `https://www.omdbapi.com/?${query}`));
    return data.Response === 'False' ? undefined : data;
  }

  return {
    async trending(): Promise<Media[]> {
      const body = await tmdb<{ results: TmdbResult[] }>('/trending/all/week?language=tr-TR', cachePolicies.trending);
      return body.results.filter((item) => item.media_type !== 'person').map((item) => mapMedia(item));
    },
    async search(query: string): Promise<Media[]> {
      if (!query.trim()) return [];
      const body = await tmdb<{ results: TmdbResult[] }>(`/search/multi?language=tr-TR&query=${encodeURIComponent(query.trim())}`, cachePolicies.search);
      return body.results.filter((item) => item.media_type !== 'person').map((item) => mapMedia(item));
    },
    async discover(type: MediaType, genreId?: number): Promise<Media[]> {
      const genre = genreId ? `&with_genres=${genreId}` : '';
      const body = await tmdb<{ results: TmdbResult[] }>(`/discover/${type}?language=tr-TR&sort_by=popularity.desc${genre}`, cachePolicies.discover);
      return body.results.map((item) => mapMedia(item, type));
    },
    async seriesDetails(seriesId: number): Promise<SeriesDetails> {
      const data = await tmdb<TmdbSeries>(`/tv/${seriesId}?language=tr-TR`, cachePolicies.seriesDetails);
      return { episodeRunTime: data.episode_run_time?.[0], seasons: data.seasons.filter((season) => season.season_number > 0).map((season) => ({ id: season.id, number: season.season_number, name: season.name, episodeCount: season.episode_count, airDate: season.air_date, posterUrl: season.poster_path ? `${IMAGE_URL}/w500${season.poster_path}` : undefined })) };
    },
    async seasonEpisodes(seriesId: number, season: number): Promise<EpisodeDetails[]> {
      const data = await tmdb<TmdbSeason>(`/tv/${seriesId}/season/${season}?language=tr-TR`, cachePolicies.seasonEpisodes);
      return data.episodes.map((episode) => ({ id: episode.id, number: episode.episode_number, seasonNumber: episode.season_number, title: episode.name, overview: episode.overview, airDate: episode.air_date, runtime: episode.runtime, stillUrl: episode.still_path ? `${IMAGE_URL}/w500${episode.still_path}` : undefined, tmdbRating: Math.round(episode.vote_average * 10) / 10 }));
    },
    async imdbTitleRating(media: Media): Promise<string | undefined> {
      if (!process.env.EXPO_PUBLIC_OMDB_API_KEY) return undefined;
      const ids = await tmdb<{ imdb_id?: string }>(`/${media.type}/${media.id}/external_ids`, cachePolicies.externalIds);
      if (!ids.imdb_id) return undefined;
      const data = await omdb<OmdbTitle>({ i: ids.imdb_id }, cachePolicies.imdbTitle);
      return !data?.imdbRating || data.imdbRating === 'N/A' ? undefined : data.imdbRating;
    },
    async imdbEpisodeRatings(showTitle: string, season: number, _episodes: EpisodeDetails[]): Promise<Record<number, string>> {
      if (!process.env.EXPO_PUBLIC_OMDB_API_KEY) return {};
      const data = await omdb<OmdbSeason>({ t: showTitle, Season: String(season) }, cachePolicies.imdbSeason);
      const entries = (data?.Episodes ?? []).map((episode) => [Number(episode.Episode), episode.imdbRating] as const)
        .filter((entry): entry is readonly [number, string] => Number.isFinite(entry[0]) && Boolean(entry[1]) && entry[1] !== 'N/A');
      return Object.fromEntries(entries);
    },
    async episodeSchedule(shows: Media[]): Promise<EpisodeRelease[]> {
      const recentThreshold = Date.now() - 30 * 24 * 60 * 60_000;
      const results = await mapInBatches(shows, 5, async (show) => {
        const data = await tmdb<TmdbSchedule>(`/tv/${show.id}?language=tr-TR`, cachePolicies.schedule);
        return [data.last_episode_to_air, data.next_episode_to_air]
          .filter((episode): episode is TmdbScheduleEpisode => Boolean(episode?.air_date))
          .filter((episode) => new Date(`${episode.air_date}T12:00:00`).getTime() >= recentThreshold)
          .map((episode): EpisodeRelease => ({ id: `${show.id}:${episode.season_number}:${episode.episode_number}`, show, season: episode.season_number, episode: episode.episode_number, title: episode.name, airDate: episode.air_date, watched: false }));
      });
      return results.flat().filter((episode, index, all) => all.findIndex((item) => item.id === episode.id) === index).sort((a, b) => a.airDate.localeCompare(b.airDate));
    },
    clearCache: () => requestCache.clear(),
  };
}

export const catalogService = createCatalogService(new AsyncStorageCacheStore());
