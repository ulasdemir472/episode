import { AnalyticsClient } from '../analytics-client';
import { AnalyticsEvent, validateAnalyticsEvents } from '@/domain/analytics';

function setup() {
  let clock = Date.parse('2026-11-02T10:00:00Z'); let sequence = 0;
  const data = new Map<string, string>();
  const send = jest.fn<Promise<void>, [string, AnalyticsEvent[]]>(async () => undefined);
  const storage = { getItem: async (key: string) => data.get(key) ?? null, setItem: async (key: string, value: string) => { data.set(key,value); } };
  const client = new AnalyticsClient({ storage, send, platform: 'ios', now: () => clock, monotonic: () => clock, id: () => `event_identity_${++sequence}` });
  return { client, send, data, advance: (milliseconds: number) => { clock += milliseconds; } };
}
it('collects nothing before consent and excludes background time', async () => {
  const { client, send, advance } = setup();
  await client.bind('alice'); client.setForeground(true); client.track('search_submitted'); await client.flush();
  expect(send).not.toHaveBeenCalled();
  client.setEnabled(true); advance(60_000); client.setForeground(false); advance(3_600_000); client.heartbeat(); await client.flush();
  const events = send.mock.calls[0]![1];
  expect(events.filter((event) => event.name==='foreground').reduce((sum,event) => sum+(event.seconds ?? 0),0)).toBe(60);
  expect(events.filter((event) => event.name==='session_started')).toHaveLength(1);
});
it('retries the same IDs and preserves edits queued while a send is in flight', async () => {
  const { client, send } = setup();
  await client.bind('alice'); client.setEnabled(true); client.setForeground(true);
  send.mockRejectedValueOnce(new Error('offline')); await client.flush();
  const ids = send.mock.calls[0]![1].map((event) => event.id);
  let finish!: () => void; send.mockImplementationOnce(() => new Promise((resolve) => { finish=resolve; }));
  const pending=client.flush(); client.track('episode_marked'); finish(); await pending; await client.flush();
  expect(send.mock.calls[1]![1].map((event) => event.id)).toEqual(ids);
  expect(send.mock.calls[2]![1].map((event) => event.name)).toEqual(['episode_marked']);
});
it('does not send one account queue as another account or after opt-out', async () => {
  const { client, send }=setup();
  await client.bind('alice'); client.setEnabled(true); client.setForeground(true); client.track('search_submitted');
  await client.bind('bob'); client.setEnabled(true); client.setForeground(true); client.track('watch_wheel_spun'); await client.flush();
  expect(send.mock.calls[0]![0]).toBe('bob');
  expect(send.mock.calls[0]![1].some((event) => event.name==='search_submitted')).toBe(false);
  client.track('episode_marked'); client.setEnabled(false); await client.flush();
  expect(send).toHaveBeenCalledTimes(1);
});
it('validates the allowlist and rejects raw private properties', () => {
  const event={ id:'valid_identity_1',session_id:'valid_session_1',name:'search_submitted',platform:'ios',occurred_at:new Date().toISOString() };
  expect(validateAnalyticsEvents([event])).toHaveLength(1);
  expect(() => validateAnalyticsEvents([{...event,query:'private search'}])).toThrow();
  expect(() => validateAnalyticsEvents([{...event,name:'foreground',seconds:99999}])).toThrow();
  expect(() => validateAnalyticsEvents([{...event,occurred_at:'2020-01-01T00:00:00Z'}])).toThrow();
});
