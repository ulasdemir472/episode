import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import PersonScreen from '../../../../app/person/[id]';
import { catalogService } from '@/services/tmdb';
import { useProfileStore } from '@/store/profile-store';
import type { PersonDetails } from '@/domain/person';

const mockParams = { id: '31' };
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('@/services/tmdb', () => ({ catalogService: { personDetails: jest.fn() } }));
const person: PersonDetails = { id: 31, name: 'Actor Director', profileUrl: '', biography: '', credits: [
  { id: 12, type: 'movie', title: 'Movie credit', overview: '', genres: [], posterUrl: '', backdropUrl: '', year: '2026', rating: 8 },
  { id: 12, type: 'tv', title: 'TV credit', overview: '', genres: [], posterUrl: '', backdropUrl: '', year: '2020', rating: 7 },
] };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}><PersonScreen /></QueryClientProvider>);
beforeEach(() => { jest.clearAllMocks(); mockParams.id = '31'; useProfileStore.setState({ language: 'en' }); jest.mocked(catalogService.personDetails).mockResolvedValue(person); });

it.each(['tr', 'en'] as const)('opens, filters and navigates from a person filmography in %s', async language => {
  useProfileStore.setState({ language });
  const en = language === 'en';
  const screen = await mount();
  expect(await screen.findByText('Actor Director')).toBeTruthy();
  expect(catalogService.personDetails).toHaveBeenCalledWith(31, language);
  expect(screen.getByText('Movie credit')).toBeTruthy();
  expect(screen.getByText('TV credit')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(en ? '^Content:' : '^İçerik:') }));
  await fireEvent.press(screen.getByRole('radio', { name: en ? 'Shows' : 'Diziler' }));
  expect(screen.queryByText('Movie credit')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: new RegExp('TV credit') }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/media/[id]', params: { id: '12', data: JSON.stringify(person.credits[1]) } });
});
it('shows a retryable error and recovers after a failed request', async () => {
  jest.mocked(catalogService.personDetails).mockRejectedValueOnce(new Error('offline'));
  const screen = await mount();
  expect(await screen.findByText('Could not load this person.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Try again'));
  expect(await screen.findByText('Actor Director')).toBeTruthy();
});
it('does not request an invalid person link', async () => {
  mockParams.id = 'invalid';
  const screen = await mount();
  expect(screen.getByText('Could not load this person.')).toBeTruthy();
  expect(catalogService.personDetails).not.toHaveBeenCalled();
});
