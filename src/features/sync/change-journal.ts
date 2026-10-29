export type ChangeJournal = Record<string, string>;

export const revision = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function acknowledge(current: ChangeJournal, sent: ChangeJournal): ChangeJournal {
  return Object.fromEntries(Object.entries(current).filter(([key, value]) => sent[key] !== value));
}

export function changedKeys<T>(before: T[], after: T[], keyOf: (item: T) => string): string[] {
  const previous = new Map(before.map((item) => [keyOf(item), JSON.stringify(item)]));
  const next = new Map(after.map((item) => [keyOf(item), JSON.stringify(item)]));
  return [...new Set([...previous.keys(), ...next.keys()])].filter((key) => previous.get(key) !== next.get(key));
}
