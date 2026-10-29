import { deleteUserAccount } from '../account-service';
import { requireSupabase } from '@/infrastructure/supabase/client';
jest.mock('@/infrastructure/supabase/client', () => ({ requireSupabase: jest.fn() }));
const invoke = jest.fn();
beforeEach(() => { jest.clearAllMocks(); jest.mocked(requireSupabase).mockReturnValue({ functions: { invoke } } as unknown as ReturnType<typeof requireSupabase>); });
it('requires confirmed server deletion before reporting success', async () => {
  const error = { message: 'network failure' };
  invoke.mockResolvedValue({ error });
  await expect(deleteUserAccount()).rejects.toEqual(error);
  expect(invoke).toHaveBeenCalledWith('delete-account', { body: {} });
});
it('propagates network exceptions without deleting unrelated tables', async () => {
  invoke.mockRejectedValue(new Error('offline'));
  await expect(deleteUserAccount()).rejects.toThrow('offline');
});
it('completes only after the server confirms deletion', async () => {
  invoke.mockResolvedValue({ error: null, data: { deleted: true } });
  await expect(deleteUserAccount()).resolves.toBeUndefined();
});
it('rejects a successful HTTP response without an explicit deletion confirmation', async () => {
  invoke.mockResolvedValue({ error: null, data: {} });
  await expect(deleteUserAccount()).rejects.toThrow('Account deletion was not confirmed');
});
