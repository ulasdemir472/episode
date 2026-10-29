import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { handleNotificationJob } from '../_shared/notification-worker.ts';
Deno.serve((request) => handleNotificationJob(request, {
  environment: { SUPABASE_URL: Deno.env.get('SUPABASE_URL'), SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), TMDB_ACCESS_TOKEN: Deno.env.get('TMDB_ACCESS_TOKEN'), EXPO_ACCESS_TOKEN: Deno.env.get('EXPO_ACCESS_TOKEN') },
  createAdmin: (url, key) => createClient(url, key, { auth: { persistSession: false } }),
}));
