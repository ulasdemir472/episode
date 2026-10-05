import { requireSupabase } from '@/infrastructure/supabase/client';
import { LibraryItem, Media } from '@/domain/media';
import { parseReviewTarget } from '@/features/community/target';

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

export async function fetchAcceptedFriendProfiles(profileId: string): Promise<PublicProfile[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('friendships')
    .select('requester_id,addressee_id,created_at')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const profileIds = [...new Set((data ?? []).map((row) => row.requester_id === profileId ? row.addressee_id : row.requester_id))];
  if (profileIds.length === 0) return [];
  const profilesResult = await client.from('profiles').select('id,username,first_name,last_name,avatar_url,cover_url').in('id', profileIds);
  if (profilesResult.error) throw profilesResult.error;
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, toPublicProfile(profile)]));
  return profileIds.flatMap((id) => profiles.get(id) ? [profiles.get(id)!] : []);
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
  activities: ProfileActivity[];
  watchedEpisodeCount: number;
  episodeRuntimes: Record<string, number>;
};

export type ProfileActivity = {
  id: string;
  kind: 'rating' | 'comment';
  targetKey: string;
  media?: Media;
  score?: number;
  comment?: string;
  createdAt: string;
};

const PROGRESS_PAGE_SIZE = 1000;

async function fetchAllProfileProgress(friendId: string) {
  const client = requireSupabase();
  const rows: { media_id: number; season_number: number; episode_number: number; runtime_minutes: number | null }[] = [];
  for (let from = 0; ; from += PROGRESS_PAGE_SIZE) {
    const result = await client.from('episode_progress')
      .select('media_id,season_number,episode_number,runtime_minutes')
      .eq('user_id', friendId).eq('watched', true)
      .order('media_id').order('season_number').order('episode_number')
      .range(from, from + PROGRESS_PAGE_SIZE - 1);
    if (result.error) throw result.error;
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < PROGRESS_PAGE_SIZE) return rows;
  }
}

function isMedia(value: unknown): value is Media {
  const media = value as Partial<Media> | null;
  return Boolean(media && typeof media.id === 'number' && (media.type === 'movie' || media.type === 'tv') && typeof media.title === 'string' && Array.isArray(media.genres));
}

export async function fetchFriendActivity(_currentUserId: string, friendId: string): Promise<FriendActivity> {
  const client = requireSupabase();
  const [profileResult, libraryResult, favoritesResult, ratingsResult, commentsResult, progressResult] = await Promise.all([
    client.from('profiles').select('id,username,first_name,last_name,avatar_url,cover_url').eq('id', friendId).single(),
    client.from('library_items').select('media,status,progress').eq('user_id', friendId).order('updated_at', { ascending: false }).limit(1000),
    client.from('favorites').select('media').eq('user_id', friendId).limit(50),
    client.from('ratings').select('target_key,score,updated_at').eq('user_id', friendId).order('updated_at', { ascending: false }).limit(500),
    client.from('comments').select('id,target_key,body,created_at').eq('user_id', friendId).is('deleted_at', null).eq('moderation_status', 'visible').order('created_at', { ascending: false }).limit(500),
    fetchAllProfileProgress(friendId),
  ]);
  const error = profileResult.error ?? libraryResult.error ?? favoritesResult.error ?? ratingsResult.error ?? commentsResult.error;
  if (error) throw error;
  if (!profileResult.data) throw new Error('Profil bulunamadı.');
  const watchedByMedia = new Map<number, number>();
  for (const episode of progressResult) watchedByMedia.set(episode.media_id, (watchedByMedia.get(episode.media_id) ?? 0) + 1);
  const library = (libraryResult.data ?? []).flatMap((row) => {
    if (!isMedia(row.media)) return [];
    const storedProgress = row.progress && typeof row.progress === 'object' ? row.progress as LibraryItem['progress'] : undefined;
    const watched = watchedByMedia.get(row.media.id) ?? storedProgress?.watched ?? 0;
    const progress = watched > 0 ? { ...storedProgress, watched, total: Math.max(storedProgress?.total ?? 0, watched) } : storedProgress;
    return [{ media: row.media, status: row.status, progress }];
  });
  const favorites = (favoritesResult.data ?? []).flatMap((row) => isMedia(row.media) ? [row.media] : []);
  const ratings = (ratingsResult.data ?? []).map((row) => ({ targetKey: row.target_key, score: row.score, updatedAt: row.updated_at }));
  const mediaByKey = new Map([...library.map((item) => item.media), ...favorites].map((media) => [`${media.type}:${media.id}`, media]));
  const mediaForTarget = (targetKey: string) => {
    const target = parseReviewTarget(targetKey);
    return target ? mediaByKey.get(`${target.mediaType}:${target.mediaId}`) : undefined;
  };
  const activities: ProfileActivity[] = [
    ...ratings.map((rating): ProfileActivity => ({ id: `rating:${rating.targetKey}`, kind: 'rating', targetKey: rating.targetKey, media: mediaForTarget(rating.targetKey), score: rating.score, createdAt: rating.updatedAt })),
    ...(commentsResult.data ?? []).map((comment): ProfileActivity => ({ id: `comment:${comment.id}`, kind: 'comment', targetKey: comment.target_key, media: mediaForTarget(comment.target_key), comment: comment.body, createdAt: comment.created_at })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return {
    profile: toPublicProfile(profileResult.data),
    library,
    favorites,
    ratings,
    activities,
    watchedEpisodeCount: progressResult.length,
    episodeRuntimes: Object.fromEntries(progressResult.flatMap((row) => row.runtime_minutes ? [[`${row.media_id}:${row.season_number}:${row.episode_number}`, row.runtime_minutes]] : [])),
  };
}
