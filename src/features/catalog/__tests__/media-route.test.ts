import { mediaIdentity, parseMediaSnapshot } from '../media-route';
it('loads a media identity without a serialized snapshot', () => {
  expect(mediaIdentity({ id: '12', type: 'movie' })).toEqual({ id: 12, type: 'movie' });
  expect(mediaIdentity({ id: '12', targetKey: 'episode:12:2:3' })).toEqual({ id: 12, type: 'tv' });
});
it.each([{ id: 'bad', type: 'movie' }, { id: '-1', type: 'tv' }, { id: '12' }, { id: '12', type: 'person' }])('rejects invalid standalone routes: %j', (params) => {
  expect(mediaIdentity(params)).toBeUndefined();
});
it('rejects malformed snapshots and preserves valid legacy links', () => {
  expect(parseMediaSnapshot('{')).toBeUndefined();
  expect(mediaIdentity({ data: JSON.stringify({ id: 12, type: 'movie', title: 'Movie' }) })).toEqual({ id: 12, type: 'movie' });
});
