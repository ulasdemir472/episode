import { notificationRoute } from '../notification-routing';
import { notificationCopy, AppNotification } from '../notification-copy';
import { translations, t } from '@/i18n/strings';

it('opens episode notifications using an independently loadable media identity', () => {
  expect(notificationRoute({ route: '/media/12', targetKey: 'episode:12:2:3' })).toBe('/media/12?type=tv&targetKey=episode%3A12%3A2%3A3&season=2&episode=3');
  expect(notificationRoute({ targetKey: 'media:movie:12' })).toBe('/media/12?type=movie&targetKey=media%3Amovie%3A12');
});
it.each([null, {}, { route: 'https://evil.example' }, { route: '/reset-password' }, { route: '/media/12' }, { route: '/profile/../auth' }])('rejects unsupported notification destinations: %j', (payload) => {
  expect(notificationRoute(payload)).toBe('/notifications');
});
it('has a complete Turkish and English dictionary', () => {
  expect(Object.keys(translations.tr).sort()).toEqual(Object.keys(translations.en).sort());
  for (const language of ['tr', 'en'] as const) expect(t(language, 'newEpisodeBody', { season: 2, episode: 3, title: 'Finale' })).not.toMatch(/\{/);
});
it.each(['tr', 'en'] as const)('localizes stored episode notifications in the selected language: %s', (language) => {
  const item: AppNotification = { id: 'notification-1', user_id: 'alice', actor_id: null, title: '', body: '', created_at: '2026-10-29T09:00:00Z', read_at: null, type: 'new_episode', data: { showTitle: 'Show', season: 2, episode: 3, episodeTitle: 'Finale' } };
  const copy = notificationCopy(item, language);
  expect(copy.title).toBe(language === 'en' ? 'Show · New episode' : 'Show · Yeni bölüm');
  expect(copy.body).toBe(language === 'en' ? 'S2 E3 · Finale' : 'S2 B3 · Finale');
});
