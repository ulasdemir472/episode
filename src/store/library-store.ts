import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LibraryItem, LibraryStatus, Media, SeasonSummary } from '@/domain/media';

type LibraryState = {
  items: LibraryItem[];
  watchedEpisodes: Record<string, true>;
  episodeRuntimes: Record<string, number>;
  upsert: (media: Media, status: LibraryStatus) => void;
  remove: (mediaId: number) => void;
  isSaved: (mediaId: number) => boolean;
  toggleEpisode: (media: Media, season: number, episode: number, seasons: SeasonSummary[], runtimeMinutes?: number) => void;
  markThrough: (media: Media, season: number, episode: number, seasons: SeasonSummary[], runtimeMinutes?: number) => void;
  recordEpisodeRuntimes: (mediaId: number, runtimes: Record<string, number>, fallbackRuntime?: number) => void;
  reopenForEpisode: (media: Media, season: number, episode: number) => void;
  isEpisodeWatched: (mediaId: number, season: number, episode: number) => boolean;
  mergeRemote: (items: LibraryItem[], watchedEpisodes: Record<string, true>, episodeRuntimes: Record<string, number>) => void;
  clearUserData: () => void;
};

const episodeKey = (mediaId: number, season: number, episode: number) => `${mediaId}:${season}:${episode}`;
const watchedCount = (episodes: Record<string, true>, mediaId: number) => Object.keys(episodes).filter((key) => key.startsWith(`${mediaId}:`)).length;

function findNextEpisode(episodes: Record<string, true>, mediaId: number, seasons: SeasonSummary[]) {
  for (const season of seasons) for (let episode = 1; episode <= season.episodeCount; episode += 1) {
    if (!episodes[episodeKey(mediaId, season.number, episode)]) return { season: season.number, episode };
  }
  return undefined;
}

function updateLibraryItem(items: LibraryItem[], media: Media, status: LibraryStatus, watched: number, total: number, nextEpisode?: { season: number; episode: number }, runtimeMinutes?: number, seasons?: SeasonSummary[]): LibraryItem[] {
  const storedSeasons = seasons?.map((item) => ({ number: item.number, episodeCount: item.episodeCount }));
  const progress = total > 0 ? { watched, total, nextEpisode, updatedAt: new Date().toISOString(), runtimeMinutes, seasons: storedSeasons } : undefined;
  return [{ media, status, progress }, ...items.filter((item) => item.media.id !== media.id)];
}

