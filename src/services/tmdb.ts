import { demoMedia } from '@/data/demo';
import { Media, MediaType } from '@/domain/media';

const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_URL = 'https://image.tmdb.org/t/p';

type TmdbResult = {
  id: number; media_type?: MediaType | 'person'; title?: string; name?: string; overview: string;
  poster_path?: string; backdrop_path?: string; release_date?: string; first_air_date?: string;
  vote_average: number; genre_ids?: number[];
};

const genres: Record<number, string> = { 18: 'Drama', 28: 'Action', 35: 'Comedy', 80: 'Crime', 878: 'Sci-Fi', 9648: 'Mystery', 16: 'Animation', 10765: 'Sci-Fi & Fantasy' };

function mapMedia(item: TmdbResult, fallbackType: MediaType = 'movie'): Media {
  const type = item.media_type === 'tv' || item.media_type === 'movie' ? item.media_type : fallbackType;
  return {
    id: item.id, type, title: item.title ?? item.name ?? 'Untitled', overview: item.overview,
    posterUrl: item.poster_path ? `${IMAGE_URL}/w500${item.poster_path}` : '',
    backdropUrl: item.backdrop_path ? `${IMAGE_URL}/w1280${item.backdrop_path}` : '',
    year: (item.release_date ?? item.first_air_date ?? '').slice(0, 4),
    rating: Math.round(item.vote_average * 10) / 10,
    genres: (item.genre_ids ?? []).map((id) => genres[id]).filter((value): value is string => Boolean(value)),
  };
}

async function request(path: string): Promise<TmdbResult[]> {
  const token = process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN;
  if (!token) return demoMedia as unknown as TmdbResult[];
  const response = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  const body = (await response.json()) as { results: TmdbResult[] };
  return body.results;
}

export const catalogService = {
  async trending(): Promise<Media[]> {
    if (!process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN) return demoMedia;
    return (await request('/trending/all/week?language=tr-TR')).filter((item) => item.media_type !== 'person').map((item) => mapMedia(item));
  },
  async search(query: string): Promise<Media[]> {
    if (!query.trim()) return [];
    if (!process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN) return demoMedia.filter((item) => item.title.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')));
    return (await request(`/search/multi?language=tr-TR&query=${encodeURIComponent(query)}`)).filter((item) => item.media_type !== 'person').map((item) => mapMedia(item));
  },
};
