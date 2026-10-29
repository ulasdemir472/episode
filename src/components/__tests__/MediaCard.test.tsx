import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { MediaCard } from '../MediaCard';
import { useCommunityStore } from '@/store/community-store';
import { Media } from '@/domain/media';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';

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
  beforeEach(() => {
    jest.clearAllMocks();
    useCommunityStore.setState({ comments: [], ratings: {} });
    useLibraryStore.getState().clearUserData();
    useProfileStore.setState({ language: 'tr' });
  });

  it('shows the personal rating without opening details', async () => {
    useLibraryStore.getState().upsert(movie, 'completed');
    useCommunityStore.setState({ ratings: { 'media:movie:42': 9 } });
    const screen = await render(<MediaCard media={movie} />);

    expect(screen.getByText('Sen 9/10')).toBeTruthy();
    expect(screen.getByText('İzlendi')).toBeTruthy();
  });

  it.each(['tr', 'en'] as const)('shows an accessible watched badge in %s without opening details', async (language) => {
    useProfileStore.setState({ language });
    useLibraryStore.getState().upsert(movie, 'completed');
    const screen = await render(<MediaCard media={movie} inGrid />);
    const label = language === 'en' ? 'Watched' : 'İzlendi';

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole('button', { name: `Test Filmi ${language === 'en' ? 'details' : 'detayını aç'}, ${label}` })).toBeTruthy();
    expect(screen.queryByText(language === 'en' ? 'İzlendi' : 'Watched')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each(['watchlist', 'watching', 'dropped'] as const)('does not label a %s title as watched', async (status) => {
    useLibraryStore.getState().upsert(movie, status);
    const screen = await render(<MediaCard media={movie} />);
    expect(screen.queryByText('İzlendi')).toBeNull();
  });

  it('does not label a title outside the library as watched', async () => {
    const screen = await render(<MediaCard media={movie} />);
    expect(screen.queryByText('İzlendi')).toBeNull();
  });

  it('updates the badge when completion is set, undone or the title is removed', async () => {
    const screen = await render(<MediaCard media={movie} />);
    await act(() => useLibraryStore.getState().upsert(movie, 'completed'));
    expect(screen.getByText('İzlendi')).toBeTruthy();
    await act(() => useLibraryStore.getState().upsert(movie, 'watchlist'));
    expect(screen.queryByText('İzlendi')).toBeNull();
    await act(() => useLibraryStore.getState().upsert(movie, 'completed'));
    expect(screen.getByText('İzlendi')).toBeTruthy();
    await act(() => useLibraryStore.getState().remove(movie));
    expect(screen.queryByText('İzlendi')).toBeNull();
  });

  it('distinguishes a movie from a watched show with the same numeric ID', async () => {
    useLibraryStore.getState().upsert({ ...movie, type: 'tv' }, 'completed');
    const screen = await render(<MediaCard media={movie} />);
    expect(screen.queryByText('İzlendi')).toBeNull();
  });

  it('updates a mounted card when the language changes', async () => {
    useLibraryStore.getState().upsert(movie, 'completed');
    const screen = await render(<MediaCard media={movie} />);
    await act(() => useProfileStore.getState().setLanguage('en'));
    expect(screen.getByText('Watched')).toBeTruthy();
    expect(screen.queryByText('İzlendi')).toBeNull();
  });

  it('removes another account’s watched badge when accounts change', async () => {
    useLibraryStore.getState().bindUser('alice');
    useLibraryStore.getState().upsert(movie, 'completed');
    const screen = await render(<MediaCard media={movie} />);
    expect(screen.getByText('İzlendi')).toBeTruthy();
    await act(() => useLibraryStore.getState().bindUser('bob'));
    expect(screen.queryByText('İzlendi')).toBeNull();
  });

  it('shows completion for a show only after the last episode is marked and removes it on undo', async () => {
    const show: Media = { ...movie, type: 'tv' };
    const seasons = [{ id: 1, number: 1, name: 'Season 1', episodeCount: 2 }];
    useLibraryStore.getState().toggleEpisode(show, 1, 1, seasons);
    const screen = await render(<MediaCard media={show} />);
    expect(screen.queryByText('İzlendi')).toBeNull();
    expect(screen.getByText('Kaldığın yer · S1 B2')).toBeTruthy();
    await act(() => useLibraryStore.getState().toggleEpisode(show, 1, 2, seasons));
    expect(screen.getByText('İzlendi')).toBeTruthy();
    await act(() => useLibraryStore.getState().toggleEpisode(show, 1, 2, seasons));
    expect(screen.queryByText('İzlendi')).toBeNull();
  });

  it('keeps watched cards navigable to their details', async () => {
    useLibraryStore.getState().upsert(movie, 'completed');
    const screen = await render(<MediaCard media={movie} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/media/[id]', params: { id: '42', data: JSON.stringify(movie) } });
  });
});
