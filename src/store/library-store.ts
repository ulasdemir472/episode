import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LibraryItem, LibraryStatus, Media, MediaRef, SeasonSummary, mediaKey, sameMedia } from '@/domain/media';
import { acknowledge, changedKeys, ChangeJournal, revision } from '@/features/sync/change-journal';

type LibraryState = {
  items: LibraryItem[];
  watchedEpisodes: Record<string, true>;
  episodeRuntimes: Record<string, number>;
  episodeWatchedAt: Record<string, string>;
  pendingChanges: ChangeJournal;
  ownerId?: string;
  bindUser: (userId: string) => void;
  acknowledgeChanges: (sent: ChangeJournal) => void;
  restore: (item: LibraryItem) => void;
  recordTitleRuntime: (media: MediaRef, minutes: number) => void;
  upsert: (media: Media, status: LibraryStatus) => void;
  remove: (media: MediaRef) => void;
  isSaved: (media: MediaRef) => boolean;
  toggleEpisode: (media: Media, season: number, episode: number, seasons: SeasonSummary[], runtimeMinutes?: number) => void;
  markThrough: (media: Media, season: number, episode: number, seasons: SeasonSummary[], runtimeMinutes?: number) => void;
  recordEpisodeRuntimes: (mediaId: number, runtimes: Record<string, number>, fallbackRuntime?: number) => void;
  reopenForEpisode: (media: Media, season: number, episode: number) => void;
  isEpisodeWatched: (mediaId: number, season: number, episode: number) => boolean;
  mergeRemote: (items: LibraryItem[], watchedEpisodes: Record<string, true>, episodeRuntimes: Record<string, number>, watchedAt?: Record<string, string>) => void;
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
  return [{ media, status, progress, updatedAt: new Date().toISOString() }, ...items.filter((item) => !sameMedia(item.media, media))];
}

const emptyLibrary = () => ({ items: [] as LibraryItem[], watchedEpisodes: {} as Record<string, true>, episodeRuntimes: {} as Record<string, number>, episodeWatchedAt: {} as Record<string, string>, pendingChanges: {} as ChangeJournal });

function journal(state: LibraryState, patch: Partial<LibraryState>): Partial<LibraryState> {
  const next = { ...state, ...patch };
  const pendingChanges = { ...state.pendingChanges };
  for (const key of changedKeys(state.items, next.items, (item) => mediaKey(item.media))) pendingChanges[`library:${key}`] = revision();
  const episodeWatchedAt = { ...state.episodeWatchedAt };
  for (const key of new Set([...Object.keys(state.watchedEpisodes), ...Object.keys(next.watchedEpisodes)])) {
    if (state.watchedEpisodes[key] !== next.watchedEpisodes[key] || state.episodeRuntimes[key] !== next.episodeRuntimes[key]) {
      pendingChanges[`episode:${key}`] = revision();
      if (next.watchedEpisodes[key] && !state.watchedEpisodes[key]) episodeWatchedAt[key] = new Date().toISOString();
      else if (next.watchedEpisodes[key]) { /* Metadata refresh preserves unknown historical dates. */ }
      else delete episodeWatchedAt[key];
    }
  }
  return { ...patch, pendingChanges, episodeWatchedAt };
}

