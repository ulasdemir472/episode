import { CommunityComment } from '@/store/community-store';
import { requireSupabase } from '@/infrastructure/supabase/client';
import { parseReviewTarget } from './target';

export type CommunitySnapshot = {
  comments: CommunityComment[];
  ratings: { userId: string; score: number }[];
  averageRating?: number;
};

export async function fetchCommunitySnapshot(targetKey: string): Promise<CommunitySnapshot> {
  const client = requireSupabase();
  const [commentsResult, ratingsResult] = await Promise.all([
    client.from('comments').select('id,user_id,body,created_at,parent_comment_id,image_url').eq('target_key', targetKey).is('deleted_at', null).eq('moderation_status', 'visible').order('created_at', { ascending: false }).limit(100),
    client.from('ratings').select('user_id,score').eq('target_key', targetKey),
  ]);
  if (commentsResult.error) throw commentsResult.error;
  if (ratingsResult.error) throw ratingsResult.error;

  const authorIds = [...new Set((commentsResult.data ?? []).map((comment) => comment.user_id))];
  const [profilesResult, likesResult] = await Promise.all([authorIds.length > 0
    ? client.from('profiles').select('id,first_name,last_name,username,avatar_url').in('id', authorIds)
    : Promise.resolve({ data: [], error: null }),
    (commentsResult.data?.length ?? 0) > 0
      ? client.from('comment_likes').select('comment_id,user_id').in('comment_id', (commentsResult.data ?? []).map((comment) => comment.id))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (likesResult.error) throw likesResult.error;
  const authors = new Map((profilesResult.data ?? []).map((profile) => [profile.id, {
    name: `${profile.first_name} ${profile.last_name}`.trim() || (profile.username ? `@${profile.username}` : 'Episode User'),
    avatarUrl: profile.avatar_url ?? undefined,
  }]));
  const { data: authData } = await client.auth.getUser();
  const currentUserId = authData.user?.id;
  const ratings = (ratingsResult.data ?? []).map((rating) => ({ userId: rating.user_id, score: rating.score }));

  return {
    comments: (commentsResult.data ?? []).map((comment) => {
      const likes = (likesResult.data ?? []).filter((like) => like.comment_id === comment.id);
      const author = authors.get(comment.user_id);
      return { id: comment.id, targetKey, authorId: comment.user_id, author: author?.name ?? 'Episode User', authorAvatarUrl: author?.avatarUrl, text: comment.body, createdAt: comment.created_at, parentCommentId: comment.parent_comment_id ?? undefined, imageUrl: comment.image_url ?? undefined, likeCount: likes.length, likedByMe: likes.some((like) => like.user_id === currentUserId) };
    }),
    ratings,
    averageRating: ratings.length > 0 ? Math.round((ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length) * 10) / 10 : undefined,
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
  });
  if (error) throw error;
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
