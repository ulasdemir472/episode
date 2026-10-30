import { act, fireEvent, render } from '@testing-library/react-native';
import LibraryScreen from '../../../../app/(tabs)/library';
import { useLibraryStore } from '@/store/library-store';
import { useProfileStore } from '@/store/profile-store';
import type { Media } from '@/domain/media';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
const movie: Media = { id: 1, type: 'movie', title: 'Movie', overview: '', genres: [], year: '2010', rating: 9, posterUrl: '', backdropUrl: '' };
const show: Media = { ...movie, id: 1, type: 'tv', title: 'Show', year: '2020', rating: 7 };

beforeEach(() => {
  jest.useFakeTimers();
  useProfileStore.getState().clearUserData();
  useLibraryStore.getState().clearUserData();
  useLibraryStore.getState().upsert(movie, 'completed');
  useLibraryStore.getState().upsert(show, 'watching');
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });

it.each(['tr', 'en'] as const)('combines status, content and sort menus in %s', async language => {
  useProfileStore.setState({ language });
  const en = language === 'en';
  const screen = await render(<LibraryScreen />);
  expect(screen.getByText('Show')).toBeTruthy();
  expect(screen.queryByText('Movie')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(en ? '^Status:' : '^Durum:') }));
  await fireEvent.press(screen.getByRole('radio', { name: en ? 'All titles' : 'Tüm yapımlar' }));
  expect(screen.getByText('Movie')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(en ? '^Sort by:' : '^Sıralama:') }));
  await fireEvent.press(screen.getByRole('radio', { name: en ? 'By rating' : 'Puana göre' }));
  expect(screen.getAllByLabelText(en ? /details/ : /detayını aç/).map(node => node.props.accessibilityLabel)).toEqual([
    expect.stringContaining('Movie'), expect.stringContaining('Show'),
  ]);
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(en ? '^Content:' : '^İçerik:') }));
  await fireEvent.press(screen.getByRole('radio', { name: en ? 'Shows' : 'Diziler' }));
  expect(screen.getByText('Show')).toBeTruthy();
  expect(screen.queryByText('Movie')).toBeNull();
});

it('keeps search and favorites working with the new menus', async () => {
  useProfileStore.setState({ language: 'en', favorites: [movie] });
  const screen = await render(<LibraryScreen />);
  await fireEvent.press(screen.getByRole('button', { name: /^Status:/ }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Favorites' }));
  expect(screen.getByText('Movie')).toBeTruthy();
  expect(screen.queryByText('Show')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Search your library…'), 'missing');
  expect(screen.queryByText('Movie')).toBeNull();
});
