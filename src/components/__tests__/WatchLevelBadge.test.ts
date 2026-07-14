import { getWatchLevel } from '@/components/WatchLevelBadge';

describe('watch level badge', () => {
  it('unlocks one level for every one hundred watched hours', () => {
    expect(getWatchLevel(99 * 60)).toMatchObject({ level: 0, nextHours: 100 });
    expect(getWatchLevel(100 * 60)).toMatchObject({ level: 1, progress: 0, nextHours: 200 });
    expect(getWatchLevel(250 * 60)).toMatchObject({ level: 2, progress: 50, nextHours: 300 });
  });
});
