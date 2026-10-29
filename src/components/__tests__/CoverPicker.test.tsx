import { fireEvent, render } from '@testing-library/react-native';
import { CoverPicker } from '../CoverPicker';
import { Media } from '@/domain/media';
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
const media: Media[] = ['First', 'Second'].map((title, id) => ({ id, title, type: 'movie', overview: '', posterUrl: `poster-${id}`, backdropUrl: `cover-${id}`, year: '2026', rating: 8, genres: [] }));
it.each(['tr', 'en'] as const)('previews and explicitly applies a searchable cover in %s', async (language) => {
  const onSelect = jest.fn();
  const en = language === 'en';
  const screen = await render(<CoverPicker media={media} selectedUrl="cover-0" onSelect={onSelect} language={language} />);
  await fireEvent.press(screen.getByLabelText(en ? 'Choose profile cover' : 'Profil kapağı seç'));
  await fireEvent.changeText(screen.getByLabelText(en ? 'Search cover titles' : 'Kapak yapımlarında ara'), 'Second');
  expect(screen.queryByRole('radio', { name: 'First' })).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: 'Second' }));
  expect(screen.getByLabelText(en ? 'Cover preview' : 'Kapak önizlemesi').props.source).toEqual({ uri: 'cover-1' });
  expect(onSelect).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText(en ? 'Use this cover' : 'Bu kapağı kullan'));
  expect(onSelect).toHaveBeenCalledWith('cover-1');
});
it('cancels a draft without changing the saved cover', async () => {
  const onSelect = jest.fn();
  const screen = await render(<CoverPicker media={media} selectedUrl="cover-0" onSelect={onSelect} language="tr" />);
  await fireEvent.press(screen.getByLabelText('Profil kapağı seç'));
  await fireEvent.press(screen.getByRole('radio', { name: 'Second' }));
  await fireEvent.press(screen.getByLabelText('Kapak seçimini kapat'));
  expect(onSelect).not.toHaveBeenCalled();
});
