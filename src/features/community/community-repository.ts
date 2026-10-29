import { CommunityComment } from '@/store/community-store';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { parseReviewTarget } from './target';

export type CommunitySnapshot = {
  comments: CommunityComment[];
  ratings: { userId: string; score: number }[];
  averageRating?: number;
  ratingCount?: number;
  hasMore?: boolean;
};

export async function fetchCommunitySnapshot(targetKey: string, userId?: string, rootLimit = 30): Promise<CommunitySnapshot> {
  const client = requireSupabase();
  const [rootsResult, ratingsResult, summary] = await Promise.all([
    client.from('comments').select('id,user_id,body,created_at,parent_comment_id,image_url,spoiler').eq('target_key', targetKey).is('parent_comment_id', null).is('deleted_at', null).eq('moderation_status', 'visible').order('created_at', { ascending: false }).limit(rootLimit),
    userId ? client.from('ratings').select('user_id,score').eq('target_key', targetKey).eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
    client.rpc('community_rating_summary', { requested_target: targetKey }),
  ]);
  if (rootsResult.error) throw rootsResult.error;
  if (ratingsResult.error) throw ratingsResult.error;
  if (summary.error) throw summary.error;
  const roots = rootsResult.data ?? [];
  const replies = roots.length ? await client.from('comments').select('id,user_id,body,created_at,parent_comment_id,image_url,spoiler').in('parent_comment_id', roots.map((comment) => comment.id)).is('deleted_at', null).eq('moderation_status', 'visible').order('created_at').limit(500) : { data: [], error: null };
  if (replies.error) throw replies.error;
  const commentsResult = { data: [...roots, ...replies.data ?? []] };

  const authorIds = [...new Set((commentsResult.data ?? []).map((comment) => comment.user_id))];
  const [profilesResult, likesResult] = await Promise.all([authorIds.length > 0
    ? client.from('profiles').select('id,first_name,last_name,username,avatar_url').in('id', authorIds)
    : Promise.resolve({ data: [], error: null }),
    (commentsResult.data?.length ?? 0) > 0
      ? client.rpc('comment_like_summary', { requested_ids: commentsResult.data.map((comment) => comment.id) })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (likesResult.error) throw likesResult.error;
  const authors = new Map((profilesResult.data ?? []).map((profile) => [profile.id, {
    name: `${profile.first_name} ${profile.last_name}`.trim() || (profile.username ? `@${profile.username}` : 'Episode User'),
    avatarUrl: profile.avatar_url ?? undefined,
  }]));
  const ratings = (ratingsResult.data ?? []).map((rating) => ({ userId: rating.user_id, score: rating.score }));

  return {
    comments: (commentsResult.data ?? []).map((comment) => {
      const likes = (likesResult.data ?? []).find((like) => like.comment_id === comment.id);
      const author = authors.get(comment.user_id);
      return { id: comment.id, targetKey, authorId: comment.user_id, author: author?.name ?? 'Episode User', authorAvatarUrl: author?.avatarUrl, text: comment.body, createdAt: comment.created_at, parentCommentId: comment.parent_comment_id ?? undefined, imageUrl: comment.image_url ?? undefined, spoiler: comment.spoiler, likeCount: Number(likes?.like_count ?? 0), likedByMe: likes?.liked_by_me ?? false };
    }),
    ratings,
    averageRating: summary.data?.[0]?.average_rating ?? undefined,
    ratingCount: Number(summary.data?.[0]?.rating_count ?? 0),
    hasMore: roots.length === rootLimit,
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
    parent_comment_id: comment.parentCommentId ?? null,
    image_url: comment.imageUrl ?? null,
    spoiler: comment.spoiler ?? false,
  });
  if (error) throw error;
}

export async function reportComment(userId: string, commentId: string, reason: string): Promise<void> {
  const { error } = await requireSupabase().from('comment_reports').insert({ reporter_id: userId, comment_id: commentId, reason });
  if (error && error.code !== '23505') throw error;
}
export async function blockUser(userId: string, blockedUserId: string): Promise<void> {
  const { error } = await requireSupabase().from('user_blocks').upsert({ user_id: userId, blocked_user_id: blockedUserId }, { onConflict: 'user_id,blocked_user_id' });
  if (error) throw error;
}
export async function unblockUser(userId: string, blockedUserId: string): Promise<void> {
  const { error } = await requireSupabase().from('user_blocks').delete().eq('user_id', userId).eq('blocked_user_id', blockedUserId);
  if (error) throw error;
}
export async function fetchBlockedProfiles() {
  const { data, error } = await requireSupabase().rpc('blocked_profiles');
  if (error) throw error;
  return data ?? [];
}

export async function toggleCommentLike(userId: string, commentId: string, liked: boolean): Promise<void> {
  const client = requireSupabase();
  const result = liked
    ? await client.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId)
    : await client.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
  if (result.error) throw result.error;
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
