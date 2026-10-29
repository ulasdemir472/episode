type DeletionDependencies = {
  authenticate: (token: string) => Promise<string | undefined>;
  removeFiles: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
};
export async function handleAccountDeletion(request: Request, dependencies: DeletionDependencies): Promise<Response> {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
  const reply = (payload: unknown, status: number) => new Response(JSON.stringify(payload), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply({ error: 'Unauthorized' }, 401);
  try {
    const userId = await dependencies.authenticate(token);
    if (!userId) return reply({ error: 'Unauthorized' }, 401);
    // The account remains recoverable if media cleanup fails.
    await dependencies.removeFiles(userId);
    await dependencies.deleteUser(userId);
    return reply({ deleted: true }, 200);
  } catch { return reply({ error: 'Account deletion failed' }, 502); }
}
