export type MediaType = 'tv' | 'movie';
export type LibraryStatus = 'watching' | 'watchlist' | 'completed' | 'dropped';
export type MediaRef = { id: number; type: MediaType };
export const mediaKey = (media: MediaRef) => `${media.type}:${media.id}`;
export const sameMedia = (left: MediaRef, right: MediaRef) => mediaKey(left) === mediaKey(right);

export interface Media {
  id: number;
  type: MediaType;
  title: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  year: string;
  rating: number;
  genres: string[];
  runtimeMinutes?: number;
}

export interface LibraryItem {
  media: Media;
  status: LibraryStatus;
  updatedAt?: string;
  progress?: { watched: number; total: number; nextEpisode?: { season: number; episode: number }; updatedAt?: string; runtimeMinutes?: number; seasons?: { number: number; episodeCount: number }[] };
}

export interface EpisodeRelease {
  id: string;
  show: Media;
  season: number;
  episode: number;
  title: string;
  airDate: string;
  watched: boolean;
}

export interface SeasonSummary {
  id: number;
  number: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  posterUrl?: string;
}

export interface SeriesDetails {
  seasons: SeasonSummary[];
  episodeRunTime?: number;
  overview?: string;
  originalTitle?: string;
}

export interface EpisodeDetails {
  id: number;
  number: number;
  seasonNumber: number;
  title: string;
  overview: string;
  airDate?: string;
  runtime?: number;
  stillUrl?: string;
  tmdbRating: number;
}
