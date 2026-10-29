import { LibraryItem, Media, mediaKey } from '@/domain/media';
import { Database, Json } from '@/infrastructure/supabase/database.types';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { parseReviewTarget } from '@/features/community/target';
import { CommunityComment, useCommunityStore } from '@/store/community-store';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';

const PAGE_SIZE = 500;
type CurrentUser = () => boolean;
export class StaleSyncError extends Error {}
const guard = (isCurrent: CurrentUser) => { if (!isCurrent()) throw new StaleSyncError('Session changed'); };

export async function fetchPages<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await query(from, from + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    rows.push(...result.data ?? []);
    if ((result.data?.length ?? 0) < PAGE_SIZE) return rows;
  }
}

function isMedia(value: unknown): value is Media {
  const media = value as Partial<Media> | null;
  return Boolean(media && typeof media.id === 'number' && (media.type === 'movie' || media.type === 'tv') && typeof media.title === 'string' && Array.isArray(media.genres));
}

export function canPersistReviewTarget(targetKey: string, items: LibraryItem[], watchedEpisodes: Record<string, true>): boolean {
  const target = parseReviewTarget(targetKey);
  if (!target) return false;
  if (target.targetType === 'episode') return Boolean(watchedEpisodes[`${target.mediaId}:${target.seasonNumber}:${target.episodeNumber}`]);
  const item = items.find((entry) => entry.media.id === target.mediaId && entry.media.type === target.mediaType);
  return item?.status === 'completed' || (target.mediaType === 'tv' && Object.keys(watchedEpisodes).some((key) => key.startsWith(`${target.mediaId}:`)));
}

export function hydrateAndSyncUser(userId: string, isCurrent: CurrentUser = () => true): Promise<void> {
  return enqueue(() => hydrateUser(userId, isCurrent));
}
async function hydrateUser(userId: string, isCurrent: CurrentUser): Promise<void> {
  guard(isCurrent);
  const client = requireSupabase();
  const [profile, library, episodes, favorites, ratings, comments] = await Promise.all([
    client.from('profiles').select('username,first_name,last_name,language,visibility,avatar_url,cover_url').eq('id', userId).single(),
    fetchPages((from, to) => client.from('library_items').select('media,status,progress,updated_at').eq('user_id', userId).order('media_type').order('media_id').range(from, to)),
    fetchPages((from, to) => client.from('episode_progress').select('media_id,season_number,episode_number,runtime_minutes,watched_at').eq('user_id', userId).eq('watched', true).order('media_id').order('season_number').order('episode_number').range(from, to)),
    fetchPages((from, to) => client.from('favorites').select('media').eq('user_id', userId).order('media_type').order('media_id').range(from, to)),
    fetchPages((from, to) => client.from('ratings').select('target_key,score').eq('user_id', userId).order('target_key').range(from, to)),
    fetchPages((from, to) => client.from('comments').select('id,user_id,target_key,body,created_at,parent_comment_id,image_url,spoiler').eq('user_id', userId).is('deleted_at', null).order('id').range(from, to)),
  ]);
  if (profile.error) throw profile.error;
  guard(isCurrent);
  const items: LibraryItem[] = library.flatMap((row) => isMedia(row.media) ? [{ media: row.media, status: row.status, progress: row.progress as LibraryItem['progress'] ?? undefined, updatedAt: row.updated_at }] : []);
  const keyOf = (row: typeof episodes[number]) => `${row.media_id}:${row.season_number}:${row.episode_number}`;
  useLibraryStore.getState().mergeRemote(items,
    Object.fromEntries(episodes.map((row) => [keyOf(row), true])),
    Object.fromEntries(episodes.flatMap((row) => row.runtime_minutes ? [[keyOf(row), row.runtime_minutes]] : [])),
    Object.fromEntries(episodes.flatMap((row) => row.watched_at ? [[keyOf(row), row.watched_at]] : [])));
  const remote = profile.data;
  useProfileStore.getState().mergeRemote({ username: remote.username ?? '', firstName: remote.first_name, lastName: remote.last_name, language: remote.language, visibility: remote.visibility, avatarUrl: remote.avatar_url ?? undefined, coverUrl: remote.cover_url ?? undefined, favorites: favorites.flatMap((row) => isMedia(row.media) ? [row.media] : []) });
  const ownComments: CommunityComment[] = comments.map((row) => ({ id: row.id, authorId: userId, author: `${remote.first_name} ${remote.last_name}`.trim() || remote.username || 'Episode', targetKey: row.target_key, text: row.body, createdAt: row.created_at, parentCommentId: row.parent_comment_id ?? undefined, imageUrl: row.image_url ?? undefined, spoiler: row.spoiler }));
  useCommunityStore.getState().mergeRemote(ownComments, Object.fromEntries(ratings.map((row) => [row.target_key, row.score])));
  await persistState(userId, isCurrent);
}

