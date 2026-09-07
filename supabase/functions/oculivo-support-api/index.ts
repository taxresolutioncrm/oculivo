import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PRODUCT_ID = 'oculivo';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSHA256(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

function canonicalBody(obj: Record<string, unknown>) {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
  return JSON.stringify(sorted);
}

async function forward(payload: Record<string, unknown>) {
  const secret = Deno.env.get('OCULIVO_SUPPORT_SECRET');
  const apiUrl = Deno.env.get('ROMYLABS_SUPPORT_API_URL');
  if (!secret || !apiUrl) return { status: 503, data: { error: 'Support service not configured' } };

  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = canonicalBody({ ...payload, product_id: PRODUCT_ID });
  const signature = await hmacSHA256(secret, timestamp + '.' + body);

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-romylabs-product': PRODUCT_ID,
        'x-romylabs-timestamp': timestamp,
        'x-romylabs-signature': signature,
      },
      body,
    });
    const data = await res.json().catch(() => ({ error: 'Support service error' }));
    return { status: res.status, data };
  } catch {
    return { status: 502, data: { error: 'Support service unavailable' } };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: 'Authentication required' }, 401);

  const browserBody = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!browserBody?.action) return json({ error: 'Missing action' }, 400);

  const organizationId = String(browserBody.organization_id ?? '').trim();
  if (!organizationId) return json({ error: 'Active practice is required' }, 400);

  const { data: membership, error: membershipError } = await admin
    .from('organization_memberships')
    .select('organization_id,role,is_active')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (membershipError) return json({ error: membershipError.message }, 500);
  if (!membership) return json({ error: 'Active practice membership required' }, 403);

  const { data: organization } = await admin
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle();

  const role = String(membership.role ?? 'staff');
  const callerRole = ['owner', 'admin', 'manager'].includes(role) ? 'admin' : 'member';
  const userName = String(user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Customer');

  const trusted = {
    action: browserBody.action,
    product_tenant_id: organizationId,
    product_tenant_name: String(organization?.name ?? 'Oculivo Practice'),
    product_user_id: user.id,
    product_user_email: user.email ?? '',
    product_org_role: role,
    caller_role: callerRole,
    submitted_by_name: userName,
  };

  let payload: Record<string, unknown>;
  switch (browserBody.action) {
    case 'create_ticket': {
      const rawCategory = String(browserBody.category ?? 'technical').toLowerCase();
      const rawPriority = String(browserBody.priority ?? 'normal').toLowerCase();
      const categoryMap: Record<string,string> = {
        technical: 'Bug Report',
        bug: 'Bug Report',
        feature_request: 'Feature Request',
        account: 'Account Issue',
        billing: 'Billing Question',
        training: 'Other',
        other: 'Other',
      };
      const priorityMap: Record<string,string> = {
        low: 'Low',
        normal: 'Normal',
        high: 'High',
        urgent: 'Urgent',
      };
      payload = {
        ...trusted,
        subject: String(browserBody.subject ?? '').slice(0, 240),
        description: String(browserBody.description ?? '').slice(0, 10000),
        category: categoryMap[rawCategory] ?? 'Other',
        priority: priorityMap[rawPriority] ?? 'Normal',
      };
      if (!payload.subject || !payload.description) return json({ error: 'Subject and description are required' }, 400);
      break;
    }
    case 'list_tickets':
      payload = { ...trusted, status_filter: browserBody.status_filter, limit: browserBody.limit, offset: browserBody.offset };
      break;
    case 'get_ticket':
      payload = { ...trusted, ticket_id: browserBody.ticket_id };
      break;
    case 'add_reply':
      payload = { ...trusted, ticket_id: browserBody.ticket_id, message: browserBody.message };
      break;
    default:
      return json({ error: 'Unknown support action' }, 400);
  }

  const result = await forward(payload);
  return json(result.data, result.status);
});