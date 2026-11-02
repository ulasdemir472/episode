import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { handleNotificationJob } from '../_shared/notification-worker.ts';
import { observeRequest } from '../_shared/observability.ts';
Deno.serve((request) => {
  const environment = Deno.env.toObject();
  if (!environment.SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Server configuration missing' }, { status: 503 });
  const admin = createClient(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return observeRequest(request, { service: 'notification-worker', environment, admin,
    handler: (fetcher) => handleNotificationJob(request, { environment, createAdmin: () => admin, fetch: fetcher }) });
});
