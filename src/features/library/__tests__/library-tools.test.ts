import { filterLibrary, libraryCsv } from '../library-tools';
import { LibraryItem } from '@/domain/media';
const items: LibraryItem[] = [
  { media: { id: 1, type: 'movie', title: 'İstanbul', year: '2024', genres: [], rating: 7, overview: '', posterUrl: '', backdropUrl: '' }, status: 'completed', updatedAt: '2026-10-28T00:00:00Z' },
  { media: { id: 1, type: 'tv', title: 'Show', year: '2026', genres: [], rating: 9, overview: '', posterUrl: '', backdropUrl: '' }, status: 'watching', updatedAt: '2026-10-29T00:00:00Z' },
];
const options = { status: 'all' as const, type: 'all' as const, query: '', sort: 'recent' as const, language: 'tr' as const };
it('searches Turkish titles with Turkish case folding', () => {
  expect(filterLibrary(items, [], { ...options, query: 'istanbul' })).toHaveLength(1);
});
it('combines status and media filters and sorts without mutating the store', () => {
  expect(filterLibrary(items, [], { ...options, status: 'completed', type: 'tv' })).toEqual([]);
  expect(filterLibrary(items, [], { ...options, sort: 'rating' })[0]?.media.title).toBe('Show');
  expect(items[0]?.media.title).toBe('İstanbul');
});
it('resolves favorites by both type and id', () => {
  expect(filterLibrary(items, [items[1]!.media], { ...options, status: 'favorites' })).toMatchObject([{ status: 'watching' }]);
});
it('escapes quotes, newlines and spreadsheet formulas in CSV exports', () => {
  const csv = libraryCsv([{ ...items[0]!, media: { ...items[0]!.media, title: '=HYPERLINK("x")\nLine' } }]);
  expect(csv).toContain('"\'=HYPERLINK(""x"")\nLine"');
  expect(csv).toContain('type,id,title,status,watched,total');
});
