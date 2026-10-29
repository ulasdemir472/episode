import { EpisodeDetails, EpisodeRelease, Media, MediaType, SeriesDetails } from '@/domain/media';
import { normalizeTmdbPath } from '../../supabase/functions/_shared/catalog-contract';
import { dayOffset, scheduleSeasonNumbers } from '../../supabase/functions/_shared/episode-schedule';
import { AsyncStorageCacheStore } from '@/services/cache/async-storage-cache-store';
import { CachePolicy, CacheStore } from '@/services/cache/cache-store';
import { cachePolicies } from '@/services/cache/policies';
import { RequestCache } from '@/services/cache/request-cache';
import { ExternalApiError } from '@/services/external-api-error';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { AppLanguage, useProfileStore } from '@/store/profile-store';

const IMAGE_URL = 'https://image.tmdb.org/t/p';

type TmdbResult = {
  id: number;
  media_type?: MediaType | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
};

type TmdbSeries = {
  original_name?: string;
  name?: string;
  overview?: string;
  episode_run_time?: number[];
  seasons: {
    id: number;
    season_number: number;
    name: string;
    overview?: string;
    episode_count: number;
    air_date?: string;
    poster_path?: string;
  }[];
};

type TmdbMovie = { runtime?: number; overview?: string; original_title?: string; title?: string };
type TmdbSeason = { episodes: { id: number; episode_number: number; season_number: number; name: string; overview: string; air_date?: string; runtime?: number; still_path?: string; vote_average: number }[] };
type TmdbScheduleEpisode = { id: number; season_number: number; episode_number: number; name: string; air_date: string };
type TmdbSchedule = { seasons: { season_number: number; air_date?: string }[]; last_episode_to_air?: TmdbScheduleEpisode | null; next_episode_to_air?: TmdbScheduleEpisode | null };
type OmdbResponse = { Response?: string; Error?: string };
type OmdbTitle = OmdbResponse & { imdbRating?: string };
type OmdbSeason = OmdbResponse & { Episodes?: { Episode: string; imdbRating?: string }[] };

export const genresTr: Record<number, string> = {
  12: 'Macera',
  14: 'Fantastik',
  16: 'Animasyon',
  18: 'Drama',
  27: 'Korku',
  28: 'Aksiyon',
  35: 'Komedi',
  80: 'Suç',
  99: 'Belgesel',
  878: 'Bilim Kurgu',
  9648: 'Gizem',
  10749: 'Romantik',
  10751: 'Aile',
  10752: 'Savaş',
  10759: 'Aksiyon & Macera',
  10765: 'Bilim Kurgu & Fantastik',
  10768: 'Savaş & Politika',
  37: 'Vahşi Batı',
};

export const genresEn: Record<number, string> = {
  12: 'Adventure',
  14: 'Fantasy',
  16: 'Animation',
  18: 'Drama',
  27: 'Horror',
  28: 'Action',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  878: 'Sci-Fi',
  9648: 'Mystery',
  10749: 'Romance',
  10751: 'Family',
  10752: 'War',
  10759: 'Action & Adventure',
  10765: 'Sci-Fi & Fantasy',
  10768: 'War & Politics',
  37: 'Western',
};

export function translateGenre(genre: string, isEnglish: boolean): string {
  const trToEn: Record<string, string> = {
    'Macera': 'Adventure',
    'Fantastik': 'Fantasy',
    'Animasyon': 'Animation',
    'Drama': 'Drama',
    'Korku': 'Horror',
    'Aksiyon': 'Action',
    'Komedi': 'Comedy',
    'Suç': 'Crime',
    'Belgesel': 'Documentary',
    'Bilim Kurgu': 'Sci-Fi',
    'Gizem': 'Mystery',
    'Romantik': 'Romance',
    'Aile': 'Family',
    'Savaş': 'War',
    'Aksiyon & Macera': 'Action & Adventure',
    'Bilim Kurgu & Fantastik': 'Sci-Fi & Fantasy',
    'Vahşi Batı': 'Western',
  };
  const enToTr: Record<string, string> = Object.fromEntries(Object.entries(trToEn).map(([tr, en]) => [en, tr]));

  if (isEnglish) {
    return trToEn[genre] ?? genre;
  }
  return enToTr[genre] ?? genre;
}

