import { LibraryItem } from '@/domain/media';

const fallbackRuntime = (item: LibraryItem) => item.media.type === 'tv' ? item.progress?.runtimeMinutes ?? 45 : 110;

export function calculateWatchMinutes(library: LibraryItem[], episodeRuntimes: Record<string, number> = {}): number {
  const runtimeTotals = new Map<number, { count: number; minutes: number }>();
  for (const [key, minutes] of Object.entries(episodeRuntimes)) {
    const mediaId = Number(key.split(':', 1)[0]);
    const current = runtimeTotals.get(mediaId) ?? { count: 0, minutes: 0 };
    runtimeTotals.set(mediaId, { count: current.count + 1, minutes: current.minutes + minutes });
  }
  return library.reduce((total, item) => {
    if (item.media.type === 'tv') {
      const watched = item.progress?.watched ?? 0;
      const known = runtimeTotals.get(item.media.id) ?? { count: 0, minutes: 0 };
      return total + known.minutes + Math.max(0, watched - known.count) * fallbackRuntime(item);
    }
    return item.status === 'completed' ? total + fallbackRuntime(item) : total;
  }, 0);
}

export function useWatchMinutes(library: LibraryItem[], episodeRuntimes: Record<string, number> = {}): { minutes: number; isLoading: boolean } {
  return { minutes: calculateWatchMinutes(library, episodeRuntimes), isLoading: false };
}

export function formatWatchHours(minutes: number, language: 'tr' | 'en' = 'tr'): string {
  const hours = Math.round(minutes / 6) / 10;
  return new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 1 }).format(hours);
}
