import { EpisodeDetails, EpisodeRelease, Media, MediaType, SeriesDetails } from '@/domain/media';

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_URL = 'https://image.tmdb.org/t/p';

type TmdbResult = { id: number; media_type?: MediaType | 'person'; title?: string; name?: string; overview: string; poster_path?: string; backdrop_path?: string; release_date?: string; first_air_date?: string; vote_average: number; genre_ids?: number[] };
type TmdbSeries = { episode_run_time?: number[]; seasons: { id: number; season_number: number; name: string; episode_count: number; air_date?: string; poster_path?: string }[] };
type TmdbSeason = { episodes: { id: number; episode_number: number; season_number: number; name: string; overview: string; air_date?: string; runtime?: number; still_path?: string; vote_average: number }[] };
type TmdbScheduleEpisode = { id: number; season_number: number; episode_number: number; name: string; air_date: string };
type TmdbSchedule = { last_episode_to_air?: TmdbScheduleEpisode | null; next_episode_to_air?: TmdbScheduleEpisode | null };

const genres: Record<number, string> = { 18: 'Drama', 28: 'Aksiyon', 35: 'Komedi', 80: 'Suç', 878: 'Bilim Kurgu', 9648: 'Gizem', 16: 'Animasyon', 10765: 'Bilim Kurgu & Fantastik' };

function mapMedia(item: TmdbResult, fallbackType: MediaType = 'movie'): Media {
  const type = item.media_type === 'tv' || item.media_type === 'movie' ? item.media_type : fallbackType;
  return { id: item.id, type, title: item.title ?? item.name ?? 'İsimsiz', overview: item.overview, posterUrl: item.poster_path ? `${IMAGE_URL}/w500${item.poster_path}` : '', backdropUrl: item.backdrop_path ? `${IMAGE_URL}/w1280${item.backdrop_path}` : '', year: (item.release_date ?? item.first_air_date ?? '').slice(0, 4), rating: Math.round(item.vote_average * 10) / 10, genres: (item.genre_ids ?? []).map((id) => genres[id]).filter((value): value is string => Boolean(value)) };
}

async function tmdb<T>(path: string): Promise<T> {
  const token = process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN;
  if (!token) throw new Error('TMDB API anahtarı tanımlı değil.');
  const response = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!response.ok) throw new Error(`TMDB isteği başarısız (${response.status})`);
  return response.json() as Promise<T>;
}

async function omdb(params: Record<string, string>): Promise<string | undefined> {
  const apiKey = process.env.EXPO_PUBLIC_OMDB_API_KEY;
  if (!apiKey) return undefined;
  const query = new URLSearchParams({ apikey: apiKey, ...params });
  const response = await fetch(`https://www.omdbapi.com/?${query}`);
  if (!response.ok) return undefined;
  const data = await response.json() as { Response?: string; imdbRating?: string };
  return data.Response === 'False' || !data.imdbRating || data.imdbRating === 'N/A' ? undefined : data.imdbRating;
}

export const catalogService = {
  async trending(): Promise<Media[]> {
    const body = await tmdb<{ results: TmdbResult[] }>('/trending/all/week?language=tr-TR');
    return body.results.filter((item) => item.media_type !== 'person').map((item) => mapMedia(item));
  },
  async search(query: string): Promise<Media[]> {
    if (!query.trim()) return [];
    const body = await tmdb<{ results: TmdbResult[] }>(`/search/multi?language=tr-TR&query=${encodeURIComponent(query)}`);
    return body.results.filter((item) => item.media_type !== 'person').map((item) => mapMedia(item));
  },
  async seriesDetails(seriesId: number): Promise<SeriesDetails> {
    const data = await tmdb<TmdbSeries>(`/tv/${seriesId}?language=tr-TR`);
    return { episodeRunTime: data.episode_run_time?.[0], seasons: data.seasons.filter((season) => season.season_number > 0).map((season) => ({ id: season.id, number: season.season_number, name: season.name, episodeCount: season.episode_count, airDate: season.air_date, posterUrl: season.poster_path ? `${IMAGE_URL}/w500${season.poster_path}` : undefined })) };
  },
  async seasonEpisodes(seriesId: number, season: number): Promise<EpisodeDetails[]> {
    const data = await tmdb<TmdbSeason>(`/tv/${seriesId}/season/${season}?language=tr-TR`);
    return data.episodes.map((episode) => ({ id: episode.id, number: episode.episode_number, seasonNumber: episode.season_number, title: episode.name, overview: episode.overview, airDate: episode.air_date, runtime: episode.runtime, stillUrl: episode.still_path ? `${IMAGE_URL}/w500${episode.still_path}` : undefined, tmdbRating: Math.round(episode.vote_average * 10) / 10 }));
  },
  async imdbTitleRating(media: Media): Promise<string | undefined> {
    if (!process.env.EXPO_PUBLIC_OMDB_API_KEY) return undefined;
    const ids = await tmdb<{ imdb_id?: string }>(`/${media.type}/${media.id}/external_ids`);
    return ids.imdb_id ? omdb({ i: ids.imdb_id }) : undefined;
  },
  async imdbEpisodeRatings(showTitle: string, season: number, episodes: EpisodeDetails[]): Promise<Record<number, string>> {
    if (!process.env.EXPO_PUBLIC_OMDB_API_KEY) return {};
    const entries = await Promise.all(episodes.map(async (episode) => [episode.number, await omdb({ t: showTitle, Season: String(season), Episode: String(episode.number) })] as const));
    return Object.fromEntries(entries.filter((entry): entry is readonly [number, string] => Boolean(entry[1])));
  },
  async episodeSchedule(shows: Media[]): Promise<EpisodeRelease[]> {
    const recentThreshold = Date.now() - 30 * 24 * 60 * 60_000;
    const results = await Promise.all(shows.map(async (show) => {
      const data = await tmdb<TmdbSchedule>(`/tv/${show.id}?language=tr-TR`);
      return [data.last_episode_to_air, data.next_episode_to_air]
        .filter((episode): episode is TmdbScheduleEpisode => Boolean(episode?.air_date))
        .filter((episode) => new Date(`${episode.air_date}T12:00:00`).getTime() >= recentThreshold)
        .map((episode): EpisodeRelease => ({ id: `${show.id}:${episode.season_number}:${episode.episode_number}`, show, season: episode.season_number, episode: episode.episode_number, title: episode.name, airDate: episode.air_date, watched: false }));
    }));
    return results.flat().filter((episode, index, all) => all.findIndex((item) => item.id === episode.id) === index).sort((a, b) => a.airDate.localeCompare(b.airDate));
  },
};
