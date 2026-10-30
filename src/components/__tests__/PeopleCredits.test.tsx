import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PeopleCredits, PersonPortrait } from '../PeopleCredits';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const actor = { id: 31, name: 'Actor', profileUrl: 'https://image.tmdb.org/t/p/w185/actor.jpg', character: 'Character' };
beforeEach(() => jest.clearAllMocks());
it.each(['tr', 'en'] as const)('opens a person from their photo card in %s', async language => {
  const screen = await render(<PeopleCredits title={language === 'en' ? 'Cast' : 'Oyuncular'} people={[actor]} language={language} />);
  expect(screen.getByText('Character')).toBeTruthy();
  expect(screen.getByLabelText('Actor').props.source.uri).toBe(actor.profileUrl);
  await fireEvent.press(screen.getByRole('button', { name: language === 'en' ? 'View Actor filmography' : 'Actor filmografisini aç' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/person/[id]', params: { id: '31' } });
});
it('keeps the person card usable after a failed image download', async () => {
  const screen = await render(<PersonPortrait person={actor} />);
  await fireEvent(screen.getByLabelText('Actor'), 'error', { nativeEvent: { error: 'offline' } });
  expect(screen.queryByLabelText('Actor')).toBeNull();
});