function getTmdbLanguage(language?: AppLanguage): string {
  const current = language ?? useProfileStore.getState().language;
  return current === 'en' ? 'en-US' : 'tr-TR';
}

function mapMedia(item: TmdbResult, fallbackType: MediaType = 'movie', language?: AppLanguage): Media {
  const type = item.media_type === 'tv' || item.media_type === 'movie' ? item.media_type : fallbackType;
  // USER REQUEST: Always use the original title/name for all movies and shows
  const original = item.original_title || item.original_name;
  const title = (original || item.title || item.name || 'Untitled').trim();
  const currentLang = language ?? useProfileStore.getState().language;
  const genreMap = currentLang === 'en' ? genresEn : genresTr;

  return {
    id: item.id,
    type,
    title,
    overview: item.overview || '',
    posterUrl: item.poster_path ? `${IMAGE_URL}/w500${item.poster_path}` : '',
    backdropUrl: item.backdrop_path ? `${IMAGE_URL}/w1280${item.backdrop_path}` : '',
    year: (item.release_date ?? item.first_air_date ?? '').slice(0, 4),
    rating: Math.round(item.vote_average * 10) / 10,
    genres: (item.genre_ids ?? item.genres?.map((genre) => genre.id) ?? []).map((id) => genreMap[id]).filter((value): value is string => Boolean(value)),
    runtimeMinutes: item.runtime,
  };
}

