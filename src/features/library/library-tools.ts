import { LibraryItem, LibraryStatus, Media, MediaType, mediaKey } from '@/domain/media';
import type { AppLanguage } from '@/store/profile-store';

export type LibraryFilter = LibraryStatus | 'all' | 'favorites';
export type LibrarySort = 'recent' | 'title' | 'rating' | 'year';
export function filterLibrary(items: LibraryItem[], favorites: Media[], options: { status: LibraryFilter; type: 'all' | MediaType; query: string; sort: LibrarySort; language: AppLanguage }) {
  const source = options.status === 'favorites' ? favorites.map((media) => items.find((item) => mediaKey(item.media) === mediaKey(media)) ?? { media, status: 'watchlist' as const }) : items;
  const query = options.query.trim().toLocaleLowerCase(options.language === 'tr' ? 'tr-TR' : 'en-US');
  return source.filter((item) => (options.status === 'favorites' || options.status === 'all' || item.status === options.status) && (options.type === 'all' || item.media.type === options.type) && item.media.title.toLocaleLowerCase(options.language === 'tr' ? 'tr-TR' : 'en-US').includes(query)).sort((left, right) => {
    switch (options.sort) {
      case 'title': return left.media.title.localeCompare(right.media.title, options.language);
      case 'rating': return right.media.rating - left.media.rating;
      case 'year': return Number(right.media.year || 0) - Number(left.media.year || 0);
      default: return (right.progress?.updatedAt ?? right.updatedAt ?? '').localeCompare(left.progress?.updatedAt ?? left.updatedAt ?? '');
    }
  });
}
export function libraryCsv(items: LibraryItem[]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    // Prevent spreadsheet formula execution when exported titles begin with special characters.
    return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  return ['type,id,title,status,watched,total', ...items.map((item) => [item.media.type, item.media.id, item.media.title, item.status, item.progress?.watched ?? 0, item.progress?.total ?? 0].map(cell).join(','))].join('\r\n');
}
