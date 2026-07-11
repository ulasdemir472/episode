import { act, render } from '@testing-library/react-native';
import { CommunityPanel } from '../CommunityPanel';
import { useCommunityStore } from '@/store/community-store';

describe('CommunityPanel', () => {
  beforeEach(() => {
    useCommunityStore.setState({ comments: [], ratings: {} });
  });

  it('renders and reacts to comment updates without a snapshot render loop', async () => {
    const screen = await render(<CommunityPanel targetKey="media:movie:1" canComment />);
    expect(screen.getByText('Henüz yorum yok.')).toBeTruthy();

    await act(() => useCommunityStore.getState().addComment('media:movie:1', 'Ulaş', 'Çok iyi film.'));

    expect(screen.getByText('Çok iyi film.')).toBeTruthy();
    expect(screen.getByText('Ulaş')).toBeTruthy();
  });

  it('locks the composer when the user has not watched the target', async () => {
    const screen = await render(<CommunityPanel targetKey="media:movie:2" canComment={false} />);

    expect(screen.getByText('Yorum yapmak için önce bu yapımı veya bölümü izlemelisin.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Spoiler vermeden yorum yaz…')).toBeNull();
  });
});
