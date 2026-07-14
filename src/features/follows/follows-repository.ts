import { requireSupabase } from '@/infrastructure/supabase/client';
import { PublicProfile } from '@/features/friends/friends-repository';

export type FollowConnections = {
  followers: PublicProfile[];
  following: PublicProfile[];
  isFollowing: boolean;
};

type ProfileRow = { id: string; username: string | null; first_name: string; last_name: string; avatar_url: string | null; cover_url: string | null };

const toProfile = (row: ProfileRow): PublicProfile => ({
  id: row.id,
  username: row.username ?? '',
  firstName: row.first_name,
  lastName: row.last_name,
  avatarUrl: row.avatar_url ?? undefined,
  coverUrl: row.cover_url ?? undefined,
});

export async function fetchFollowConnections(profileId: string, currentUserId?: string): Promise<FollowConnections> {
  const client = requireSupabase();
  const [followersResult, followingResult] = await Promise.all([
    client.from('follows').select('follower_id,created_at').eq('following_id', profileId).order('created_at', { ascending: false }).limit(100),
    client.from('follows').select('following_id,created_at').eq('follower_id', profileId).order('created_at', { ascending: false }).limit(100),
  ]);
  const error = followersResult.error ?? followingResult.error;
  if (error) throw error;
  const followerIds = (followersResult.data ?? []).map((row) => row.follower_id);
  const followingIds = (followingResult.data ?? []).map((row) => row.following_id);
  const profileIds = [...new Set([...followerIds, ...followingIds])];
  if (profileIds.length === 0) return { followers: [], following: [], isFollowing: false };
  const profilesResult = await client.from('profiles').select('id,username,first_name,last_name,avatar_url,cover_url').in('id', profileIds);
  if (profilesResult.error) throw profilesResult.error;
  const profiles = new Map((profilesResult.data ?? []).map((row) => [row.id, toProfile(row)]));
  return {
    followers: followerIds.flatMap((id) => profiles.get(id) ? [profiles.get(id)!] : []),
    following: followingIds.flatMap((id) => profiles.get(id) ? [profiles.get(id)!] : []),
    isFollowing: Boolean(currentUserId && followerIds.includes(currentUserId)),
  };
}

export async function setFollowing(currentUserId: string, profileId: string, following: boolean): Promise<void> {
  const client = requireSupabase();
  const result = following
    ? await client.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', profileId)
    : await client.from('follows').insert({ follower_id: currentUserId, following_id: profileId });
  if (result.error) throw result.error;
}
