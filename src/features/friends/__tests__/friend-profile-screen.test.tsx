import { act, fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import FriendProfileScreen from '../../../../app/profile/[id]';
import { fetchFriendActivity, fetchAcceptedFriendProfiles, type FriendActivity } from '../friends-repository';
import { useProfileStore } from '@/store/profile-store';
import { useLibraryStore } from '@/store/library-store';
import type { Media } from '@/domain/media';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({ id: 'bob' }), useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'alice' } }) }));
jest.mock('@/components/ProfileInsights', () => ({ ProfileInsights: () => null }));
jest.mock('@/components/WatchLevelBadge', () => ({ WatchLevelBadge: () => null }));
jest.mock('../friends-repository', () => ({ fetchFriendActivity: jest.fn(), fetchAcceptedFriendProfiles: jest.fn() }));
const movie: Media = { id: 1, type: 'movie', title: 'Movie', overview: '', genres: [], posterUrl: '', backdropUrl: '', rating: 8, year: '2020' };
const friend: FriendActivity = { profile: { id: 'bob', username: 'bob', firstName: 'Bob', lastName: 'Smith' }, historyVisible: true, library: [{ media: movie, status: 'completed' }], favorites: [], ratings: [], activities: [], episodeRuntimes: {}, watchedEpisodeCount: 0 };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}><FriendProfileScreen /></QueryClientProvider>);
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); useProfileStore.setState({ language: 'en', favorites: [] }); useLibraryStore.getState().clearUserData(); useLibraryStore.getState().upsert(movie, 'completed');
  jest.mocked(fetchFriendActivity).mockResolvedValue(friend); jest.mocked(fetchAcceptedFriendProfiles).mockResolvedValue([]);
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });

it.each(['tr', 'en'] as const)('opens the common list from the profile with a watched count in %s', async language => {
  useProfileStore.setState({ language });
  const screen = await mount();
  const link = await screen.findByRole('button', { name: language === 'en' ? 'Watched in common, 1 title' : 'Ortak izlediklerimiz, 1 yapım' });
  await fireEvent.press(link);
  expect(router.push).toHaveBeenCalledWith({ pathname: '/common-watched/[id]', params: { id: 'bob' } });
});
it('does not offer a common list for a private viewing history', async () => {
  jest.mocked(fetchFriendActivity).mockResolvedValue({ ...friend, historyVisible: false });
  const screen = await mount();
  await screen.findByText('This viewing history is private.');
  expect(screen.queryByRole('button', { name: /Watched in common/ })).toBeNull();
});
it('does not count a title that the viewer only saved', async () => {
  useLibraryStore.getState().upsert(movie, 'watchlist');
  const screen = await mount();
  expect(await screen.findByRole('button', { name: 'Watched in common, 0 titles' })).toBeTruthy();
});
