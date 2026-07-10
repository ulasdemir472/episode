import { progressPercent } from '../progress';

describe('progressPercent', () => {
  it('calculates rounded viewing progress', () => expect(progressPercent(3, 8)).toBe(38));
  it('guards invalid and overflowing values', () => {
    expect(progressPercent(2, 0)).toBe(0);
    expect(progressPercent(12, 10)).toBe(100);
    expect(progressPercent(-2, 10)).toBe(0);
  });
});

