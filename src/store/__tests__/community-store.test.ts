import { useCommunityStore } from '../community-store';

describe('community store deletion lifecycle', () => {
  beforeEach(() => useCommunityStore.setState({ comments: [], ratings: {}, deletedCommentIds: [] }));

  it('creates trimmed comments with a stable UUID', () => {
    const comment = useCommunityStore.getState().addComment('media:movie:1', 'user-1', ' Ulaş ', ' Güzel film ');
    expect(comment).toMatchObject({ author: 'Ulaş', text: 'Güzel film' });
    expect(comment.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps reply and image metadata for social comment synchronization', () => {
    const comment = useCommunityStore.getState().addComment('media:movie:1', 'user-1', 'Ulaş', 'Yanıt', { parentCommentId: 'parent-1', imageUrl: 'https://example.com/photo.jpg' });
    expect(comment).toMatchObject({ parentCommentId: 'parent-1', imageUrl: 'https://example.com/photo.jpg', likeCount: 0, likedByMe: false });
  });

  it('records a deletion tombstone so a stale server snapshot cannot resurrect the comment', () => {
    const comment = useCommunityStore.getState().addComment('media:movie:1', 'user-1', 'Ulaş', 'Silinecek');
    useCommunityStore.getState().removeComment(comment.id);
    expect(useCommunityStore.getState().comments).toHaveLength(0);
    expect(useCommunityStore.getState().deletedCommentIds).toEqual([comment.id]);
  });

  it('discards a rejected duplicate without creating a server-deletion tombstone', () => {
    const comment = useCommunityStore.getState().addComment('media:movie:1', 'user-1', 'Ulaş', 'Tekrar');
    useCommunityStore.getState().discardComment(comment.id);
    expect(useCommunityStore.getState().comments).toHaveLength(0);
    expect(useCommunityStore.getState().deletedCommentIds).toHaveLength(0);
  });

  it('clears the tombstone only after server deletion is acknowledged', () => {
    useCommunityStore.setState({ deletedCommentIds: ['comment-1'] });
    useCommunityStore.getState().acknowledgeCommentDeletion('comment-1');
    expect(useCommunityStore.getState().deletedCommentIds).toEqual([]);
  });

  it('clamps personal ratings to the one-to-ten business range', () => {
    useCommunityStore.getState().rate('media:movie:1', 99);
    expect(useCommunityStore.getState().ratings['media:movie:1']).toBe(10);
  });
});
