import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WatchWheelScreen from '../../../../app/watch-wheel';
import * as repository from '../watch-wheel-repository';
import { fetchFriendships } from '@/features/friends/friends-repository';
import { catalogService } from '@/services/tmdb';
import { useProfileStore } from '@/store/profile-store';
import type { Media } from '@/domain/media';

let mockParams: { id?: string } = {};
let mockFocus: () => (() => void) | void;
let mockBlur: (() => void) | void;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => (() => void) | void) => {
    mockFocus = callback;
    jest.requireActual('react').useEffect(() => { mockBlur = callback(); return mockBlur; }, [callback]);
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'alice' } }) }));
jest.mock('@/infrastructure/supabase/client', () => ({ supabase: undefined }));
jest.mock('../watch-wheel-repository', () => ({ fetchWatchWheels: jest.fn(), fetchWheelEntries: jest.fn(), createWatchWheel: jest.fn(), addWheelEntry: jest.fn(), removeWheelEntry: jest.fn(), spinWatchWheel: jest.fn() }));
jest.mock('@/features/friends/friends-repository', () => ({ fetchFriendships: jest.fn() }));
jest.mock('@/services/tmdb', () => ({ catalogService: { search: jest.fn() } }));
const movie: Media = { id: 42, type: 'movie', title: 'Old movie', overview: '', genres: [], year: '2010', rating: 8, posterUrl: '', backdropUrl: '' };
const oldRoom = { id: 'old-room', ownerId: 'alice', title: 'Old room', result: movie, createdAt: '2026-10-01' };
const newRoom = { ...oldRoom, id: 'new-room', result: undefined };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })}><WatchWheelScreen /></QueryClientProvider>);
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockParams = {}; useProfileStore.setState({ language: 'en' });
  jest.mocked(repository.fetchWatchWheels).mockResolvedValue([oldRoom]);
  jest.mocked(repository.fetchWheelEntries).mockImplementation(async id => id === oldRoom.id ? [{ id: 'entry', wheelId: id, addedBy: 'alice', media: movie, watched: false, createdAt: '' }] : []);
  jest.mocked(fetchFriendships).mockResolvedValue([]);
  jest.mocked(catalogService.search).mockResolvedValue([]);
  jest.mocked(repository.createWatchWheel).mockImplementation(async () => { jest.mocked(repository.fetchWatchWheels).mockResolvedValue([newRoom, oldRoom]); return newRoom.id; });
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });

it.each(['tr', 'en'] as const)('starts a fresh session instead of reopening old titles in %s', async language => {
  useProfileStore.setState({ language });
  const screen = await mount();
  await screen.findByText(language === 'en' ? 'Create a movie night room' : 'Film gecesi odası kur');
  expect(screen.queryByText('Old movie')).toBeNull();
  expect(repository.fetchWheelEntries).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText(language === 'en' ? 'Create room' : 'Odayı kur'));
  await screen.findByText(language === 'en' ? 'No titles yet. Be the first to add one!' : 'Henüz film yok. İlk seçeneği sen ekle!');
  await waitFor(() => expect(repository.fetchWheelEntries).toHaveBeenCalledWith(newRoom.id));
  await act(async () => { mockBlur?.(); mockBlur = mockFocus(); });
  expect(await screen.findByText(language === 'en' ? 'Create a movie night room' : 'Film gecesi odası kur')).toBeTruthy();
  expect(screen.queryByText('Old movie')).toBeNull();
});
it('still opens an explicitly linked shared room', async () => {
  mockParams = { id: oldRoom.id };
  const screen = await mount();
  expect(await screen.findAllByText('Old movie')).not.toHaveLength(0);
  expect(repository.fetchWheelEntries).toHaveBeenCalledWith(oldRoom.id);
});
it('only restores a previous room when explicitly selected', async () => {
  const screen = await mount();
  await fireEvent.press(await screen.findByRole('button', { name: 'Room 1' }));
  expect(await screen.findAllByText('Old movie')).not.toHaveLength(0);
});
it('ignores a spin result that arrives after leaving the session', async () => {
  jest.mocked(repository.fetchWatchWheels).mockResolvedValue([{ ...oldRoom, result: undefined }]);
  jest.mocked(repository.fetchWheelEntries).mockImplementation(async id => id === oldRoom.id ? [1, 2].map(index => ({ id: `entry-${index}`, wheelId: id, addedBy: 'alice', media: { ...movie, id: index, title: `Choice ${index}` }, watched: false, createdAt: '' })) : []);
  let finishSpin!: (media: Media) => void;
  jest.mocked(repository.spinWatchWheel).mockImplementation(() => new Promise(resolve => { finishSpin = resolve; }));
  const screen = await mount();
  await fireEvent.press(await screen.findByRole('button', { name: 'Room 1' }));
  await screen.findByText('Choice 1');
  await fireEvent.press(screen.getByText('SPIN THE WHEEL'));
  await waitFor(() => expect(repository.spinWatchWheel).toHaveBeenCalled());
  await act(async () => { mockBlur?.(); mockBlur = mockFocus(); finishSpin({ ...movie, title: 'Late winner' }); });
  await fireEvent.press(await screen.findByText('Create room'));
  await screen.findByText('No titles yet. Be the first to add one!');
  expect(screen.queryByText('Late winner')).toBeNull();
});