export const useLibraryStore = create<LibraryState>()(persist((set, get) => ({
  items: [],
  watchedEpisodes: {},
  episodeRuntimes: {},
  upsert: (media, status) => set((state) => {
    const current = state.items.find((item) => item.media.id === media.id);
    const progress = current?.progress ? { ...current.progress, updatedAt: new Date().toISOString() } : undefined;
    return { items: [{ media, status, progress }, ...state.items.filter((item) => item.media.id !== media.id)] };
  }),
  remove: (mediaId) => set((state) => ({ items: state.items.filter((item) => item.media.id !== mediaId) })),
  isSaved: (mediaId) => get().items.some((item) => item.media.id === mediaId),
  toggleEpisode: (media, season, episode, seasons, runtimeMinutes) => set((state) => {
    const key = episodeKey(media.id, season, episode);
    const watchedEpisodes = { ...state.watchedEpisodes };
    const episodeRuntimes = { ...state.episodeRuntimes };
    const currentProgress = state.items.find((item) => item.media.id === media.id)?.progress;
    const knownRuntime = runtimeMinutes && runtimeMinutes > 0 ? runtimeMinutes : currentProgress?.runtimeMinutes;
    if (watchedEpisodes[key]) {
      delete watchedEpisodes[key];
      delete episodeRuntimes[key];
    } else {
      watchedEpisodes[key] = true;
      if (knownRuntime) episodeRuntimes[key] = knownRuntime;
    }
    const count = watchedCount(watchedEpisodes, media.id);
    const knownSeasons = seasons.length > 0 ? seasons : currentProgress?.seasons?.map((item) => ({ ...item, id: item.number, name: `${item.number}. Sezon` })) ?? [];
    const knownTotal = knownSeasons.reduce((sum, item) => sum + item.episodeCount, 0) || currentProgress?.total || 0;
    const status: LibraryStatus = knownTotal > 0 && count >= knownTotal ? 'completed' : 'watching';
    const nextEpisode = status === 'completed' ? undefined : knownSeasons.length > 0 ? findNextEpisode(watchedEpisodes, media.id, knownSeasons) : currentProgress?.nextEpisode;
    return { watchedEpisodes, episodeRuntimes, items: updateLibraryItem(state.items, media, status, count, knownTotal, nextEpisode, knownRuntime, knownSeasons) };
  }),
  markThrough: (media, season, episode, seasons, runtimeMinutes) => set((state) => {
    const watchedEpisodes = { ...state.watchedEpisodes };
    const episodeRuntimes = { ...state.episodeRuntimes };
    const currentRuntime = runtimeMinutes && runtimeMinutes > 0 ? runtimeMinutes : state.items.find((item) => item.media.id === media.id)?.progress?.runtimeMinutes;
    for (const item of seasons) {
      if (item.number > season) continue;
      const lastEpisode = item.number === season ? episode : item.episodeCount;
      for (let number = 1; number <= lastEpisode; number += 1) {
        const key = episodeKey(media.id, item.number, number);
        watchedEpisodes[key] = true;
        if (currentRuntime && !episodeRuntimes[key]) episodeRuntimes[key] = currentRuntime;
      }
    }
    const total = seasons.reduce((sum, item) => sum + item.episodeCount, 0);
    const count = watchedCount(watchedEpisodes, media.id);
    const status: LibraryStatus = total > 0 && count >= total ? 'completed' : 'watching';
    const nextEpisode = status === 'completed' ? undefined : findNextEpisode(watchedEpisodes, media.id, seasons);
    return { watchedEpisodes, episodeRuntimes, items: updateLibraryItem(state.items, media, status, count, total, nextEpisode, currentRuntime, seasons) };
  }),
  recordEpisodeRuntimes: (mediaId, runtimes, fallbackRuntime) => set((state) => {
    const episodeRuntimes = { ...state.episodeRuntimes };
    let changed = false;
    for (const key of Object.keys(state.watchedEpisodes)) {
      if (!key.startsWith(`${mediaId}:`)) continue;
      const runtime = runtimes[key] ?? (!episodeRuntimes[key] ? fallbackRuntime : undefined);
      if (!runtime || runtime <= 0 || episodeRuntimes[key] === runtime) continue;
      episodeRuntimes[key] = runtime;
      changed = true;
    }
    const items = state.items.map((item) => item.media.id === mediaId && item.progress && fallbackRuntime
      ? { ...item, progress: { ...item.progress, runtimeMinutes: fallbackRuntime } }
      : item);
    return changed || items.some((item, index) => item !== state.items[index]) ? { episodeRuntimes, items } : state;
  }),
  reopenForEpisode: (media, season, episode) => set((state) => {
    const current = state.items.find((item) => item.media.id === media.id && item.media.type === media.type);
    const key = episodeKey(media.id, season, episode);
    if (!current || current.status !== 'completed' || state.watchedEpisodes[key]) return state;
    const watched = watchedCount(state.watchedEpisodes, media.id);
    const progress = {
      ...current.progress,
      watched,
      total: Math.max(current.progress?.total ?? 0, watched + 1),
      nextEpisode: { season, episode },
      updatedAt: new Date().toISOString(),
    };
    return { items: [{ ...current, status: 'watching', progress }, ...state.items.filter((item) => item !== current)] };
  }),
  isEpisodeWatched: (mediaId, season, episode) => Boolean(get().watchedEpisodes[episodeKey(mediaId, season, episode)]),
  mergeRemote: (remoteItems, remoteWatchedEpisodes, remoteEpisodeRuntimes) => set((state) => {
    const mergedItems = [...remoteItems, ...state.items].filter((item, index, all) => all.findIndex((candidate) => candidate.media.id === item.media.id && candidate.media.type === item.media.type) === index);
    return { items: mergedItems, watchedEpisodes: { ...remoteWatchedEpisodes, ...state.watchedEpisodes }, episodeRuntimes: { ...remoteEpisodeRuntimes, ...state.episodeRuntimes } };
  }),
  clearUserData: () => set({ items: [], watchedEpisodes: {}, episodeRuntimes: {} }),
}), {
  name: 'episode-library-v1',
  version: 4,
  storage: createJSONStorage(() => AsyncStorage),
  migrate: (persisted) => {
    const state = persisted as LibraryState;
    const legacyDemoIds = new Set([94605, 157336, 155]);
    return { ...state, items: (state.items ?? []).filter((item) => !legacyDemoIds.has(item.media.id)), watchedEpisodes: state.watchedEpisodes ?? {}, episodeRuntimes: state.episodeRuntimes ?? {} };
  },
}));
