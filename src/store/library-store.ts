import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LibraryItem, LibraryStatus, Media, SeasonSummary } from '@/domain/media';

type LibraryState = {
  items: LibraryItem[];
  watchedEpisodes: Record<string, true>;
  upsert: (media: Media, status: LibraryStatus) => void;
  remove: (mediaId: number) => void;
  isSaved: (mediaId: number) => boolean;
  toggleEpisode: (media: Media, season: number, episode: number, totalEpisodes: number) => void;
  markThrough: (media: Media, season: number, episode: number, seasons: SeasonSummary[]) => void;
  isEpisodeWatched: (mediaId: number, season: number, episode: number) => boolean;
};

const episodeKey = (mediaId: number, season: number, episode: number) => `${mediaId}:${season}:${episode}`;
const watchedCount = (episodes: Record<string, true>, mediaId: number) => Object.keys(episodes).filter((key) => key.startsWith(`${mediaId}:`)).length;

function updateLibraryItem(items: LibraryItem[], media: Media, status: LibraryStatus, watched: number, total: number): LibraryItem[] {
  const progress = total > 0 ? { watched, total } : undefined;
  return [...items.filter((item) => item.media.id !== media.id), { media, status, progress }];
}

export const useLibraryStore = create<LibraryState>()(persist((set, get) => ({
  items: [],
  watchedEpisodes: {},
  upsert: (media, status) => set((state) => {
    const current = state.items.find((item) => item.media.id === media.id);
    return { items: [...state.items.filter((item) => item.media.id !== media.id), { media, status, progress: current?.progress }] };
  }),
  remove: (mediaId) => set((state) => ({ items: state.items.filter((item) => item.media.id !== mediaId) })),
  isSaved: (mediaId) => get().items.some((item) => item.media.id === mediaId),
  toggleEpisode: (media, season, episode, totalEpisodes) => set((state) => {
    const key = episodeKey(media.id, season, episode);
    const watchedEpisodes = { ...state.watchedEpisodes };
    if (watchedEpisodes[key]) delete watchedEpisodes[key]; else watchedEpisodes[key] = true;
    const count = watchedCount(watchedEpisodes, media.id);
    const knownTotal = totalEpisodes || state.items.find((item) => item.media.id === media.id)?.progress?.total || 0;
    const status: LibraryStatus = knownTotal > 0 && count >= knownTotal ? 'completed' : 'watching';
    return { watchedEpisodes, items: updateLibraryItem(state.items, media, status, count, knownTotal) };
  }),
  markThrough: (media, season, episode, seasons) => set((state) => {
    const watchedEpisodes = { ...state.watchedEpisodes };
    for (const item of seasons) {
      if (item.number > season) continue;
      const lastEpisode = item.number === season ? episode : item.episodeCount;
      for (let number = 1; number <= lastEpisode; number += 1) watchedEpisodes[episodeKey(media.id, item.number, number)] = true;
    }
    const total = seasons.reduce((sum, item) => sum + item.episodeCount, 0);
    const count = watchedCount(watchedEpisodes, media.id);
    const status: LibraryStatus = total > 0 && count >= total ? 'completed' : 'watching';
    return { watchedEpisodes, items: updateLibraryItem(state.items, media, status, count, total) };
  }),
  isEpisodeWatched: (mediaId, season, episode) => Boolean(get().watchedEpisodes[episodeKey(mediaId, season, episode)]),
}), {
  name: 'episode-library-v1',
  version: 3,
  storage: createJSONStorage(() => AsyncStorage),
  migrate: (persisted) => {
    const state = persisted as LibraryState;
    const legacyDemoIds = new Set([94605, 157336, 155]);
    return { ...state, items: (state.items ?? []).filter((item) => !legacyDemoIds.has(item.media.id)), watchedEpisodes: state.watchedEpisodes ?? {} };
  },
}));
