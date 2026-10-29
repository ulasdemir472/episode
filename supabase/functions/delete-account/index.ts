import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { handleAccountDeletion } from '../_shared/account-deletion.ts';

Deno.serve(async (request) => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response('Server configuration missing', { status: 503 });
  const admin = createClient(url, key, { auth: { persistSession: false } });
  return handleAccountDeletion(request, {
    authenticate: async (token) => { const { data, error } = await admin.auth.getUser(token); return error ? undefined : data.user?.id; },
    removeFiles: async (userId) => {
      for (const bucket of ['avatars', 'comment-images']) {
        const removeFolder = async (prefix: string): Promise<void> => {
          for (;;) {
            const listed = await admin.storage.from(bucket).list(prefix, { limit: 100, offset: 0 });
            if (listed.error) throw listed.error;
            if (!listed.data?.length) return;
            const files: string[] = [];
            for (const item of listed.data) {
              const path = `${prefix}/${item.name}`;
              if (item.id === null) await removeFolder(path); else files.push(path);
            }
            if (files.length) { const removed = await admin.storage.from(bucket).remove(files); if (removed.error) throw removed.error; }
          }
        };
        await removeFolder(userId);
      }
    },
    deleteUser: async (userId) => { const { error } = await admin.auth.admin.deleteUser(userId); if (error) throw error; },
  });
});
