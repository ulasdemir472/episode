import { act, fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import CommonWatchedScreen from '../../../../app/common-watched/[id]';
import { fetchFriendActivity, type FriendActivity } from '../friends-repository';
import { useProfileStore } from '@/store/profile-store';
import { useLibraryStore } from '@/store/library-store';
import type { Media } from '@/domain/media';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({ id: 'bob' }), useFocusEffect: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'alice' } }) }));
jest.mock('../friends-repository', () => ({ fetchFriendActivity: jest.fn() }));
const movie: Media = { id: 1, type: 'movie', title: 'Common movie', overview: '', genres: [], posterUrl: '', backdropUrl: '', year: '2020', rating: 8 };
const show: Media = { ...movie, type: 'tv', title: 'Common show' };
const privateTitle: Media = { ...movie, id: 9, title: 'Only Bob watched' };
export const friend: FriendActivity = { profile: { id: 'bob', username: 'bob', firstName: 'Bob', lastName: 'Smith' }, historyVisible: true, library: [{ media: movie, status: 'completed' }, { media: show, status: 'watching', progress: { watched: 4, total: 20 } }, { media: privateTitle, status: 'completed' }], favorites: [], ratings: [], activities: [], watchedEpisodeCount: 4, episodeRuntimes: {} };
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const mount = (client = newClient()) => render(<QueryClientProvider client={client}><CommonWatchedScreen /></QueryClientProvider>);
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); useProfileStore.setState({ language: 'en' }); useLibraryStore.getState().clearUserData();
  useLibraryStore.setState({ items: [{ media: movie, status: 'completed' }, { media: show, status: 'watching', progress: { watched: 2, total: 20 } }] });
  jest.mocked(fetchFriendActivity).mockResolvedValue(friend);
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });

it.each(['tr', 'en'] as const)('shows, searches and filters mutual viewing history in %s', async language => {
  useProfileStore.setState({ language });
  const en = language === 'en';
  const screen = await mount();
  expect(await screen.findByText('Common movie')).toBeTruthy();
  expect(screen.getByText('Common show')).toBeTruthy();
  expect(screen.queryByText('Only Bob watched')).toBeNull();
  expect(fetchFriendActivity).toHaveBeenCalledWith('alice', 'bob');
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(en ? '^Content:' : '^İçerik:') }));
  await fireEvent.press(screen.getByRole('radio', { name: en ? 'Shows' : 'Diziler' }));
  expect(screen.queryByText('Common movie')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /Common show/ }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/media/[id]', params: { id: '1', data: JSON.stringify(show) } });
  await fireEvent.changeText(screen.getByLabelText(en ? 'Search common titles' : 'Ortak izlediklerinde ara'), 'missing');
  expect(screen.getByText(en ? 'No titles match these filters.' : 'Bu filtrelerle eşleşen yapım yok.')).toBeTruthy();
});
it.each(['tr', 'en'] as const)('does not reveal titles when viewing history is private in %s', async language => {
  useProfileStore.setState({ language });
  jest.mocked(fetchFriendActivity).mockResolvedValue({ ...friend, historyVisible: false });
  const screen = await mount();
  expect(await screen.findByText(language === 'en' ? 'This viewing history is private.' : 'Bu izleme geçmişi gizli.')).toBeTruthy();
  expect(screen.queryByText('Common movie')).toBeNull();
  expect(screen.queryByText('Common show')).toBeNull();
});
it('reacts to changes in the viewers watched status', async () => {
  const screen = await mount();
  await screen.findByText('Common movie');
  await act(async () => { useLibraryStore.getState().upsert(movie, 'watchlist'); });
  expect(screen.queryByText('Common movie')).toBeNull();
  expect(screen.getByText('Common show')).toBeTruthy();
});
it('explains an empty shared history', async () => {
  useLibraryStore.getState().clearUserData();
  const screen = await mount();
  expect(await screen.findByText('You have no watched titles in common yet.')).toBeTruthy();
});
it('hides cached history when a refresh fails and supports retry', async () => {
  const client = newClient();
  client.setQueryData(['friend-profile', 'alice', 'bob'], friend);
  jest.mocked(fetchFriendActivity).mockRejectedValue(new Error('access revoked'));
  const screen = await mount(client);
  expect(await screen.findByText('Could not load common titles.')).toBeTruthy();
  expect(screen.queryByText('Common movie')).toBeNull();
  jest.mocked(fetchFriendActivity).mockResolvedValue(friend);
  await fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByText('Common movie')).toBeTruthy();
});
