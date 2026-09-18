import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const enc=new TextEncoder();

async function hmac(secret:string,value:string){
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(value)));
  return [...sig].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function same(a:string,b:string){
  if(a.length!==b.length)return false;
  let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);
  return out===0;
}
function mailboxAddress(v:any){return String(v?.Address||v?.address||"").trim().toLowerCase()}
function mailboxName(v:any){return String(v?.Name||v?.name||"").trim()}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const url=new URL(req.url),org=url.searchParams.get("org")||"",sig=url.searchParams.get("sig")||"";
  const secret=Deno.env.get("OCULIVO_INBOUND_EMAIL_SECRET")||"";
  if(!secret||!org||!sig||!same(sig,await hmac(secret,org)))return json({error:"Invalid webhook signature"},403);

  let payload:any;try{payload=await req.json()}catch{return json({error:"Invalid webhook payload"},400)}
  const items=Array.isArray(payload?.items)?payload.items:[];
  if(!items.length)return json({ok:true,received:0});

  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  let received=0;
  for(const item of items){
    const from=mailboxAddress(item?.From),name=mailboxName(item?.From),subject=String(item?.Subject||"").trim();
    const body=String(item?.ExtractedMarkdownMessage||item?.RawTextBody||"").trim();
    if(!validEmail.test(from)||!body)continue;
    const existing=await sb.from("communication_threads").select("id,organization_id,subject").eq("organization_id",org).eq("channel","email").eq("email_address",from).order("last_message_at",{ascending:false}).limit(1).maybeSingle();
    if(existing.error)continue;
    let thread=existing.data;
    const now=new Date().toISOString();
    if(!thread){
      const created=await sb.from("communication_threads").insert({organization_id:org,channel:"email",email_address:from,subject:subject||from,status:"open",last_message_at:now}).select("id,organization_id,subject").single();
      if(created.error||!created.data)continue;
      thread=created.data;
    }
    const ins=await sb.from("communication_messages").insert({organization_id:org,thread_id:thread.id,direction:"inbound",sender_name:name||from,sender_address:from,body,is_read:false,sent_by:null,created_at:now});
    if(ins.error)continue;
    await sb.from("communication_threads").update({last_message_at:now,status:"open",subject:subject||thread.subject||from}).eq("id",thread.id).eq("organization_id",org);
    received++;
  }
  return json({ok:true,received});
});
