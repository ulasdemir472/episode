import { handleAccountDeletion } from '../_shared/account-deletion.ts';
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const request = () => new Request('https://example.test/delete-account', { method: 'POST', headers: { authorization: 'Bearer user-token' }, body: JSON.stringify({ userId: 'someone-else' }) });

Deno.test('account deletion uses the verified user identity and cleans media before deleting auth', async () => {
  const calls: string[] = [];
  const response = await handleAccountDeletion(request(), { authenticate: async () => 'alice', removeFiles: async (id) => { calls.push(`files:${id}`); }, deleteUser: async (id) => { calls.push(`auth:${id}`); } });
  assert(response.status === 200, 'Deletion should succeed');
  assert(JSON.stringify(calls) === JSON.stringify(['files:alice', 'auth:alice']), 'Ignore user ids in the request body and delete media first');
});
Deno.test('media failure keeps the auth account and returns a failure', async () => {
  let deleted = false;
  const response = await handleAccountDeletion(request(), { authenticate: async () => 'alice', removeFiles: async () => { throw new Error('storage unavailable'); }, deleteUser: async () => { deleted = true; } });
  assert(response.status === 502 && !deleted, 'Storage failure must not become deletion success');
});
Deno.test('invalid sessions never delete files or accounts', async () => {
  let touched = false;
  const response = await handleAccountDeletion(request(), { authenticate: async () => undefined, removeFiles: async () => { touched = true; }, deleteUser: async () => { touched = true; } });
  assert(response.status === 401 && !touched, 'Invalid session must not mutate anything');
});
