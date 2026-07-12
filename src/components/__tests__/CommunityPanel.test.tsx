import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommunityPanel } from '../CommunityPanel';
import { useCommunityStore } from '@/store/community-store';
import { CommunitySnapshot, fetchCommunitySnapshot, persistComment, softDeleteComment } from '@/features/community/community-repository';

const mockAuth = { user: { id: 'local-test' }, configured: true };
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('@/infrastructure/supabase/client', () => ({ isSupabaseConfigured: false, supabase: undefined, requireSupabase: jest.fn() }));
jest.mock('@/features/community/community-repository', () => ({
  fetchCommunitySnapshot: jest.fn(),
  persistComment: jest.fn(),
  persistRating: jest.fn(),
  softDeleteComment: jest.fn(),
}));

const snapshot: CommunitySnapshot = { comments: [], ratings: [] };
const mockedFetch = jest.mocked(fetchCommunitySnapshot);
const mockedPersist = jest.mocked(persistComment);
const mockedDelete = jest.mocked(softDeleteComment);

const renderPanel = async (component: React.ReactElement, seed?: { targetKey: string; value: CommunitySnapshot }) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  if (seed) client.setQueryData(['community', seed.targetKey], seed.value);
  return await render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
};

describe('CommunityPanel', () => {
  beforeEach(() => {
    useCommunityStore.setState({ comments: [], ratings: {}, deletedCommentIds: [] });
    mockedFetch.mockResolvedValue(snapshot);
    mockedPersist.mockResolvedValue();
    mockedDelete.mockResolvedValue();
  });

  it('renders and reacts to comment updates without a snapshot render loop', async () => {
    const screen = await renderPanel(<CommunityPanel targetKey="media:movie:1" canReview />);
    expect(await screen.findByText('Henüz yorum yok.')).toBeTruthy();

    await act(() => useCommunityStore.getState().addComment('media:movie:1', 'local-test', 'Ulaş', 'Çok iyi film.'));

    expect(screen.getByText('Çok iyi film.')).toBeTruthy();
    expect(screen.getByText('Ulaş')).toBeTruthy();
  });

  it('locks rating and comments when the target has not been watched', async () => {
    const screen = await renderPanel(<CommunityPanel targetKey="media:movie:2" canReview={false} />);

    expect(await screen.findByText('Puanlamak veya yorum yapmak için önce bu yapımı ya da bölümü izlemelisin.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Spoiler vermeden yorum yaz…')).toBeNull();
    fireEvent.press(screen.getByLabelText('8 puan ver'));
    expect(useCommunityStore.getState().ratings['media:movie:2']).toBeUndefined();
  });

  it('keeps a deleted server comment hidden while server synchronization is failing', async () => {
    const remoteComment = { id: 'comment-1', targetKey: 'media:movie:3', authorId: 'local-test', author: 'Ulaş', text: 'Silinecek yorum', createdAt: new Date().toISOString() };
    const remoteSnapshot = { comments: [remoteComment], ratings: [] };
    mockedFetch.mockResolvedValue(remoteSnapshot);
    mockedDelete.mockRejectedValue(new Error('offline'));
    let confirmDelete: (() => void) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => { confirmDelete = buttons?.find((button) => button.style === 'destructive')?.onPress; });
    const screen = await renderPanel(<CommunityPanel targetKey="media:movie:3" canReview />, { targetKey: 'media:movie:3', value: remoteSnapshot });
    expect(await screen.findByText('Silinecek yorum')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Yorumu sil'));
    await act(async () => { await confirmDelete?.(); });

    await waitFor(() => expect(screen.queryByText('Silinecek yorum')).toBeNull());
    expect(useCommunityStore.getState().deletedCommentIds).toContain('comment-1');
    alert.mockRestore();
  });

});
