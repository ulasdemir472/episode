import { Media } from '@/domain/media';
import { Json } from '@/infrastructure/supabase/database.types';
import { requireSupabase } from '@/infrastructure/supabase/client';

export type WatchWheel = { id: string; ownerId: string; title: string; result?: Media; spunAt?: string; createdAt: string };
export type WatchWheelEntry = { id: string; wheelId: string; addedBy: string; media: Media; createdAt: string };

export async function fetchWatchWheels(userId: string): Promise<WatchWheel[]> {
  const client = requireSupabase();
  const memberships = await client.from('watch_wheel_members').select('wheel_id').eq('user_id', userId).order('created_at', { ascending: false });
  if (memberships.error) throw memberships.error;
  const ids = memberships.data?.map((row) => row.wheel_id) ?? [];
  if (!ids.length) return [];
  const wheels = await client.from('watch_wheels').select('id,owner_id,title,result_media,spun_at,created_at').in('id', ids).order('created_at', { ascending: false });
  if (wheels.error) throw wheels.error;
  return (wheels.data ?? []).map((row) => ({ id: row.id, ownerId: row.owner_id, title: row.title, result: row.result_media ? row.result_media as unknown as Media : undefined, spunAt: row.spun_at ?? undefined, createdAt: row.created_at }));
}

export async function createWatchWheel(ownerId: string, memberIds: string[]): Promise<string> {
  const client = requireSupabase();
  const created = await client.from('watch_wheels').insert({ owner_id: ownerId }).select('id').single();
  if (created.error) throw created.error;
  const invited = [...new Set(memberIds)].filter((id) => id !== ownerId);
  if (invited.length) {
    const members = await client.from('watch_wheel_members').insert(invited.map((userId) => ({ wheel_id: created.data.id, user_id: userId })));
    if (members.error) throw members.error;
  }
  return created.data.id;
}

export async function fetchWheelEntries(wheelId: string): Promise<WatchWheelEntry[]> {
  const { data, error } = await requireSupabase().from('watch_wheel_entries').select('id,wheel_id,added_by,media,created_at').eq('wheel_id', wheelId).order('created_at');
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, wheelId: row.wheel_id, addedBy: row.added_by, media: row.media as unknown as Media, createdAt: row.created_at }));
}

export async function addWheelEntry(wheelId: string, userId: string, media: Media): Promise<void> {
  const { error } = await requireSupabase().from('watch_wheel_entries').insert({ wheel_id: wheelId, added_by: userId, media: media as unknown as Json });
  if (error && error.code !== '23505') throw error;
}

export async function removeWheelEntry(entryId: string): Promise<void> {
  const { error } = await requireSupabase().from('watch_wheel_entries').delete().eq('id', entryId);
  if (error) throw error;
}

export async function saveWheelResult(wheelId: string, media: Media): Promise<void> {
  const { error } = await requireSupabase().from('watch_wheels').update({ result_media: media as unknown as Json, spun_at: new Date().toISOString() }).eq('id', wheelId);
  if (error) throw error;
}
