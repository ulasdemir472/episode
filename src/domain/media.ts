export type MediaType = 'tv' | 'movie';
export type LibraryStatus = 'watching' | 'watchlist' | 'completed';

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
  progress?: { watched: number; total: number };
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

