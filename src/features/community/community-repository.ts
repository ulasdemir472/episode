import { CommunityComment } from '@/store/community-store';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { parseReviewTarget } from './target';

export type CommunitySnapshot = {
  comments: CommunityComment[];
  ratings: { userId: string; score: number }[];
};

export async function fetchCommunitySnapshot(targetKey: string): Promise<CommunitySnapshot> {
  const client = requireSupabase();
  const [commentsResult, ratingsResult] = await Promise.all([
    client.from('comments').select('id,user_id,body,created_at').eq('target_key', targetKey).is('deleted_at', null).eq('moderation_status', 'visible').order('created_at', { ascending: false }).limit(50),
    client.from('ratings').select('user_id,score').eq('target_key', targetKey),
  ]);
  if (commentsResult.error) throw commentsResult.error;
  if (ratingsResult.error) throw ratingsResult.error;

  const authorIds = [...new Set((commentsResult.data ?? []).map((comment) => comment.user_id))];
  const profilesResult = authorIds.length > 0
    ? await client.from('profiles').select('id,first_name,last_name').in('id', authorIds)
    : { data: [], error: null };
  if (profilesResult.error) throw profilesResult.error;
  const authors = new Map((profilesResult.data ?? []).map((profile) => [profile.id, `${profile.first_name} ${profile.last_name}`.trim() || 'Episode User']));

  return {
    comments: (commentsResult.data ?? []).map((comment) => ({ id: comment.id, targetKey, authorId: comment.user_id, author: authors.get(comment.user_id) ?? 'Episode User', text: comment.body, createdAt: comment.created_at })),
    ratings: (ratingsResult.data ?? []).map((rating) => ({ userId: rating.user_id, score: rating.score })),
  };
}

export async function persistComment(comment: CommunityComment): Promise<void> {
  const target = parseReviewTarget(comment.targetKey);
  if (!target || !comment.authorId) throw new Error('Yorum hedefi veya kullanıcı bilgisi geçersiz.');
  const { error } = await requireSupabase().from('comments').insert({
    id: comment.id,
    user_id: comment.authorId,
    target_key: target.targetKey,
    target_type: target.targetType,
    media_type: target.mediaType,
    media_id: target.mediaId,
    season_number: target.seasonNumber,
    episode_number: target.episodeNumber,
    body: comment.text,
  });
  if (error) throw error;
}

export async function persistRating(userId: string, targetKey: string, score: number): Promise<void> {
  const target = parseReviewTarget(targetKey);
  if (!target) throw new Error('Puan hedefi geçersiz.');
  const { error } = await requireSupabase().from('ratings').upsert({
    user_id: userId,
    target_key: target.targetKey,
    target_type: target.targetType,
    media_type: target.mediaType,
    media_id: target.mediaId,
    season_number: target.seasonNumber,
    episode_number: target.episodeNumber,
    score,
  }, { onConflict: 'user_id,target_key' });
  if (error) throw error;
}

export async function softDeleteComment(userId: string, commentId: string): Promise<void> {
  const { error } = await requireSupabase().from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId).eq('user_id', userId);
  if (error) throw error;
}
