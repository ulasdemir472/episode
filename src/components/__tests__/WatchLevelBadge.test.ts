import { getWatchLevel } from '@/components/WatchLevelBadge';

describe('watch level badge', () => {
  it('keeps level zero at one hundred hours, then uses thousand-hour levels', () => {
    expect(getWatchLevel(99 * 60)).toMatchObject({ level: 0, nextHours: 100 });
    expect(getWatchLevel(100 * 60)).toMatchObject({ level: 1, progress: 0, nextHours: 1000 });
    expect(getWatchLevel(550 * 60)).toMatchObject({ level: 1, progress: 50, nextHours: 1000 });
    expect(getWatchLevel(1000 * 60)).toMatchObject({ level: 2, progress: 0, nextHours: 2000 });
    expect(getWatchLevel(2000 * 60)).toMatchObject({ level: 3, progress: 0, nextHours: 3000 });
    expect(getWatchLevel(4700 * 60)).toMatchObject({ level: 5, progress: 70, nextHours: 5000 });
  });
});
