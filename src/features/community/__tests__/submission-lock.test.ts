import { SubmissionLock } from '../submission-lock';

describe('comment submission lock', () => {
  it('rejects a second rapid submission until the first request finishes', () => {
    const lock = new SubmissionLock();
    expect(lock.tryAcquire()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);
    lock.release();
    expect(lock.tryAcquire()).toBe(true);
  });
});
