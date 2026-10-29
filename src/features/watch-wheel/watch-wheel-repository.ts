import { Media } from '@/domain/media';
import { Json } from '@/infrastructure/supabase/database.types';
import { requireSupabase } from '@/infrastructure/supabase/client';

export type WatchWheel = { id: string; ownerId: string; title: string; result?: Media; spunAt?: string; createdAt: string };
export type WatchWheelEntry = { id: string; wheelId: string; addedBy: string; media: Media; createdAt: string; watched: boolean };

export async function fetchWatchWheels(userId: string, kind: 'wheel' | 'list' = 'wheel'): Promise<WatchWheel[]> {
  const client = requireSupabase();
  const memberships = await client.from('watch_wheel_members').select('wheel_id').eq('user_id', userId).order('created_at', { ascending: false });
  if (memberships.error) throw memberships.error;
  const ids = memberships.data?.map((row) => row.wheel_id) ?? [];
  if (!ids.length) return [];
  const wheels = await client.from('watch_wheels').select('id,owner_id,title,result_media,spun_at,created_at').eq('kind', kind).in('id', ids).order('created_at', { ascending: false });
  if (wheels.error) throw wheels.error;
  return (wheels.data ?? []).map((row) => ({ id: row.id, ownerId: row.owner_id, title: row.title, result: row.result_media ? row.result_media as unknown as Media : undefined, spunAt: row.spun_at ?? undefined, createdAt: row.created_at }));
}

export async function createWatchWheel(ownerId: string, memberIds: string[]): Promise<string> {
  const client = requireSupabase();
  const invited = [...new Set(memberIds)].filter((id) => id !== ownerId);
  const created = await client.rpc('create_watch_wheel', { invited_user_ids: invited });
  if (created.error) throw created.error;
  return created.data;
}

export async function fetchWheelEntries(wheelId: string): Promise<WatchWheelEntry[]> {
  const { data, error } = await requireSupabase().from('watch_wheel_entries').select('id,wheel_id,added_by,media,created_at,watched').eq('wheel_id', wheelId).order('created_at');
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, wheelId: row.wheel_id, addedBy: row.added_by, media: row.media as unknown as Media, createdAt: row.created_at, watched: row.watched }));
}

export async function addWheelEntry(wheelId: string, userId: string, media: Media): Promise<void> {
  const { error } = await requireSupabase().from('watch_wheel_entries').insert({ wheel_id: wheelId, added_by: userId, media: media as unknown as Json });
  if (error && error.code !== '23505') throw error;
}

export async function removeWheelEntry(entryId: string): Promise<void> {
  const { error } = await requireSupabase().from('watch_wheel_entries').delete().eq('id', entryId);
  if (error) throw error;
}

export async function spinWatchWheel(wheelId: string, previousSpunAt?: string): Promise<Media> {
  const { data, error } = await requireSupabase().rpc('spin_watch_wheel', { requested_wheel: wheelId, expected_spun_at: previousSpunAt ?? null });
  if (error) throw error;
  return data as unknown as Media;
}

export async function createSharedWatchlist(title: string, memberIds: string[]): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_shared_watchlist', { list_title: title.trim(), invited_user_ids: [...new Set(memberIds)] });
  if (error) throw error;
  return data;
}
export async function fetchSharedListMemberIds(listId: string): Promise<string[]> {
  const { data, error } = await requireSupabase().from('watch_wheel_members').select('user_id').eq('wheel_id', listId);
  if (error) throw error;
  return (data ?? []).map((member) => member.user_id);
}
export async function inviteSharedListMembers(listId: string, userIds: string[]): Promise<void> {
  const { error } = await requireSupabase().rpc('invite_shared_watchlist_members', { requested_list: listId, invited_user_ids: [...new Set(userIds)] });
  if (error) throw error;
}
export async function setSharedEntryWatched(entryId: string, watched: boolean): Promise<void> {
  const { error } = await requireSupabase().from('watch_wheel_entries').update({ watched }).eq('id', entryId);
  if (error) throw error;
}
export async function deleteSharedWatchlist(id: string): Promise<void> {
  const { error } = await requireSupabase().from('watch_wheels').delete().eq('id', id);
  if (error) throw error;
}
