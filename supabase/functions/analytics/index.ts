import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { handleAnalyticsIntake } from '../_shared/analytics-intake.ts';
Deno.serve((request) => {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return Response.json({ error: 'Server configuration missing' }, { status: 503 });
  return handleAnalyticsIntake(request, { admin: createClient(url, key, { auth: { persistSession: false } }) });
});