export const useLibraryStore = create<LibraryState>()(persist((set, get) => ({
  ...emptyLibrary(),
  bindUser: (ownerId) => set((state) => state.ownerId && state.ownerId !== ownerId ? { ...emptyLibrary(), ownerId } : { ownerId }),
  acknowledgeChanges: (sent) => set((state) => ({ pendingChanges: acknowledge(state.pendingChanges, sent) })),
  restore: (item) => set((state) => journal(state, { items: [item, ...state.items.filter((entry) => !sameMedia(entry.media, item.media))] })),
  recordTitleRuntime: (media, minutes) => set((state) => minutes > 0 && state.items.some((item) => sameMedia(item.media, media) && item.media.runtimeMinutes !== minutes) ? journal(state, { items: state.items.map((item) => sameMedia(item.media, media) ? { ...item, media: { ...item.media, runtimeMinutes: minutes } } : item) }) : state),
  upsert: (media, status) => set((state) => {
    const current = state.items.find((item) => sameMedia(item.media, media));
    const progress = current?.progress ? { ...current.progress, updatedAt: new Date().toISOString() } : undefined;
    return journal(state, { items: [{ media, status, progress, updatedAt: new Date().toISOString() }, ...state.items.filter((item) => !sameMedia(item.media, media))] });
  }),
  remove: (media) => set((state) => journal(state, { items: state.items.filter((item) => !sameMedia(item.media, media)) })),
  isSaved: (media) => get().items.some((item) => sameMedia(item.media, media)),
  toggleEpisode: (media, season, episode, seasons, runtimeMinutes) => set((state) => {
    const key = episodeKey(media.id, season, episode);
    const watchedEpisodes = { ...state.watchedEpisodes };
    const episodeRuntimes = { ...state.episodeRuntimes };
    const currentProgress = state.items.find((item) => sameMedia(item.media, media))?.progress;
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
    return journal(state, { watchedEpisodes, episodeRuntimes, items: updateLibraryItem(state.items, media, status, count, knownTotal, nextEpisode, knownRuntime, knownSeasons) });
  }),
  markThrough: (media, season, episode, seasons, runtimeMinutes) => set((state) => {
    const watchedEpisodes = { ...state.watchedEpisodes };
    const episodeRuntimes = { ...state.episodeRuntimes };
    const currentRuntime = runtimeMinutes && runtimeMinutes > 0 ? runtimeMinutes : state.items.find((item) => sameMedia(item.media, media))?.progress?.runtimeMinutes;
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
    return journal(state, { watchedEpisodes, episodeRuntimes, items: updateLibraryItem(state.items, media, status, count, total, nextEpisode, currentRuntime, seasons) });
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
    const items = state.items.map((item) => item.media.type === 'tv' && item.media.id === mediaId && item.progress && fallbackRuntime && item.progress.runtimeMinutes !== fallbackRuntime
      ? { ...item, progress: { ...item.progress, runtimeMinutes: fallbackRuntime } }
      : item);
    return changed || items.some((item, index) => item !== state.items[index]) ? journal(state, { episodeRuntimes, items }) : state;
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
    return journal(state, { items: [{ ...current, status: 'watching', progress }, ...state.items.filter((item) => item !== current)] });
  }),
  isEpisodeWatched: (mediaId, season, episode) => Boolean(get().watchedEpisodes[episodeKey(mediaId, season, episode)]),
  mergeRemote: (remoteItems, remoteWatchedEpisodes, remoteEpisodeRuntimes, remoteWatchedAt = {}) => set((state) => {
    const items = new Map(remoteItems.map((item) => [mediaKey(item.media), item]));
    const watchedEpisodes = { ...remoteWatchedEpisodes };
    const episodeRuntimes = { ...remoteEpisodeRuntimes };
    const episodeWatchedAt = { ...remoteWatchedAt };
    for (const key of Object.keys(state.pendingChanges)) {
      if (key.startsWith('library:')) {
        const id = key.slice(8);
        const local = state.items.find((item) => mediaKey(item.media) === id);
        if (local) items.set(id, local); else items.delete(id);
      } else if (key.startsWith('episode:')) {
        const id = key.slice(8);
        if (state.watchedEpisodes[id]) {
          watchedEpisodes[id] = true;
          if (state.episodeRuntimes[id]) episodeRuntimes[id] = state.episodeRuntimes[id]!;
          if (state.episodeWatchedAt[id]) episodeWatchedAt[id] = state.episodeWatchedAt[id]!;
        } else { delete watchedEpisodes[id]; delete episodeRuntimes[id]; delete episodeWatchedAt[id]; }
      }
    }
    const reconciled = [...items.values()].map((item): LibraryItem => {
      if (item.media.type !== 'tv' || !item.progress || !['watching', 'completed'].includes(item.status)) return item;
      const watched = watchedCount(watchedEpisodes, item.media.id);
      const seasons = item.progress.seasons?.map((entry) => ({ ...entry, id: entry.number, name: String(entry.number) })) ?? [];
      const total = Math.max(watched, item.progress.total);
      const status = total > 0 && watched >= total ? 'completed' : 'watching';
      return { ...item, status, progress: { ...item.progress, watched, total, nextEpisode: status === 'completed' ? undefined : seasons.length ? findNextEpisode(watchedEpisodes, item.media.id, seasons) : item.progress.nextEpisode } };
    });
    return { items: reconciled, watchedEpisodes, episodeRuntimes, episodeWatchedAt };
  }),
  clearUserData: () => set({ ...emptyLibrary(), ownerId: undefined }),
}), {
  name: 'episode-library-v1',
  version: 5,
  storage: createJSONStorage(() => AsyncStorage),
  migrate: (persisted) => {
    const state = persisted as LibraryState;
    const pendingChanges = { ...state.pendingChanges };
    for (const item of state.items ?? []) pendingChanges[`library:${mediaKey(item.media)}`] ??= revision();
    for (const key of Object.keys(state.watchedEpisodes ?? {})) pendingChanges[`episode:${key}`] ??= revision();
    return { ...emptyLibrary(), ...state, pendingChanges };
  },
}));
