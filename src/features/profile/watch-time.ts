import { LibraryItem } from '@/domain/media';

const fallbackRuntime = (item: LibraryItem) => item.media.type === 'tv' ? item.progress?.runtimeMinutes ?? 45 : item.media.runtimeMinutes ?? 110;

function collectRuntimeTotals(episodeRuntimes: Record<string, number>) {
  const runtimeTotals = new Map<number, { count: number; minutes: number }>();
  for (const [key, minutes] of Object.entries(episodeRuntimes)) {
    const mediaId = Number(key.split(':', 1)[0]);
    const current = runtimeTotals.get(mediaId) ?? { count: 0, minutes: 0 };
    runtimeTotals.set(mediaId, { count: current.count + 1, minutes: current.minutes + minutes });
  }
  return runtimeTotals;
}

function itemWatchMinutes(item: LibraryItem, runtimeTotals: Map<number, { count: number; minutes: number }>) {
  if (item.media.type === 'tv') {
    const watched = item.progress?.watched ?? 0;
    const known = runtimeTotals.get(item.media.id) ?? { count: 0, minutes: 0 };
    return known.minutes + Math.max(0, watched - known.count) * fallbackRuntime(item);
  }
  return item.status === 'completed' ? fallbackRuntime(item) : 0;
}

export function calculateWatchMinutes(library: LibraryItem[], episodeRuntimes: Record<string, number> = {}): number {
  const runtimeTotals = collectRuntimeTotals(episodeRuntimes);
  return library.reduce((total, item) => total + itemWatchMinutes(item, runtimeTotals), 0);
}

export function calculateViewingInsights(library: LibraryItem[], episodeRuntimes: Record<string, number> = {}) {
  const runtimeTotals = collectRuntimeTotals(episodeRuntimes);
  const genreMinutes = new Map<string, number>();
  let tvMinutes = 0;
  let movieMinutes = 0;
  let topShow: LibraryItem | undefined;

  for (const item of library) {
    const minutes = itemWatchMinutes(item, runtimeTotals);
    if (minutes <= 0) continue;
    if (item.media.type === 'tv') {
      tvMinutes += minutes;
      if ((item.progress?.watched ?? 0) > (topShow?.progress?.watched ?? 0)) topShow = item;
    } else movieMinutes += minutes;
    for (const genre of item.media.genres) genreMinutes.set(genre, (genreMinutes.get(genre) ?? 0) + minutes);
  }

  const favoriteGenre = [...genreMinutes.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  const totalMinutes = tvMinutes + movieMinutes;
  const dominantType = totalMinutes === 0 ? undefined : tvMinutes === movieMinutes ? 'balanced' : tvMinutes > movieMinutes ? 'tv' : 'movie';
  const dominantPercent = totalMinutes === 0 ? 0 : Math.round((Math.max(tvMinutes, movieMinutes) / totalMinutes) * 100);
  return { favoriteGenre, topTitle: topShow?.media.title, topMedia: topShow?.media, topTitleEpisodes: topShow?.progress?.watched ?? 0, tvMinutes, movieMinutes, dominantType, dominantPercent };
}

export function useWatchMinutes(library: LibraryItem[], episodeRuntimes: Record<string, number> = {}): { minutes: number; isLoading: boolean; estimated: boolean } {
  const totals = collectRuntimeTotals(episodeRuntimes);
  const estimated = library.some((item) => item.media.type === 'movie' ? item.status === 'completed' && !item.media.runtimeMinutes : (item.progress?.watched ?? 0) > (totals.get(item.media.id)?.count ?? 0));
  return { minutes: calculateWatchMinutes(library, episodeRuntimes), isLoading: false, estimated };
}

export function formatWatchHours(minutes: number, language: 'tr' | 'en' = 'tr'): string {
  const hours = Math.round(minutes / 6) / 10;
  return new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 1 }).format(hours);
}
