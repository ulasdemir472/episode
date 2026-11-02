export const analyticsEvents = ['session_started', 'foreground', 'screen_view', 'search_submitted', 'media_detail_opened', 'library_item_added', 'episode_marked', 'comment_submitted', 'friend_request_sent', 'watch_wheel_spun', 'notification_opened', 'shared_list_used'] as const;
export type AnalyticsEventName = typeof analyticsEvents[number];
export type AnalyticsEvent = {
  id: string;
  name: AnalyticsEventName;
  occurred_at: string;
  session_id: string;
  platform: 'ios' | 'android' | 'web';
  seconds?: number;
};

// A strict allowlist prevents arbitrary event properties (search text, media,
// comments, URLs, tokens) from entering the analytics pipeline.
export function validateAnalyticsEvents(input: unknown, now = Date.now()): AnalyticsEvent[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 50) throw new Error('Invalid event batch');
  const keys = new Set(['id', 'name', 'occurred_at', 'session_id', 'platform', 'seconds']);
  return input.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid event');
    const event = item as Record<string, unknown>;
    if (Object.keys(event).some((key) => !keys.has(key))) throw new Error('Unsupported event property');
    for (const key of ['id', 'session_id']) if (typeof event[key] !== 'string' || !/^[a-zA-Z0-9_-]{12,80}$/.test(event[key] as string)) throw new Error('Invalid event identity');
    if (!analyticsEvents.includes(event.name as AnalyticsEventName) || !['ios', 'android', 'web'].includes(event.platform as string)) throw new Error('Invalid event type');
    const time = typeof event.occurred_at === 'string' ? Date.parse(event.occurred_at) : NaN;
    if (!Number.isFinite(time) || time < now - 7 * 86_400_000 || time > now + 300_000 || new Date(time).toISOString() !== event.occurred_at) throw new Error('Invalid event time');
    if (event.name === 'foreground') {
      if (!Number.isInteger(event.seconds) || Number(event.seconds) < 0 || Number(event.seconds) > 120) throw new Error('Invalid foreground duration');
    } else if (event.seconds !== undefined) throw new Error('Unexpected duration');
    return event as AnalyticsEvent;
  });
}
