import { act, render } from '@testing-library/react-native';
import { CommunityPanel } from '../CommunityPanel';
import { useCommunityStore } from '@/store/community-store';

describe('CommunityPanel', () => {
  beforeEach(() => {
    useCommunityStore.setState({ comments: [], ratings: {} });
  });

  it('renders and reacts to comment updates without a snapshot render loop', async () => {
    const screen = await render(<CommunityPanel targetKey="media:movie:1" />);
    expect(screen.getByText('Henüz yorum yok.')).toBeTruthy();

    await act(() => useCommunityStore.getState().addComment('media:movie:1', 'Ulaş', 'Çok iyi film.'));

    expect(screen.getByText('Çok iyi film.')).toBeTruthy();
    expect(screen.getByText('Ulaş')).toBeTruthy();
  });
});
