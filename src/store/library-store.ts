import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { initialLibrary } from '@/data/demo';
import { LibraryItem, LibraryStatus, Media } from '@/domain/media';

type LibraryState = {
  items: LibraryItem[];
  watchedEpisodes: Record<string, true>;
  upsert: (media: Media, status: LibraryStatus) => void;
  remove: (mediaId: number) => void;
  isSaved: (mediaId: number) => boolean;
  toggleEpisode: (media: Media, season: number, episode: number) => void;
  isEpisodeWatched: (mediaId: number, season: number, episode: number) => boolean;
};

const episodeKey = (mediaId: number, season: number, episode: number) => `${mediaId}:${season}:${episode}`;

export const useLibraryStore = create<LibraryState>()(persist((set, get) => ({
  items: initialLibrary,
  watchedEpisodes: {},
  upsert: (media, status) => set((state) => ({ items: [...state.items.filter((item) => item.media.id !== media.id), { media, status }] })),
  remove: (mediaId) => set((state) => ({ items: state.items.filter((item) => item.media.id !== mediaId) })),
  isSaved: (mediaId) => get().items.some((item) => item.media.id === mediaId),
  toggleEpisode: (media, season, episode) => set((state) => {
    const key = episodeKey(media.id, season, episode);
    const watchedEpisodes = { ...state.watchedEpisodes };
    if (watchedEpisodes[key]) delete watchedEpisodes[key];
    else watchedEpisodes[key] = true;
    const exists = state.items.some((item) => item.media.id === media.id);
    return {
      watchedEpisodes,
      items: exists ? state.items : [...state.items, { media, status: 'watching' as const }],
    };
  }),
  isEpisodeWatched: (mediaId, season, episode) => Boolean(get().watchedEpisodes[episodeKey(mediaId, season, episode)]),
}), { name: 'episode-library-v1', storage: createJSONStorage(() => AsyncStorage) }));
