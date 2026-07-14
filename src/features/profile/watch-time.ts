import { useQuery } from '@tanstack/react-query';
import { LibraryItem } from '@/domain/media';
import { catalogService } from '@/services/tmdb';

const fallbackRuntime = (item: LibraryItem) => item.media.type === 'tv' ? 45 : 110;

export function useWatchMinutes(library: LibraryItem[]): { minutes: number; isLoading: boolean } {
  const watchedItems = library.filter((item) => item.media.type === 'tv' ? Boolean(item.progress?.watched) : item.status === 'completed');
  const signature = watchedItems.map((item) => `${item.media.type}:${item.media.id}:${item.progress?.watched ?? item.status}`).sort();
  const query = useQuery({
    queryKey: ['watch-minutes', signature],
    enabled: watchedItems.length > 0,
    staleTime: 30 * 24 * 60 * 60_000,
    queryFn: async () => {
      const runtimes = await Promise.all(watchedItems.map(async (item) => {
        try {
          return (await catalogService.titleRuntimeMinutes(item.media)) || fallbackRuntime(item);
        } catch {
          return fallbackRuntime(item);
        }
      }));
      return watchedItems.reduce((total, item, index) => total + (item.media.type === 'tv' ? runtimes[index]! * (item.progress?.watched ?? 0) : runtimes[index]!), 0);
    },
  });
  return { minutes: query.data ?? 0, isLoading: watchedItems.length > 0 && query.data === undefined };
}

export function formatWatchHours(minutes: number, language: 'tr' | 'en' = 'tr'): string {
  const hours = Math.round(minutes / 6) / 10;
  return new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 1 }).format(hours);
}
