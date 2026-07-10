export type MediaType = 'tv' | 'movie';
export type LibraryStatus = 'watching' | 'watchlist' | 'completed' | 'dropped';

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
}

export interface LibraryItem {
  media: Media;
  status: LibraryStatus;
  progress?: { watched: number; total: number; nextEpisode?: { season: number; episode: number } };
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
