import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { handleMonitoringExport } from '../_shared/monitoring-export.ts';
Deno.serve((request) => {
  const environment = Deno.env.toObject();
  if (!environment.SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Server configuration missing' }, { status: 503 });
  return handleMonitoringExport(request, { environment, admin: createClient(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) });
});
