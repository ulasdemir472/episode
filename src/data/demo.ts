import { EpisodeRelease, LibraryItem, Media } from '@/domain/media';

export const demoMedia: Media[] = [
  { id: 1399, type: 'tv', title: 'Game of Thrones', year: '2011', rating: 8.4, genres: ['Drama', 'Fantasy'], overview: 'Nine noble families fight for control over the lands of Westeros.', posterUrl: 'https://image.tmdb.org/t/p/w500/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg' },
  { id: 94605, type: 'tv', title: 'Arcane', year: '2021', rating: 8.7, genres: ['Animation', 'Drama'], overview: 'Two sisters find themselves on rival sides of a war between magic and technology.', posterUrl: 'https://image.tmdb.org/t/p/w500/abf8tHznhSvl9BAElD2cQeRr7do.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/rHuTyJqMd4zQ9l2p8cB9bqOBWm4.jpg' },
  { id: 157336, type: 'movie', title: 'Interstellar', year: '2014', rating: 8.5, genres: ['Sci-Fi', 'Drama'], overview: 'Explorers travel through a wormhole in space in an attempt to ensure humanity’s survival.', posterUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/xJHokMbljvjADYdit5fK5VQsXEG.jpg' },
  { id: 155, type: 'movie', title: 'The Dark Knight', year: '2008', rating: 8.5, genres: ['Action', 'Crime'], overview: 'Batman faces a criminal mastermind whose reign of chaos pushes Gotham to its limits.', posterUrl: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg' },
  { id: 66732, type: 'tv', title: 'Stranger Things', year: '2016', rating: 8.6, genres: ['Drama', 'Mystery'], overview: 'A group of young friends witness supernatural forces and secret experiments.', posterUrl: 'https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/56v2KjBlU4XaOv9rVYEQypROD7P.jpg' },
];

export const initialLibrary: LibraryItem[] = [
  { media: demoMedia[1]!, status: 'watching', progress: { watched: 12, total: 18 } },
  { media: demoMedia[2]!, status: 'watchlist' },
  { media: demoMedia[3]!, status: 'completed' },
];

export const demoReleases: EpisodeRelease[] = [
  { id: 'arcane-2-7', show: demoMedia[1]!, season: 2, episode: 7, title: 'Pretend Like It’s the First Time', airDate: new Date().toISOString(), watched: false },
  { id: 'stranger-5-2', show: demoMedia[4]!, season: 5, episode: 2, title: 'The Vanishing Of…', airDate: new Date(Date.now() - 86400000).toISOString(), watched: false },
];

