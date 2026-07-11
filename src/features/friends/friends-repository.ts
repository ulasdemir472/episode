import { requireSupabase } from '@/infrastructure/supabase/client';

export type PublicProfile = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
};

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export type Friendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  profile: PublicProfile;
  direction: 'incoming' | 'outgoing' | 'friend';
};

type ProfileRow = {
  id: string;
  username: string | null;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
};

const toPublicProfile = (row: ProfileRow): PublicProfile => ({
  id: row.id,
  username: row.username ?? '',
  firstName: row.first_name,
  lastName: row.last_name,
  avatarUrl: row.avatar_url ?? undefined,
});

export async function searchProfiles(query: string, currentUserId: string): Promise<PublicProfile[]> {
  const normalized = query.trim().toLowerCase().replace(/[%,()]/g, '');
  if (normalized.length < 2) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id,username,first_name,last_name,avatar_url')
    .neq('id', currentUserId)
    .or(`username.ilike.%${normalized}%,first_name.ilike.%${normalized}%,last_name.ilike.%${normalized}%`)
    .limit(12);
  if (error) throw error;
  return (data ?? []).map(toPublicProfile);
}

export async function fetchFriendships(currentUserId: string): Promise<Friendship[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('friendships')
    .select('id,requester_id,addressee_id,status,created_at')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
    .neq('status', 'declined')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const profileIds = [...new Set(rows.map((row) => row.requester_id === currentUserId ? row.addressee_id : row.requester_id))];
  if (profileIds.length === 0) return [];
  const profilesResult = await client.from('profiles').select('id,username,first_name,last_name,avatar_url').in('id', profileIds);
  if (profilesResult.error) throw profilesResult.error;
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, toPublicProfile(profile)]));

  return rows.flatMap((row) => {
    const otherId = row.requester_id === currentUserId ? row.addressee_id : row.requester_id;
    const profile = profiles.get(otherId);
    if (!profile) return [];
    return [{
      id: row.id,
      requesterId: row.requester_id,
      addresseeId: row.addressee_id,
      status: row.status,
      profile,
      direction: row.status === 'accepted' ? 'friend' : row.addressee_id === currentUserId ? 'incoming' : 'outgoing',
    }];
  });
}

export async function sendFriendRequest(currentUserId: string, targetUserId: string): Promise<void> {
  const client = requireSupabase();
  const existing = await client
    .from('friendships')
    .select('id,status')
    .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return;
  const { error } = await client.from('friendships').insert({ requester_id: currentUserId, addressee_id: targetUserId, status: 'pending' });
  if (error) throw error;
}

export async function respondFriendRequest(friendshipId: string, status: 'accepted' | 'declined'): Promise<void> {
  const { error } = await requireSupabase().from('friendships').update({ status }).eq('id', friendshipId);
  if (error) throw error;
}

export async function removeFriendship(friendshipId: string): Promise<void> {
  const { error } = await requireSupabase().from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}
