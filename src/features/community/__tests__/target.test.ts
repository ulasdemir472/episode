import { parseReviewTarget } from '../target';

describe('parseReviewTarget', () => {
  it('parses media and episode targets', () => {
    expect(parseReviewTarget('media:movie:42')).toMatchObject({ targetType: 'media', mediaType: 'movie', mediaId: 42 });
    expect(parseReviewTarget('episode:99:2:5')).toMatchObject({ targetType: 'episode', mediaType: 'tv', mediaId: 99, seasonNumber: 2, episodeNumber: 5 });
  });

  it('rejects malformed targets', () => {
    expect(parseReviewTarget('media:person:1')).toBeUndefined();
    expect(parseReviewTarget('episode:1:0:2')).toBeUndefined();
  });
});
