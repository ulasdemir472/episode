import { useQueries } from '@tanstack/react-query';
import { LibraryItem } from '@/domain/media';
import { catalogService } from '@/services/tmdb';

export function useWatchMinutes(library: LibraryItem[]): number {
  const watchedItems = library.filter((item) => item.media.type === 'tv' ? Boolean(item.progress?.watched) : item.status === 'completed');
  const runtimeQueries = useQueries({
    queries: watchedItems.map((item) => ({
      queryKey: ['title-runtime', item.media.type, item.media.id],
      queryFn: () => catalogService.titleRuntimeMinutes(item.media),
      staleTime: 30 * 24 * 60 * 60_000,
    })),
  });

  return watchedItems.reduce((total, item, index) => {
    const runtime = runtimeQueries[index]?.data ?? 0;
    return total + (item.media.type === 'tv' ? runtime * (item.progress?.watched ?? 0) : runtime);
  }, 0);
}

export function formatWatchHours(minutes: number, language: 'tr' | 'en' = 'tr'): string {
  const hours = Math.round(minutes / 6) / 10;
  return new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 1 }).format(hours);
}
