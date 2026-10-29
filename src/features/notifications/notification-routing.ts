import { parseReviewTarget } from '@/features/community/target';

export function notificationRoute(data: unknown): string {
  if (!data || typeof data !== 'object') return '/notifications';
  const payload = data as Record<string, unknown>;
  const target = typeof payload.targetKey === 'string' ? parseReviewTarget(payload.targetKey) : undefined;
  if (target) return `/media/${target.mediaId}?type=${target.mediaType}&targetKey=${encodeURIComponent(target.targetKey)}${target.targetType === 'episode' ? `&season=${target.seasonNumber}&episode=${target.episodeNumber}` : ''}`;
  const route = payload.route;
  if (typeof route !== 'string') return '/notifications';
  if ((route === '/watch-wheel' || route === '/shared-lists') && typeof payload.wheelId === 'string' && /^[0-9a-f-]{36}$/i.test(payload.wheelId)) return `${route}?id=${payload.wheelId}`;
  if (['/notifications', '/friends', '/releases', '/watch-wheel', '/shared-lists', '/friends-activity'].includes(route)) return route;
  if (/^\/profile\/[0-9a-f-]{36}$/i.test(route)) return route;
  if (/^\/media\/[1-9]\d*$/.test(route) && (payload.mediaType === 'movie' || payload.mediaType === 'tv')) return `${route}?type=${payload.mediaType}`;
  return '/notifications';
}
