import { mediaKey, type LibraryItem, type Media } from '@/domain/media';

function hasWatched(item: LibraryItem): boolean {
  return item.status === 'completed' || (item.media.type === 'tv' && (item.progress?.watched ?? 0) > 0);
}

/** Actual viewing history, rather than titles merely saved or favorited. */
export function commonWatched(ownLibrary: readonly LibraryItem[], otherLibrary: readonly LibraryItem[]): Media[] {
  const own = new Map(ownLibrary.filter(hasWatched).map(item => [mediaKey(item.media), item.media]));
  const common = new Map<string, Media>();
  for (const item of otherLibrary) {
    const key = mediaKey(item.media);
    const media = own.get(key);
    if (media && hasWatched(item)) common.set(key, media);
  }
  return [...common.values()];
}
