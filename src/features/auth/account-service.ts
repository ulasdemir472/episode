import { requireSupabase } from '@/infrastructure/supabase/client';

export async function deleteUserAccount(): Promise<void> {
  const { data, error } = await requireSupabase().functions.invoke<{ deleted: boolean }>('delete-account', { body: {} });
  if (error) throw error;
  if (!data?.deleted) throw new Error('Account deletion was not confirmed');
}
