export type ScheduleSeason = { season_number: number; air_date?: string | null };
export function scheduleSeasonNumbers(seasons: ScheduleSeason[], from: string, to: string): number[] {
  const ordered = seasons.filter((season) => season.season_number > 0 && season.air_date && season.air_date <= to).sort((left, right) => left.season_number - right.season_number);
  return ordered.filter((season, index) => season.air_date! >= from || !ordered[index + 1] || ordered[index + 1]!.air_date! >= from).map((season) => season.season_number);
}
export function dateInZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}-${parts.find((part) => part.type === 'day')!.value}`;
}
export const dayOffset = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000).toISOString().slice(0, 10);
export function deliveryRetry(attempts: number, now: Date): string { return new Date(now.getTime() + Math.min(3600, 30 * 2 ** attempts) * 1000).toISOString(); }
export function ticketOutcome(ticket: { status: string; id?: string; message?: string; details?: { error?: string } }) {
  if (ticket.status === 'ok' && ticket.id) return { status: 'sent' as const, ticketId: ticket.id };
  const error = ticket.details?.error ?? ticket.message ?? 'Invalid push response';
  return { status: error === 'MessageRateExceeded' ? 'pending' as const : 'failed' as const, error, disableDevice: error === 'DeviceNotRegistered' };
}
