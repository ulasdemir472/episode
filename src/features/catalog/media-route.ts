import { Media, MediaRef } from '@/domain/media';
import { parseReviewTarget } from '@/features/community/target';

export function parseMediaSnapshot(data?: string): Media | undefined {
  try {
    const item = JSON.parse(data ?? '') as Partial<Media>;
    if (!Number.isSafeInteger(item.id) || item.id! <= 0 || !['movie', 'tv'].includes(item.type ?? '') || typeof item.title !== 'string') return undefined;
    const text = (value: unknown) => typeof value === 'string' ? value : '';
    return { id: item.id!, type: item.type!, title: item.title, overview: text(item.overview), posterUrl: text(item.posterUrl), backdropUrl: text(item.backdropUrl), year: text(item.year), rating: typeof item.rating === 'number' && Number.isFinite(item.rating) ? item.rating : 0, genres: Array.isArray(item.genres) ? item.genres.filter((genre): genre is string => typeof genre === 'string') : [], runtimeMinutes: typeof item.runtimeMinutes === 'number' && Number.isFinite(item.runtimeMinutes) && item.runtimeMinutes > 0 ? item.runtimeMinutes : undefined };
  } catch { return undefined; }
}
export function mediaIdentity(params: { id?: string; type?: string; targetKey?: string; data?: string }): MediaRef | undefined {
  const snapshot = parseMediaSnapshot(params.data);
  const target = params.targetKey ? parseReviewTarget(params.targetKey) : undefined;
  const id = Number(params.id ?? snapshot?.id ?? target?.mediaId);
  const type = params.type ?? target?.mediaType ?? snapshot?.type;
  if (!Number.isSafeInteger(id) || id <= 0 || (type !== 'movie' && type !== 'tv')) return undefined;
  return { id, type };
}
