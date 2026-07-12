import { LibraryItem, Media } from '@/domain/media';
import { Json } from '@/infrastructure/supabase/database.types';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { parseReviewTarget } from '@/features/community/target';
import { useCommunityStore } from '@/store/community-store';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';

const mediaKey = (media: Media) => `${media.type}:${media.id}`;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const createUuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
  const random = Math.floor(Math.random() * 16);
  return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
});

function isMedia(value: unknown): value is Media {
  if (!value || typeof value !== 'object') return false;
  const media = value as Partial<Media>;
  return typeof media.id === 'number' && (media.type === 'movie' || media.type === 'tv') && typeof media.title === 'string' && Array.isArray(media.genres);
}

function isLibraryItem(value: unknown): value is LibraryItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LibraryItem>;
  return isMedia(item.media) && ['watching', 'watchlist', 'completed', 'dropped'].includes(item.status ?? '');
}

export function canPersistReviewTarget(targetKey: string, items: LibraryItem[], watchedEpisodes: Record<string, true>): boolean {
  const target = parseReviewTarget(targetKey);
  if (!target) return false;
  if (target.targetType === 'episode') {
    return Boolean(watchedEpisodes[`${target.mediaId}:${target.seasonNumber}:${target.episodeNumber}`]);
  }
  const item = items.find((libraryItem) => libraryItem.media.id === target.mediaId && libraryItem.media.type === target.mediaType);
  if (target.mediaType === 'movie') return item?.status === 'completed';
  return item?.status === 'completed' || Object.keys(watchedEpisodes).some((key) => key.startsWith(`${target.mediaId}:`));
}

export async function hydrateAndSyncUser(userId: string): Promise<void> {
  const client = requireSupabase();
  const [profileResult, libraryResult, progressResult, favoritesResult] = await Promise.all([
    client.from('profiles').select('username,first_name,last_name,language,avatar_url,cover_url').eq('id', userId).maybeSingle(),
    client.from('library_items').select('media,status,progress').eq('user_id', userId),
    client.from('episode_progress').select('media_id,season_number,episode_number').eq('user_id', userId).eq('watched', true),
    client.from('favorites').select('media').eq('user_id', userId),
  ]);
  const error = profileResult.error ?? libraryResult.error ?? progressResult.error ?? favoritesResult.error;
  if (error) throw error;

  const remoteItems: LibraryItem[] = (libraryResult.data ?? []).flatMap((row) => {
    const item: unknown = { media: row.media, status: row.status, progress: row.progress ?? undefined };
    return isLibraryItem(item) ? [item] : [];
  });
  const remoteWatched = Object.fromEntries((progressResult.data ?? []).map((row) => [`${row.media_id}:${row.season_number}:${row.episode_number}`, true])) as Record<string, true>;
  useLibraryStore.getState().mergeRemote(remoteItems, remoteWatched);

  const remoteFavorites: Media[] = (favoritesResult.data ?? []).flatMap((row) => isMedia(row.media) ? [row.media] : []);
  const remoteProfile = profileResult.data;
  useProfileStore.getState().mergeRemote({
    username: remoteProfile?.username ?? '',
    firstName: remoteProfile?.first_name ?? '',
    lastName: remoteProfile?.last_name ?? '',
    language: remoteProfile?.language === 'en' ? 'en' : 'tr',
    avatarUrl: remoteProfile?.avatar_url ?? undefined,
    coverUrl: remoteProfile?.cover_url ?? undefined,
    favorites: remoteFavorites,
  });

  await persistCurrentUserState(userId);
}