async function invokeCatalog<T>(body: { service: 'tmdb'; path: string } | { service: 'omdb'; params: Record<string, string> }): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke<T>('catalog-api', { body });
  if (error) {
    const service = body.service === 'tmdb' ? 'TMDB' : 'OMDb';
    const response = 'context' in error ? error.context : undefined;
    const status = response && typeof response === 'object' && 'status' in response && typeof response.status === 'number' ? response.status : 502;
    throw new ExternalApiError(service, status, error.message);
  }
  if (data === null || data === undefined) throw new Error('Katalog servisi boş yanıt döndürdü.');
  return data;
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
    const normalized = normalizeTmdbPath(path);
    return requestCache.getOrLoad(`tmdb:${encodeURIComponent(normalized)}`, policy, () => invokeCatalog<T>({ service: 'tmdb', path: normalized }));
  }

  async function omdb<T extends OmdbResponse>(params: Record<string, string>, policy: CachePolicy): Promise<T | undefined> {
    const normalizedParams = Object.entries(params).sort(([left], [right]) => left.localeCompare(right));
    const cacheKey = normalizedParams.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
    const data = await requestCache.getOrLoad(`omdb:${cacheKey}`, policy, () => invokeCatalog<T>({ service: 'omdb', params: Object.fromEntries(normalizedParams) }));
    return data.Response === 'False' ? undefined : data;
  }

  return {
    async mediaDetails(type: MediaType, id: number, language?: AppLanguage): Promise<Media> {
      const data = await tmdb<TmdbResult>(`/${type}/${id}?language=${getTmdbLanguage(language)}`, cachePolicies.seriesDetails);
      return mapMedia(data, type, language);
    },
    async searchPage(query: string, page = 1, language?: AppLanguage) {
      const body = await tmdb<{ results: TmdbResult[]; total_pages: number }>(`/search/multi?language=${getTmdbLanguage(language)}&query=${encodeURIComponent(query.trim())}&page=${page}&include_adult=false`, cachePolicies.search);
      return { items: body.results.filter((item) => item.media_type !== 'person').map((item) => mapMedia(item, 'movie', language)), nextPage: page < Math.min(body.total_pages, 500) ? page + 1 : undefined };
    },
    async discoverPage(type: MediaType, options: { genreId?: number; year?: string; minRating?: number; page?: number } = {}, language?: AppLanguage) {
      const page = options.page ?? 1;
      const params = new URLSearchParams({ language: getTmdbLanguage(language), sort_by: 'popularity.desc', page: String(page), include_adult: 'false' });
      if (options.genreId) params.set('with_genres', String(options.genreId));
      if (options.year) params.set(type === 'movie' ? 'primary_release_year' : 'first_air_date_year', options.year);
      if (options.minRating) { params.set('vote_average.gte', String(options.minRating)); params.set('vote_count.gte', '100'); }
      const body = await tmdb<{ results: TmdbResult[]; total_pages: number }>(`/discover/${type}?${params}`, cachePolicies.discover);
      return { items: body.results.map((item) => mapMedia(item, type, language)), nextPage: page < Math.min(body.total_pages, 500) ? page + 1 : undefined };
    },
    async titleExtras(media: Media, region: string, language?: AppLanguage) {
      const lang = getTmdbLanguage(language);
      const [providers, credits, videos] = await Promise.all([
        tmdb<{ results: Record<string, { link?: string; flatrate?: { provider_id: number; provider_name: string; logo_path?: string }[]; rent?: { provider_id: number; provider_name: string; logo_path?: string }[]; buy?: { provider_id: number; provider_name: string; logo_path?: string }[] }> }>(`/${media.type}/${media.id}/watch/providers`, cachePolicies.seriesDetails),
        tmdb<{ cast: { id: number; name: string; character: string }[]; crew: { job: string; name: string }[] }>(`/${media.type}/${media.id}/credits?language=${lang}`, cachePolicies.seriesDetails),
        tmdb<{ results: { site: string; type: string; key: string }[] }>(`/${media.type}/${media.id}/videos?language=${lang}`, cachePolicies.seriesDetails),
      ]);
      const trailer = videos.results.find((video) => video.site === 'YouTube' && video.type === 'Trailer');
      return { providers: providers.results[region], cast: credits.cast.slice(0, 8), director: credits.crew.find((person) => person.job === 'Director')?.name, trailerUrl: trailer ? `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}` : undefined };
    },
    async trending(language?: AppLanguage): Promise<Media[]> {
      const lang = getTmdbLanguage(language);
      const body = await tmdb<{ results: TmdbResult[] }>(`/trending/all/week?language=${lang}`, cachePolicies.trending);
      return body.results.filter((item) => item.media_type !== 'person').map((item) => mapMedia(item, 'movie', language));
    },
    async search(query: string, language?: AppLanguage): Promise<Media[]> {
      if (!query.trim()) return [];
      const lang = getTmdbLanguage(language);
      const body = await tmdb<{ results: TmdbResult[] }>(`/search/multi?language=${lang}&query=${encodeURIComponent(query.trim())}`, cachePolicies.search);
      return body.results.filter((item) => item.media_type !== 'person').map((item) => mapMedia(item, 'movie', language));
    },
    async discover(type: MediaType, genreId?: number, pageCount = 3, language?: AppLanguage): Promise<Media[]> {
      const genre = genreId ? `&with_genres=${genreId}` : '';
      const lang = getTmdbLanguage(language);
      const pages = await Promise.all(
        Array.from({ length: pageCount }, (_, index) =>
          tmdb<{ results: TmdbResult[] }>(`/discover/${type}?language=${lang}&sort_by=popularity.desc&page=${index + 1}${genre}`, cachePolicies.discover)
        )
      );
      return pages
        .flatMap((page) => page.results)
        .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
        .map((item) => mapMedia(item, type, language));
    },
    async recommendations(media: Media, language?: AppLanguage): Promise<Media[]> {
      const lang = getTmdbLanguage(language);
      const body = await tmdb<{ results: TmdbResult[] }>(`/${media.type}/${media.id}/recommendations?language=${lang}&page=1`, cachePolicies.recommendations);
      return body.results.filter((item) => item.id !== media.id).map((item) => mapMedia(item, media.type, language));
    },
    async seriesDetails(seriesId: number, language?: AppLanguage): Promise<SeriesDetails> {
      const lang = getTmdbLanguage(language);
      const data = await tmdb<TmdbSeries>(`/tv/${seriesId}?language=${lang}`, cachePolicies.seriesDetails);
      return {
        overview: data.overview,
        originalTitle: data.original_name || data.name,
        episodeRunTime: data.episode_run_time?.[0],
        seasons: data.seasons
          .filter((season) => season.season_number > 0)
          .map((season) => ({
            id: season.id,
            number: season.season_number,
            name: season.name,
            overview: season.overview,
            episodeCount: season.episode_count,
            airDate: season.air_date,
            posterUrl: season.poster_path ? `${IMAGE_URL}/w500${season.poster_path}` : undefined,
          })),
      };
    },
    async titleRuntimeMinutes(media: Media, language?: AppLanguage): Promise<number> {
      const lang = getTmdbLanguage(language);
      if (media.type === 'tv') {
        const data = await tmdb<TmdbSeries>(`/tv/${media.id}?language=${lang}`, cachePolicies.seriesDetails);
        return data.episode_run_time?.find((runtime) => runtime > 0) ?? 0;
      }
      const data = await tmdb<TmdbMovie>(`/movie/${media.id}?language=${lang}`, cachePolicies.seriesDetails);
      return data.runtime && data.runtime > 0 ? data.runtime : 0;
    },
    async seasonEpisodes(seriesId: number, season: number, language?: AppLanguage): Promise<EpisodeDetails[]> {
      const lang = getTmdbLanguage(language);
      const data = await tmdb<TmdbSeason>(`/tv/${seriesId}/season/${season}?language=${lang}`, cachePolicies.seasonEpisodes);
      return data.episodes.map((episode) => ({
        id: episode.id,
        number: episode.episode_number,
        seasonNumber: episode.season_number,
        title: episode.name,
        overview: episode.overview,
        airDate: episode.air_date,
        runtime: episode.runtime,
        stillUrl: episode.still_path ? `${IMAGE_URL}/w500${episode.still_path}` : undefined,
        tmdbRating: Math.round(episode.vote_average * 10) / 10,
      }));
    },
    async imdbTitleRating(media: Media): Promise<string | undefined> {
      const ids = await tmdb<{ imdb_id?: string }>(`/${media.type}/${media.id}/external_ids`, cachePolicies.externalIds);
      if (!ids.imdb_id) return undefined;
      const data = await omdb<OmdbTitle>({ i: ids.imdb_id }, cachePolicies.imdbTitle);
      return !data?.imdbRating || data.imdbRating === 'N/A' ? undefined : data.imdbRating;
    },
    async imdbEpisodeRatings(showTitle: string, season: number, _episodes: EpisodeDetails[]): Promise<Record<number, string>> {
      const data = await omdb<OmdbSeason>({ t: showTitle, Season: String(season) }, cachePolicies.imdbSeason);
      const entries = (data?.Episodes ?? []).map((episode) => [Number(episode.Episode), episode.imdbRating] as const)
        .filter((entry): entry is readonly [number, string] => Number.isFinite(entry[0]) && Boolean(entry[1]) && entry[1] !== 'N/A');
      return Object.fromEntries(entries);
    },
    async episodeSchedule(shows: Media[], language?: AppLanguage): Promise<EpisodeRelease[]> {
      const lang = getTmdbLanguage(language);
      const now = new Date();
      const from = dayOffset(now, -30);
      const to = dayOffset(now, 30);
      const results = await mapInBatches(shows, 5, async (show) => {
        const data = await tmdb<TmdbSchedule>(`/tv/${show.id}?language=${lang}`, cachePolicies.schedule);
        const seasons = await mapInBatches(scheduleSeasonNumbers(data.seasons ?? [], from, to), 3, (number) => tmdb<TmdbSeason>(`/tv/${show.id}/season/${number}?language=${lang}`, cachePolicies.schedule));
        return seasons.flatMap((season) => season.episodes)
          .filter((episode) => episode.air_date && episode.air_date >= from && episode.air_date <= to)
          .map((episode): EpisodeRelease => ({
            id: `${show.id}:${episode.season_number}:${episode.episode_number}`,
            show,
            season: episode.season_number,
            episode: episode.episode_number,
            title: episode.name,
            airDate: episode.air_date!,
            watched: false,
          }));
      });
      return results.flat().filter((episode, index, all) => all.findIndex((item) => item.id === episode.id) === index).sort((a, b) => a.airDate.localeCompare(b.airDate));
    },
    clearCache: () => requestCache.clear(),
  };
}

export const catalogService = createCatalogService(new AsyncStorageCacheStore());