let writeQueue: Promise<void> = Promise.resolve();
function enqueue(work: () => Promise<void>) {
  const task = writeQueue.then(work);
  writeQueue = task.catch(() => undefined);
  return task;
}
export function persistCurrentUserState(userId: string, isCurrent: CurrentUser = () => true): Promise<void> {
  return enqueue(() => persistState(userId, isCurrent));
}

async function persistState(userId: string, isCurrent: CurrentUser): Promise<void> {
  const client = requireSupabase();
  guard(isCurrent);
  const library = useLibraryStore.getState();
  const profile = useProfileStore.getState();
  const community = useCommunityStore.getState();
  const execute = async (query: PromiseLike<{ error: unknown }>) => {
    guard(isCurrent);
    const result = await query;
    if (result.error) throw result.error;
    guard(isCurrent);
  };
  const fields = { username: 'username', firstName: 'first_name', lastName: 'last_name', language: 'language', visibility: 'visibility', avatarUrl: 'avatar_url', coverUrl: 'cover_url' } as const;
  const profileChanges = Object.fromEntries(Object.entries(profile.pendingChanges).filter(([key]) => key.startsWith('profile:')));
  if (Object.keys(profileChanges).length) {
    const patch: Record<string, string | null> = {};
    for (const [field, column] of Object.entries(fields)) if (profileChanges[`profile:${field}`]) {
      const value = profile[field as keyof typeof fields];
      patch[column] = ['username', 'avatarUrl', 'coverUrl'].includes(field) ? value || null : value ?? '';
    }
    await execute(client.from('profiles').update(patch as Database['public']['Tables']['profiles']['Update']).eq('id', userId));
    useProfileStore.getState().acknowledgeChanges(profileChanges);
  }
  const libraryById = new Map(library.items.map((item) => [mediaKey(item.media), item]));
  const favoritesById = new Map(profile.favorites.map((media) => [mediaKey(media), media]));
  const libraryChanges = Object.entries(library.pendingChanges).filter(([key]) => key.startsWith('library:'));
  const favoriteChanges = Object.entries(profile.pendingChanges).filter(([key]) => key.startsWith('favorite:'));
  const episodeChanges = Object.entries(library.pendingChanges).filter(([key]) => key.startsWith('episode:'));
  for (let from = 0; from < libraryChanges.length; from += PAGE_SIZE) {
    const batch = libraryChanges.slice(from, from + PAGE_SIZE).filter(([key]) => libraryById.has(key.slice(8)));
    if (!batch.length) continue;
    const rows = batch.map(([key]) => { const item = libraryById.get(key.slice(8))!; return { user_id: userId, media_type: item.media.type, media_id: item.media.id, status: item.status, media: item.media as unknown as Json, progress: item.progress as unknown as Json ?? null }; });
    await execute(client.from('library_items').upsert(rows, { onConflict: 'user_id,media_type,media_id' }));
    useLibraryStore.getState().acknowledgeChanges(Object.fromEntries(batch));
  }
  for (let from = 0; from < episodeChanges.length; from += PAGE_SIZE) {
    const batch = episodeChanges.slice(from, from + PAGE_SIZE);
    const rows = batch.map(([key]) => { const identity = key.slice(8); const [id, season, episode] = identity.split(':').map(Number); return { user_id: userId, media_id: id!, season_number: season!, episode_number: episode!, watched: Boolean(library.watchedEpisodes[identity]), runtime_minutes: library.episodeRuntimes[identity] ?? null, watched_at: library.episodeWatchedAt[identity] ?? null }; });
    await execute(client.from('episode_progress').upsert(rows, { onConflict: 'user_id,media_id,season_number,episode_number' }));
    useLibraryStore.getState().acknowledgeChanges(Object.fromEntries(batch));
  }
  for (let from = 0; from < favoriteChanges.length; from += PAGE_SIZE) {
    const batch = favoriteChanges.slice(from, from + PAGE_SIZE).filter(([key]) => favoritesById.has(key.slice(9)));
    if (!batch.length) continue;
    const rows = batch.map(([key]) => { const media = favoritesById.get(key.slice(9))!; return { user_id: userId, media_type: media.type, media_id: media.id, media: media as unknown as Json }; });
    await execute(client.from('favorites').upsert(rows, { onConflict: 'user_id,media_type,media_id' }));
    useProfileStore.getState().acknowledgeChanges(Object.fromEntries(batch));
  }
  for (const type of ['movie', 'tv'] as const) {
    const deletedItems = libraryChanges.filter(([key]) => key.startsWith('library:' + type + ':') && !libraryById.has(key.slice(8)));
    for (let from = 0; from < deletedItems.length; from += PAGE_SIZE) {
      const batch = deletedItems.slice(from, from + PAGE_SIZE);
      await execute(client.from('library_items').delete().eq('user_id', userId).eq('media_type', type).in('media_id', batch.map(([key]) => Number(key.split(':')[2]))));
      useLibraryStore.getState().acknowledgeChanges(Object.fromEntries(batch));
    }
    const deletedFavorites = favoriteChanges.filter(([key]) => key.startsWith('favorite:' + type + ':') && !favoritesById.has(key.slice(9)));
    for (let from = 0; from < deletedFavorites.length; from += PAGE_SIZE) {
      const batch = deletedFavorites.slice(from, from + PAGE_SIZE);
      await execute(client.from('favorites').delete().eq('user_id', userId).eq('media_type', type).in('media_id', batch.map(([key]) => Number(key.split(':')[2]))));
      useProfileStore.getState().acknowledgeChanges(Object.fromEntries(batch));
    }
  }
  for (const id of community.deletedCommentIds) {
    await execute(client.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId));
    useCommunityStore.getState().acknowledgeCommentDeletion(id);
  }
  for (const [key, change] of Object.entries(community.pendingChanges)) {
    if (key.startsWith('rating:')) {
      const targetKey = key.slice(7);
      const target = parseReviewTarget(targetKey);
      if (!target || !canPersistReviewTarget(targetKey, library.items, library.watchedEpisodes)) continue;
      const row: Database['public']['Tables']['ratings']['Insert'] = { user_id: userId, target_key: targetKey, target_type: target.targetType, media_type: target.mediaType, media_id: target.mediaId, season_number: target.seasonNumber, episode_number: target.episodeNumber, score: community.ratings[targetKey]! };
      await execute(client.from('ratings').upsert(row, { onConflict: 'user_id,target_key' }));
    } else if (key.startsWith('comment:')) {
      const comment = community.comments.find((entry) => entry.id === key.slice(8));
      const target = comment && parseReviewTarget(comment.targetKey);
      if (!comment || comment.authorId !== userId || !target || !canPersistReviewTarget(comment.targetKey, library.items, library.watchedEpisodes)) continue;
      await execute(client.from('comments').upsert({ id: comment.id, user_id: userId, target_key: comment.targetKey, target_type: target.targetType, media_type: target.mediaType, media_id: target.mediaId, season_number: target.seasonNumber, episode_number: target.episodeNumber, body: comment.text, parent_comment_id: comment.parentCommentId ?? null, image_url: comment.imageUrl ?? null, spoiler: comment.spoiler ?? false, created_at: comment.createdAt }, { onConflict: 'id' }));
    }
    useCommunityStore.getState().acknowledgeChanges({ [key]: change });
  }
}
