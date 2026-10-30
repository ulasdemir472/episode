const endpoints = [
  /^\/trending\/all\/week$/, /^\/search\/multi$/, /^\/discover\/(movie|tv)$/,
  /^\/(movie|tv)\/\d+$/, /^\/tv\/\d+\/season\/\d+$/,
  /^\/(movie|tv)\/\d+\/(external_ids|recommendations|credits|videos|watch\/providers)$/,
  /^\/person\/\d+$/, /^\/person\/\d+\/combined_credits$/,
];

export function normalizeTmdbPath(path: string): string {
  if (!path.startsWith('/') || path.length > 500 || path.includes('://') || path.includes('..')) throw new Error('Invalid TMDB path');
  const [pathname, query = ''] = path.split('?');
  if (!endpoints.some((pattern) => pattern.test(pathname!))) throw new Error('TMDB endpoint is not allowed');
  const params = new URLSearchParams(query);
  const allowed = new Set(['language', 'query', 'page', 'sort_by', 'with_genres', 'vote_average.gte', 'vote_count.gte', 'primary_release_year', 'first_air_date_year', 'include_adult']);
  for (const key of params.keys()) if (!allowed.has(key)) throw new Error('TMDB parameter is not allowed');
  params.sort();
  // React Native's URL polyfill does not expose URLSearchParams.size on every runtime.
  // Inspect the serialized value so search, paging and discovery filters survive on devices.
  const serialized = params.toString();
  return `${pathname}${serialized ? `?${serialized}` : ''}`;
}
