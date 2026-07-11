import { render } from '@testing-library/react-native';
import { MediaCard } from '../MediaCard';
import { useCommunityStore } from '@/store/community-store';
import { Media } from '@/domain/media';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const movie: Media = {
  id: 42,
  type: 'movie',
  title: 'Test Filmi',
  overview: '',
  posterUrl: 'https://example.com/poster.jpg',
  backdropUrl: '',
  year: '2026',
  rating: 7.4,
  genres: ['Drama'],
};

describe('MediaCard', () => {
  beforeEach(() => useCommunityStore.setState({ comments: [], ratings: {} }));

  it('shows the personal rating without opening details', async () => {
    useCommunityStore.setState({ ratings: { 'media:movie:42': 9 } });
    const screen = await render(<MediaCard media={movie} />);

    expect(screen.getByText('Sen 9/10')).toBeTruthy();
  });
});
