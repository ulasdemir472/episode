import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { ContentTransition } from '../ContentTransition';
afterEach(() => jest.restoreAllMocks());
it.each([false, true])('respects reduced motion = %s when content changes', async (reduceMotion) => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  const start = jest.fn();
  const animate = jest.spyOn(Animated, 'timing').mockReturnValue({ start, stop: jest.fn(), reset: jest.fn() });
  const screen = await render(<ContentTransition changeKey="episode-1"><Text>Episode 1</Text></ContentTransition>);
  await act(async () => { await Promise.resolve(); });
  await screen.rerender(<ContentTransition changeKey="episode-2"><Text>Episode 2</Text></ContentTransition>);
  expect(screen.getByText('Episode 2')).toBeTruthy();
  if (reduceMotion) expect(animate).not.toHaveBeenCalled();
  else expect(start).toHaveBeenCalledTimes(1);
});