export async function persistCurrentUserState(userId: string): Promise<void> {
  const client = requireSupabase();
  const library = useLibraryStore.getState();
  const profile = useProfileStore.getState();
  const community = useCommunityStore.getState();

  const profileResult = await client.from('profiles').upsert({
    id: userId,
    username: profile.username || null,
    first_name: profile.firstName,
    last_name: profile.lastName,
    language: profile.language,
    avatar_url: profile.avatarUrl ?? null,
    cover_url: profile.coverUrl ?? null,
  });
  if (profileResult.error) throw profileResult.error;

  const libraryRows = library.items.map((item) => ({ user_id: userId, media_type: item.media.type, media_id: item.media.id, status: item.status, media: item.media as unknown as Json, progress: item.progress ? item.progress as unknown as Json : null }));
  if (libraryRows.length > 0) {
    const result = await client.from('library_items').upsert(libraryRows, { onConflict: 'user_id,media_type,media_id' });
    if (result.error) throw result.error;
  }
  const remoteLibrary = await client.from('library_items').select('media_type,media_id').eq('user_id', userId);
  if (remoteLibrary.error) throw remoteLibrary.error;
  const localLibraryKeys = new Set(library.items.map((item) => mediaKey(item.media)));
  await Promise.all((remoteLibrary.data ?? []).filter((row) => !localLibraryKeys.has(`${row.media_type}:${row.media_id}`)).map(async (row) => {
    const result = await client.from('library_items').delete().eq('user_id', userId).eq('media_type', row.media_type).eq('media_id', row.media_id);
    if (result.error) throw result.error;
  }));

  const progressRows = Object.keys(library.watchedEpisodes).map((key) => {
    const [mediaId, seasonNumber, episodeNumber] = key.split(':').map(Number);
    return { user_id: userId, media_id: mediaId!, season_number: seasonNumber!, episode_number: episodeNumber!, watched: true, watched_at: new Date().toISOString() };
  });
  if (progressRows.length > 0) {
    const result = await client.from('episode_progress').upsert(progressRows, { onConflict: 'user_id,media_id,season_number,episode_number' });
    if (result.error) throw result.error;
  }
  const remoteProgress = await client.from('episode_progress').select('media_id,season_number,episode_number').eq('user_id', userId).eq('watched', true);
  if (remoteProgress.error) throw remoteProgress.error;
  const localProgressKeys = new Set(Object.keys(library.watchedEpisodes));
  await Promise.all((remoteProgress.data ?? []).filter((row) => !localProgressKeys.has(`${row.media_id}:${row.season_number}:${row.episode_number}`)).map(async (row) => {
    const result = await client.from('episode_progress').delete().eq('user_id', userId).eq('media_id', row.media_id).eq('season_number', row.season_number).eq('episode_number', row.episode_number);
    if (result.error) throw result.error;
  }));

  const favoriteRows = profile.favorites.map((media) => ({ user_id: userId, media_type: media.type, media_id: media.id, media: media as unknown as Json }));
  if (favoriteRows.length > 0) {
    const result = await client.from('favorites').upsert(favoriteRows, { onConflict: 'user_id,media_type,media_id' });
    if (result.error) throw result.error;
  }
  const remoteFavorites = await client.from('favorites').select('media_type,media_id').eq('user_id', userId);
  if (remoteFavorites.error) throw remoteFavorites.error;
  const localFavoriteKeys = new Set(profile.favorites.map(mediaKey));
  await Promise.all((remoteFavorites.data ?? []).filter((row) => !localFavoriteKeys.has(`${row.media_type}:${row.media_id}`)).map(async (row) => {
    const result = await client.from('favorites').delete().eq('user_id', userId).eq('media_type', row.media_type).eq('media_id', row.media_id);
    if (result.error) throw result.error;
  }));

  const ratingRows = Object.entries(community.ratings).flatMap(([targetKey, score]) => {
    const target = parseReviewTarget(targetKey);
    return target && canPersistReviewTarget(targetKey, library.items, library.watchedEpisodes) ? [{ user_id: userId, target_key: target.targetKey, target_type: target.targetType, media_type: target.mediaType, media_id: target.mediaId, season_number: target.seasonNumber, episode_number: target.episodeNumber, score }] : [];
  });
  if (ratingRows.length > 0) {
    const result = await client.from('ratings').upsert(ratingRows, { onConflict: 'user_id,target_key' });
    if (result.error) throw result.error;
  }

  if (community.deletedCommentIds.length > 0) {
    const deletedAt = new Date().toISOString();
    await Promise.all(community.deletedCommentIds.map(async (commentId) => {
      const result = await client.from('comments').update({ deleted_at: deletedAt }).eq('id', commentId).eq('user_id', userId);
      if (result.error) throw result.error;
      useCommunityStore.getState().acknowledgeCommentDeletion(commentId);
    }));
  }

  const commentRows = community.comments.flatMap((comment) => {
    const target = parseReviewTarget(comment.targetKey);
    return target && canPersistReviewTarget(comment.targetKey, library.items, library.watchedEpisodes) ? [{ id: uuidPattern.test(comment.id) ? comment.id : createUuid(), user_id: userId, target_key: target.targetKey, target_type: target.targetType, media_type: target.mediaType, media_id: target.mediaId, season_number: target.seasonNumber, episode_number: target.episodeNumber, body: comment.text }] : [];
  });
  if (commentRows.length > 0) {
    const result = await client.from('comments').upsert(commentRows, { onConflict: 'id' });
    if (result.error) throw result.error;
  }
}
