import { requireSupabase } from '@/infrastructure/supabase/client';
import { LibraryItem, Media } from '@/domain/media';

export type PublicProfile = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  coverUrl?: string;
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
  cover_url?: string | null;
};

const toPublicProfile = (row: ProfileRow): PublicProfile => ({
  id: row.id,
  username: row.username ?? '',
  firstName: row.first_name,
  lastName: row.last_name,
  avatarUrl: row.avatar_url ?? undefined,
  coverUrl: row.cover_url ?? undefined,
});

export async function searchProfiles(query: string, currentUserId: string): Promise<PublicProfile[]> {
  const normalized = query.trim().toLowerCase().replace(/[%,()]/g, '');
  if (normalized.length < 2) return [];
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id,username,first_name,last_name,avatar_url,cover_url')
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
  const profilesResult = await client.from('profiles').select('id,username,first_name,last_name,avatar_url,cover_url').in('id', profileIds);
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

export type FriendActivity = {
  profile: PublicProfile;
  library: LibraryItem[];
  favorites: Media[];
  ratings: { targetKey: string; score: number; updatedAt: string }[];
  watchedEpisodeCount: number;
};

function isMedia(value: unknown): value is Media {
  const media = value as Partial<Media> | null;
  return Boolean(media && typeof media.id === 'number' && (media.type === 'movie' || media.type === 'tv') && typeof media.title === 'string' && Array.isArray(media.genres));
}

export async function fetchFriendActivity(currentUserId: string, friendId: string): Promise<FriendActivity> {
  const client = requireSupabase();
  const friendship = await client.from('friendships').select('id').eq('status', 'accepted').or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${currentUserId})`).maybeSingle();
  if (friendship.error) throw friendship.error;
  if (!friendship.data && currentUserId !== friendId) throw new Error('Bu profil yalnızca arkadaşlara açık.');
  const [profileResult, libraryResult, favoritesResult, ratingsResult, progressResult] = await Promise.all([
    client.from('profiles').select('id,username,first_name,last_name,avatar_url,cover_url').eq('id', friendId).single(),
    client.from('library_items').select('media,status,progress').eq('user_id', friendId).order('updated_at', { ascending: false }).limit(100),
    client.from('favorites').select('media').eq('user_id', friendId).limit(50),
    client.from('ratings').select('target_key,score,updated_at').eq('user_id', friendId).order('updated_at', { ascending: false }).limit(100),
    client.from('episode_progress').select('media_id,season_number,episode_number').eq('user_id', friendId).eq('watched', true),
  ]);
  const error = profileResult.error ?? libraryResult.error ?? favoritesResult.error ?? ratingsResult.error ?? progressResult.error;
  if (error) throw error;
  if (!profileResult.data) throw new Error('Profil bulunamadı.');
  const watchedByMedia = new Map<number, number>();
  for (const episode of progressResult.data ?? []) watchedByMedia.set(episode.media_id, (watchedByMedia.get(episode.media_id) ?? 0) + 1);
  const library = (libraryResult.data ?? []).flatMap((row) => {
    if (!isMedia(row.media)) return [];
    const storedProgress = row.progress && typeof row.progress === 'object' ? row.progress as LibraryItem['progress'] : undefined;
    const watched = watchedByMedia.get(row.media.id) ?? storedProgress?.watched ?? 0;
    const progress = watched > 0 ? { ...storedProgress, watched, total: Math.max(storedProgress?.total ?? 0, watched) } : storedProgress;
    return [{ media: row.media, status: row.status, progress }];
  });
  return {
    profile: toPublicProfile(profileResult.data),
    library,
    favorites: (favoritesResult.data ?? []).flatMap((row) => isMedia(row.media) ? [row.media] : []),
    ratings: (ratingsResult.data ?? []).map((row) => ({ targetKey: row.target_key, score: row.score, updatedAt: row.updated_at })),
    watchedEpisodeCount: progressResult.data?.length ?? 0,
  };
}
