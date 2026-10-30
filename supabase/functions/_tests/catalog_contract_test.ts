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
Deno.test('catalog allows person details and filmography without exposing arbitrary endpoints', () => {
  assert(normalizeTmdbPath('/person/31?language=en-US') === '/person/31?language=en-US', 'Person details rejected');
  assert(normalizeTmdbPath('/person/31/combined_credits?language=tr-TR') === '/person/31/combined_credits?language=tr-TR', 'Filmography rejected');
  for (const path of ['/person/31/changes', '/person/31?api_key=secret', '/person/31/../account']) {
    let rejected = false;
    try { normalizeTmdbPath(path); } catch { rejected = true; }
    assert(rejected, `Unsafe path was accepted: ${path}`);
  }
});
