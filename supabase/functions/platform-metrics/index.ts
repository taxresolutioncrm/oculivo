import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': 'https://admin.romylabs.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'x-hub-secret, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'GET') return json({ ok:false, error:'Method not allowed' }, 405)
  const expected = Deno.env.get('HUB_METRICS_SECRET')
  if (!expected || req.headers.get('x-hub-secret') !== expected) return json({ ok:false, error:'Unauthorized' }, 401)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth:{ persistSession:false } })
  const [{data:orgs,error:orgErr},{count:staff},{count:patients}] = await Promise.all([
    db.from('organizations').select('id,name').order('name',{ascending:true}),
    db.from('organization_memberships').select('organization_id',{count:'exact',head:true}).eq('is_active',true),
    db.from('patients').select('id',{count:'exact',head:true}),
  ])
  if (orgErr) return json({ ok:false, error:'Unable to load Oculivo offices' }, 500)

  const offices=(orgs||[]).map((o:any)=>({
    id:o.id,
    name:o.name,
    is_active:true,
    status:'active',
    since:null,
    mrr:null,
  }))

  return json({
    ok:true,
    product:'oculivo',
    product_label:'Oculivo',
    fetched_at:new Date().toISOString(),
    metrics:{
      active_offices:offices.length,
      total_offices:offices.length,
      active_staff:staff||0,
      active_clients:patients||0,
      mrr:null,
      storage_bytes:null,
    },
    offices,
  })
})
