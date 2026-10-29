import { t } from '@/i18n/strings';
import type { AppLanguage } from '@/store/profile-store';
import type { Database } from '@/infrastructure/supabase/database.types';

export type AppNotification = Database['public']['Tables']['notifications']['Row'];
export function notificationCopy(notification: AppNotification, language: AppLanguage) {
  const data = (notification.data && typeof notification.data === 'object' ? notification.data : {}) as Record<string, unknown>;
  const values = { actor: typeof data.actorName === 'string' ? data.actorName : t(language, 'someone') };
  switch (notification.type) {
    case 'new_episode': return { title: t(language, 'newEpisodeTitle', { show: String(data.showTitle ?? 'Episode') }), body: t(language, 'newEpisodeBody', { season: Number(data.season ?? 1), episode: Number(data.episode ?? 1), title: String(data.episodeTitle ?? '') }) };
    case 'friend_request': return { title: t(language, 'friendRequestTitle'), body: t(language, 'friendRequestBody', values) };
    case 'friend_accepted': return { title: t(language, 'friendAcceptedTitle'), body: t(language, 'friendAcceptedBody', values) };
    case 'comment_reply': return { title: t(language, 'commentReplyTitle'), body: t(language, 'commentReplyBody', values) };
    case 'comment_like': return { title: t(language, 'commentLikeTitle'), body: t(language, 'commentLikeBody', values) };
    case 'watch_wheel_invite': return { title: t(language, data.kind === 'list' ? 'listInviteTitle' : 'wheelInviteTitle'), body: t(language, data.kind === 'list' ? 'listInviteBody' : 'wheelInviteBody', values) };
    default: return { title: notification.title, body: notification.body };
  }
}
