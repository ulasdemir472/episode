import { normalizeTmdbPath } from '../../../supabase/functions/_shared/catalog-contract';
import { URLSearchParams as NativeSearchParams } from 'react-native-url-polyfill';
import { scheduleSeasonNumbers, ticketOutcome, deliveryRetry, dateInZone } from '../../../supabase/functions/_shared/episode-schedule';

it.each(['/movie/12?language=tr-TR', '/tv/12/recommendations?language=en-US&page=1', '/movie/12/recommendations', '/movie/12/watch/providers', '/tv/12/videos', '/movie/12/credits', '/tv/12/season/2', '/movie/12/external_ids', '/person/31?language=en-US', '/person/31/combined_credits?language=tr-TR'])('allows supported client endpoints: %s', (path) => {
  expect(() => normalizeTmdbPath(path)).not.toThrow();
});
it.each(['/account', '/movie/12/../account', 'https://example.com', '/movie/12?api_key=secret', '/person/31/changes', '/person/31?api_key=secret', '/person/31/../account'])('rejects unsupported paths and parameters: %s', (path) => {
  expect(() => normalizeTmdbPath(path)).toThrow();
});
it('canonicalizes query ordering for shared cache hits', () => {
  expect(normalizeTmdbPath('/search/multi?query=hello&language=tr-TR')).toBe(normalizeTmdbPath('/search/multi?language=tr-TR&query=hello'));
});
it('preserves search and every filter when the mobile URL polyfill has no size getter', () => {
  const Original = globalThis.URLSearchParams;
  globalThis.URLSearchParams = NativeSearchParams;
  try {
    const path = normalizeTmdbPath('/search/multi?query=%C3%A7%C4%B1lg%C4%B1n+film&language=tr-TR&page=2');
    expect(path).toContain('query=%C3%A7%C4%B1lg%C4%B1n+film');
    expect(path).toContain('page=2');
    const action = normalizeTmdbPath('/discover/movie?with_genres=28&vote_average.gte=6&primary_release_year=2025&page=3');
    const comedy = normalizeTmdbPath('/discover/movie?with_genres=35&vote_average.gte=6&primary_release_year=2025&page=3');
    expect(action).toContain('with_genres=28');
    expect(action).toContain('vote_average.gte=6');
    expect(action).toContain('primary_release_year=2025');
    expect(action).not.toBe(comedy);
  } finally { globalThis.URLSearchParams = Original; }
});
it('scans the ongoing season as well as a recently released full season', () => {
  expect(scheduleSeasonNumbers([{ season_number: 0, air_date: '2026-10-01' }, { season_number: 1, air_date: '2025-01-01' }, { season_number: 2, air_date: '2026-01-01' }, { season_number: 3, air_date: '2026-10-28' }, { season_number: 4, air_date: '2027-01-01' }], '2026-10-27', '2026-10-30')).toEqual([2, 3]);
});
it('distinguishes retryable, permanent and unregistered push errors', () => {
  expect(ticketOutcome({ status: 'ok', id: 'ticket-1' })).toEqual({ status: 'sent', ticketId: 'ticket-1' });
  expect(ticketOutcome({ status: 'error', details: { error: 'MessageRateExceeded' } })).toMatchObject({ status: 'pending', disableDevice: false });
  expect(ticketOutcome({ status: 'error', details: { error: 'DeviceNotRegistered' } })).toMatchObject({ status: 'failed', disableDevice: true });
});
it('backs off push retries and handles local date boundaries', () => {
  const now = new Date('2026-10-29T22:30:00Z');
  expect(deliveryRetry(1, now)).toBe('2026-10-29T22:31:00.000Z');
  expect(dateInZone(now, 'Europe/Istanbul')).toBe('2026-10-30');
  expect(dateInZone(now, 'America/New_York')).toBe('2026-10-29');
});
