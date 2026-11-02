import { AnalyticsEvent, AnalyticsEventName, validateAnalyticsEvents } from '@/domain/analytics';

type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
type Dependencies = { storage: Storage; send: (userId: string, events: AnalyticsEvent[]) => Promise<void>; platform: AnalyticsEvent['platform']; now?: () => number; monotonic?: () => number; id?: () => string };
export class AnalyticsClient {
  private owner?: string;
  private generation = 0;
  private enabled = false;
  private foreground = false;
  private segment?: number;
  private lastActivity = 0;
  private session?: string;
  private queue: AnalyticsEvent[] = [];
  private inFlight = false;
  private writes: Promise<void> = Promise.resolve();
  private now: () => number;
  private monotonic: () => number;
  private id: () => string;
  constructor(private dependencies: Dependencies) {
    this.now = dependencies.now ?? Date.now;
    this.monotonic = dependencies.monotonic ?? (() => performance.now());
    this.id = dependencies.id ?? (() => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2).padEnd(12, '0')}_${Math.random().toString(36).slice(2).padEnd(12, '0')}`);
  }
  async bind(userId?: string) {
    if (this.owner && this.owner !== userId) { this.queue = []; this.persist(); }
    const generation = ++this.generation;
    this.owner = userId; this.enabled = false; this.foreground = false; this.segment = undefined; this.session = undefined; this.queue = []; this.lastActivity = 0;
    if (!userId) return;
    const raw = await this.dependencies.storage.getItem(this.key(userId)).catch(() => null);
    if (generation !== this.generation || !raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length > 100) return;
      const recent = parsed.filter((event: AnalyticsEvent) => event && Date.parse(event.occurred_at) >= this.now() - 7 * 86_400_000);
      this.queue = recent.flatMap((event: AnalyticsEvent) => { try { return validateAnalyticsEvents([event], this.now()); } catch { return []; } });
    } catch { /* Analytics storage failure never affects library data. */ }
  }
  setEnabled(enabled: boolean) {
    if (this.enabled === enabled && enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.generation += 1; this.queue = []; this.session = undefined; this.segment = undefined; this.persist();
    } else if (this.foreground) this.beginSegment();
  }
  setForeground(active: boolean) {
    if (!active) this.heartbeat();
    this.foreground = active;
    if (!active) this.segment = undefined;
    else if (this.enabled && this.segment === undefined) this.beginSegment();
  }
  private beginSegment() {
    if (!this.session || this.now() - this.lastActivity > 30 * 60_000) {
      this.session = this.id(); this.enqueue('session_started');
    }
    this.segment = this.monotonic(); this.enqueue('foreground', 0);
  }
  heartbeat() {
    if (!this.enabled || !this.foreground || this.segment === undefined) return;
    const end = this.monotonic();
    this.enqueue('foreground', Math.min(120, Math.max(0, Math.floor((end - this.segment) / 1000))));
    this.segment = end;
  }
  track(name: AnalyticsEventName) {
    if (!this.enabled || !this.foreground || !this.session || name === 'foreground' || name === 'session_started') return;
    this.enqueue(name);
  }
  private enqueue(name: AnalyticsEventName, seconds?: number) {
    if (!this.owner || !this.enabled || !this.session) return;
    this.queue.push({ id: this.id(), session_id: this.session, name, occurred_at: new Date(this.now()).toISOString(), platform: this.dependencies.platform, ...(seconds === undefined ? {} : { seconds }) });
    this.queue = this.queue.slice(-100); this.lastActivity = this.now(); this.persist();
  }
  private key(userId: string) { return `episode.analytics.queue.${userId}`; }
  private persist() {
    const userId = this.owner; if (!userId) return;
    const value = JSON.stringify(this.queue);
    this.writes = this.writes.then(() => this.dependencies.storage.setItem(this.key(userId), value)).catch(() => undefined);
  }
  async flush() {
    if (!this.owner || !this.enabled || this.inFlight || !this.queue.length) return;
    const owner = this.owner; const generation = this.generation; const batch = this.queue.slice(0, 50);
    this.inFlight = true;
    try {
      await this.dependencies.send(owner, batch);
      if (this.owner !== owner || generation !== this.generation) return;
      const acknowledged = new Set(batch.map((event) => event.id));
      this.queue = this.queue.filter((event) => !acknowledged.has(event.id)); this.persist();
    } catch { /* Preserve event IDs for a later retry. */ }
    finally { this.inFlight = false; }
  }
}
