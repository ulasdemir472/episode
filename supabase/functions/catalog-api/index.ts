import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { normalizeTmdbPath } from '../_shared/catalog-contract.ts';

type Service = 'tmdb' | 'omdb';
type RequestBody = { service?: Service; path?: string; params?: Record<string, string> };
type CachePolicy = { ttlSeconds: number; staleSeconds: number };

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const OMDB_BASE_URL = 'https://www.omdbapi.com/';
const OMDB_DAILY_SOFT_LIMIT = 950;
const REQUEST_TIMEOUT_MS = 15_000;

const policies = {
  tmdbSearch: { ttlSeconds: 60 * 60, staleSeconds: 24 * 60 * 60 },
  tmdbTrending: { ttlSeconds: 30 * 60, staleSeconds: 24 * 60 * 60 },
  tmdbDiscover: { ttlSeconds: 2 * 60 * 60, staleSeconds: 3 * 24 * 60 * 60 },
  tmdbSchedule: { ttlSeconds: 2 * 60 * 60, staleSeconds: 24 * 60 * 60 },
  tmdbDetails: { ttlSeconds: 24 * 60 * 60, staleSeconds: 7 * 24 * 60 * 60 },
  tmdbExternalIds: { ttlSeconds: 30 * 24 * 60 * 60, staleSeconds: 30 * 24 * 60 * 60 },
  omdb: { ttlSeconds: 7 * 24 * 60 * 60, staleSeconds: 30 * 24 * 60 * 60 },
} satisfies Record<string, CachePolicy>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(payload: unknown, status = 200, cache = 'MISS') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Episode-Cache': cache },
  });
}

function cachePolicy(service: Service, path = ''): CachePolicy {
  if (service === 'omdb') return policies.omdb;
  if (path.startsWith('/search/')) return policies.tmdbSearch;
  if (path.startsWith('/trending/')) return policies.tmdbTrending;
  if (path.startsWith('/discover/')) return policies.tmdbDiscover;
  if (path.endsWith('/external_ids')) return policies.tmdbExternalIds;
  if (/^\/tv\/\d+\?/.test(path)) return policies.tmdbSchedule;
  return policies.tmdbDetails;
}

function stableParams(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server configuration is missing' }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const service = body.service;
  if (service !== 'tmdb' && service !== 'omdb') return json({ error: 'Unsupported service' }, 400);

  let upstreamUrl: string;
  let cacheKey: string;
  let policy: CachePolicy;
  try {
    if (service === 'tmdb') {
      const path = normalizeTmdbPath(body.path ?? '');
      upstreamUrl = `${TMDB_BASE_URL}${path}`;
      cacheKey = `tmdb:${encodeURIComponent(path)}`;
      policy = cachePolicy(service, path);
    } else {
      const params = body.params ?? {};
      const allowedKeys = new Set(['i', 't', 'Season']);
      if (!Object.keys(params).length || Object.keys(params).some((key) => !allowedKeys.has(key) || typeof params[key] !== 'string' || params[key].length > 200)) throw new Error('Invalid OMDb parameters');
      const normalized = stableParams(params);
      cacheKey = `omdb:${normalized.toString()}`;
      const apiKey = Deno.env.get('OMDB_API_KEY');
      if (!apiKey) return json({ error: 'OMDb is not configured' }, 503);
      normalized.set('apikey', apiKey);
      upstreamUrl = `${OMDB_BASE_URL}?${normalized.toString()}`;
      policy = cachePolicy(service);
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid request' }, 400);
  }

  const now = new Date();
  const { data: cached } = await admin.from('external_api_cache').select('payload, expires_at, stale_until').eq('cache_key', cacheKey).maybeSingle();
  if (cached && new Date(cached.expires_at) > now) {
    await admin.rpc('increment_external_api_usage', { target_service: service, cache_hit_delta: 1 });
    return json(cached.payload, 200, 'HIT');
  }

  if (service === 'omdb') {
    const { data: reserved, error: reservationError } = await admin.rpc('reserve_external_api_request', {
      target_service: service,
      daily_limit: OMDB_DAILY_SOFT_LIMIT,
    });
    if (reservationError) return json({ error: 'Usage reservation failed' }, 500);
    if (!reserved) {
      if (cached && new Date(cached.stale_until) > now) {
        await admin.rpc('increment_external_api_usage', { target_service: service, stale_hit_delta: 1 });
        return json(cached.payload, 200, 'STALE-LIMIT');
      }
      return json({ error: 'OMDb daily safety limit reached' }, 429);
    }
  } else {
    await admin.rpc('increment_external_api_usage', { target_service: service, request_delta: 1 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (service === 'tmdb') {
      const token = Deno.env.get('TMDB_ACCESS_TOKEN');
      if (!token) return json({ error: 'TMDB is not configured' }, 503);
      headers.Authorization = `Bearer ${token}`;
    }
    const upstream = await fetch(upstreamUrl, { headers, signal: controller.signal });
    if (!upstream.ok) throw new Error(`${service} returned ${upstream.status}`);
    const payload = await upstream.json();
    const expiresAt = new Date(now.getTime() + policy.ttlSeconds * 1000);
    const staleUntil = new Date(expiresAt.getTime() + policy.staleSeconds * 1000);
    await admin.from('external_api_cache').upsert({
      cache_key: cacheKey,
      service,
      payload,
      status_code: upstream.status,
      expires_at: expiresAt.toISOString(),
      stale_until: staleUntil.toISOString(),
      updated_at: now.toISOString(),
    });
    if (Math.random() < 0.01) await admin.rpc('prune_external_api_cache');
    return json(payload, 200, 'MISS');
  } catch (error) {
    if (cached && new Date(cached.stale_until) > now) {
      await admin.rpc('increment_external_api_usage', { target_service: service, stale_hit_delta: 1, error_delta: 1 });
      return json(cached.payload, 200, 'STALE-ERROR');
    }
    return json({ error: error instanceof Error ? error.message : 'External API request failed' }, 502);
  } finally {
    clearTimeout(timeout);
  }
});
