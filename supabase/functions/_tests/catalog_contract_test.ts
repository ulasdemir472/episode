import { normalizeTmdbPath } from '../_shared/catalog-contract.ts';
function assert(value: boolean, message: string) { if (!value) throw new Error(message); }
Deno.test('catalog preserves search, paging and distinct discovery filters at the server boundary', () => {
  const search = normalizeTmdbPath('/search/multi?query=Breaking%20Bad&language=tr-TR&page=2');
  const params = new URLSearchParams(search.split('?')[1]);
  assert(params.get('query') === 'Breaking Bad' && params.get('page') === '2', 'Search query or page was lost');
  const action = normalizeTmdbPath('/discover/movie?with_genres=28&vote_average.gte=6.5');
  const comedy = normalizeTmdbPath('/discover/movie?with_genres=35&vote_average.gte=6.5');
  assert(action !== comedy && action.includes('vote_average.gte=6.5'), 'Filters share a cache key');
});
