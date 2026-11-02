import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { handleCatalog } from '../_shared/catalog-handler.ts';
import { observeRequest } from '../_shared/observability.ts';
Deno.serve((request) => {
  const environment = Deno.env.toObject();
  if (!environment.SUPABASE_URL || !environment.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'Server configuration missing' }, { status: 503 });
  const createAdmin = (url: string, key: string) => createClient(url, key, { auth: { persistSession: false } });
  const admin = createAdmin(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY);
  return observeRequest(request, { service: 'catalog-api', environment, admin, handler: (fetcher, measure) => handleCatalog(request, { environment, createAdmin: () => admin, fetch: fetcher, measure }) });
});
