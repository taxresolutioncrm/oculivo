import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CENTRAL_URL='https://mpxgxfqdbquzkrvvejkh.supabase.co'
const CENTRAL_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1weGd4ZnFkYnF1emtydnZlamtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTk5MzksImV4cCI6MjA5NDg3NTkzOX0.puvhU1MV5nGOykizeTkwCpRR7NKKaGsVpA8oqjVjmu4'
const ALLOWED=new Set(['info@romylabs.com','romy@romylabs.com','romy@taxrescrm.net','romy@taxcasereview.org'])
const cors={'Access-Control-Allow-Origin':'https://admin.romylabs.com','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'authorization,content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})

async function countRows(sb:any, table:string, apply?:(q:any)=>any){
  try{
    let q=sb.from(table).select('id',{count:'exact',head:true})
    if(apply) q=apply(q)
    const {count,error}=await q
    return {count:count??0,error:error?.message||null}
  }catch(e){ return {count:0,error:String(e)} }
}
async function storageSummary(sb:any){
  let bytes=0,objects=0
  const {data:buckets,error:bucketError}=await sb.storage.listBuckets()
  if(bucketError) return {bytes:0,objects:0,error:bucketError.message}
  for(const bucket of buckets||[]){
    const queue=['']
    while(queue.length){
      const path=queue.shift()!
      for(let offset=0;;offset+=1000){
        const {data,error}=await sb.storage.from(bucket.name).list(path,{limit:1000,offset,sortBy:{column:'name',order:'asc'}})
        if(error) break
        const rows=data||[]
        for(const item of rows){
          const next=path?path+'/'+item.name:item.name
          if(item.metadata){
            objects++
            bytes+=Number(item.metadata.size||0)
          }else{
            queue.push(next)
          }
        }
        if(rows.length<1000) break
      }
    }
  }
  return {bytes,objects,error:null}
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors})
  if(req.method!=='GET') return json({ok:false,error:'Method not allowed'},405)

  const auth=req.headers.get('Authorization')||''
  if(!auth.startsWith('Bearer ')) return json({ok:false,error:'Authentication required'},401)
  const hub=createClient(CENTRAL_URL,CENTRAL_ANON,{global:{headers:{Authorization:auth}}})
  const {data:{user},error:authError}=await hub.auth.getUser()
  if(authError||!user) return json({ok:false,error:'Invalid or expired session'},401)
  if(!ALLOWED.has(String(user.email||'').toLowerCase())) return json({ok:false,error:'Forbidden'},403)

  const url=Deno.env.get('SUPABASE_URL')
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!url||!key) return json({ok:false,error:'Metrics service not configured'},503)
  const sb=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})

  const errors:string[]=[]
  const staff=await countRows(sb,'organization_memberships',q=>q.eq('is_active',true)); if(staff.error)errors.push(staff.error)
  const clients=await countRows(sb,'patients'); if(clients.error)errors.push(clients.error)
  const jobs=await countRows(sb,'appointments'); if(jobs.error)errors.push(jobs.error)
  const {data:orgs,error:orgErr}=await sb.from('organizations').select('id,name,created_at').order('name')
  if(orgErr) errors.push(orgErr.message)
  const offices=(orgs||[]).map((o:any)=>({id:o.id,name:o.name,status:'active',is_active:true,since:o.created_at,storage_bytes:0}))
  const storage=await storageSummary(sb)
  if(storage.error) errors.push(storage.error)

  return json({
    ok:errors.length===0,
    product:'oculivo',
    snapshot:new Date().toISOString(),
    metrics:{
      active_offices:offices.length,
      total_offices:offices.length,
      active_clients:clients.count,
      active_staff:staff.count,
      open_jobs:jobs.count,
      storage_bytes:storage.bytes,
      storage_objects:storage.objects
    },
    offices,
    partial:errors.length>0,
    errors
  })
})