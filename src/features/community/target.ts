import { MediaType } from '@/domain/media';

export type ReviewTarget = {
  targetKey: string;
  targetType: 'media' | 'episode';
  mediaType: MediaType;
  mediaId: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
};

export function parseReviewTarget(targetKey: string): ReviewTarget | undefined {
  const parts = targetKey.split(':');
  if (parts[0] === 'media' && (parts[1] === 'movie' || parts[1] === 'tv')) {
    const mediaId = Number(parts[2]);
    if (parts.length !== 3 || !Number.isInteger(mediaId) || mediaId <= 0) return undefined;
    return { targetKey, targetType: 'media', mediaType: parts[1], mediaId, seasonNumber: null, episodeNumber: null };
  }
  if (parts[0] === 'episode') {
    const mediaId = Number(parts[1]);
    const seasonNumber = Number(parts[2]);
    const episodeNumber = Number(parts[3]);
    if (parts.length !== 4 || ![mediaId, seasonNumber, episodeNumber].every((value) => Number.isInteger(value) && value > 0)) return undefined;
    return { targetKey, targetType: 'episode', mediaType: 'tv', mediaId, seasonNumber, episodeNumber };
  }
  return undefined;
}
