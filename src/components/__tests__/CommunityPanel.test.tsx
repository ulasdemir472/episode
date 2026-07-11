import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommunityPanel } from '../CommunityPanel';
import { useCommunityStore } from '@/store/community-store';

const mockAuth = { user: { id: 'local-test' }, configured: true };
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => mockAuth }));
jest.mock('@/infrastructure/supabase/client', () => ({ isSupabaseConfigured: false, requireSupabase: jest.fn() }));

const renderPanel = (component: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })}>{component}</QueryClientProvider>);

describe('CommunityPanel', () => {
  beforeEach(() => {
    useCommunityStore.setState({ comments: [], ratings: {} });
  });

  it('renders and reacts to comment updates without a snapshot render loop', async () => {
    const screen = await renderPanel(<CommunityPanel targetKey="media:movie:1" canReview />);
    expect(screen.getByText('Henüz yorum yok.')).toBeTruthy();

    await act(() => useCommunityStore.getState().addComment('media:movie:1', 'local-test', 'Ulaş', 'Çok iyi film.'));

    expect(screen.getByText('Çok iyi film.')).toBeTruthy();
    expect(screen.getByText('Ulaş')).toBeTruthy();
  });

  it('locks the composer when the user has not watched the target', async () => {
    const screen = await renderPanel(<CommunityPanel targetKey="media:movie:2" canReview={false} />);

    expect(screen.getByText('Puanlamak veya yorum yapmak için önce bu yapımı ya da bölümü izlemelisin.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Spoiler vermeden yorum yaz…')).toBeNull();
    await fireEvent.press(screen.getByLabelText('8 puan ver'));
    expect(useCommunityStore.getState().ratings['media:movie:2']).toBeUndefined();
  });

  it('deletes a local comment after confirmation', async () => {
    useCommunityStore.setState({ comments: [{ id: 'comment-1', targetKey: 'media:movie:3', author: 'Ulaş', text: 'Silinecek yorum', createdAt: new Date().toISOString() }] });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => buttons?.find((button) => button.style === 'destructive')?.onPress?.());
    const screen = await renderPanel(<CommunityPanel targetKey="media:movie:3" canReview />);

    await fireEvent.press(screen.getByLabelText('Yorumu sil'));

    expect(screen.queryByText('Silinecek yorum')).toBeNull();
    alert.mockRestore();
  });
});
