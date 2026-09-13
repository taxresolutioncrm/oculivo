import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const e164=/^\+[1-9]\d{7,14}$/;
const enc=new TextEncoder();

async function hmac(secret:string,value:string){
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(value)));
  return [...sig].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function same(a:string,b:string){
  if(a.length!==b.length)return false;
  let out=0; for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);
  return out===0;
}
function clients(auth?:string){
  const url=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  return {
    user:createClient(url,anon,{global:{headers:auth?{Authorization:auth}:{}},auth:{persistSession:false}}),
    service:createClient(url,service,{auth:{persistSession:false}})
  };
}
async function logFax(service:any,thread:any,userId:string|null,body:string,from:string){
  const now=new Date().toISOString();
  const ins=await service.from("communication_messages").insert({
    organization_id:thread.organization_id,
    thread_id:thread.id,
    direction:"outbound",
    sender_name:"Oculivo Fax",
    sender_address:from,
    body,
    is_read:true,
    sent_by:userId,
    created_at:now
  });
  if(ins.error)console.error("Fax CRM log",ins.error);
  await service.from("communication_threads").update({last_message_at:now}).eq("id",thread.id);
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);

  const callback=new URL(req.url).searchParams.get("callback")==="1";
  const secret=Deno.env.get("OCULIVO_FAX_CALLBACK_SECRET")||"";
  const {service}=clients();

  if(callback){
    if(!secret)return json({error:"Fax callback is not configured"},503);
    const u=new URL(req.url),org=u.searchParams.get("org")||"",threadId=u.searchParams.get("thread")||"",sig=u.searchParams.get("sig")||"";
    if(!org||!threadId||!sig||!same(sig,await hmac(secret,org+"."+threadId)))return json({error:"Invalid callback signature"},403);
    const form=await req.formData().catch(()=>null); if(!form)return json({error:"Invalid callback"},400);
    const {data:thread}=await service.from("communication_threads").select("id,organization_id,phone_number").eq("id",threadId).eq("organization_id",org).maybeSingle();
    if(!thread)return json({error:"Thread not found"},404);
    const status=String(form.get("FaxStatus")||form.get("Status")||"completed");
    const sid=String(form.get("FaxSid")||form.get("Sid")||"");
    const pages=String(form.get("NumPages")||"");
    const error=String(form.get("ErrorMessage")||"");
    const summary="Fax "+status+(pages?" · "+pages+" page"+(pages==="1"?"":"s"):"")+(sid?" · "+sid:"")+(error?" · "+error:"");
    await logFax(service,thread,null,summary,Deno.env.get("OCULIVO_FAX_FROM_NUMBER")||"");
    return json({ok:true});
  }

  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))return json({error:"Missing authorization"},401);
  const {user}=clients(auth);
  const {data:{user:actor}}=await user.auth.getUser();
  if(!actor)return json({error:"Invalid token"},401);
  let b:{thread_id?:string;storage_path?:string;file_name?:string}; try{b=await req.json()}catch{return json({error:"Invalid JSON"},400)}
  if(!b.thread_id||!b.storage_path)return json({error:"thread_id and storage_path are required"},400);

  const {data:thread}=await user.from("communication_threads").select("id,organization_id,channel,phone_number").eq("id",b.thread_id).single();
  if(!thread||!["phone","fax"].includes(String(thread.channel)))return json({error:"Phone or fax thread not found or not authorized"},403);
  const {data:membership}=await user.from("organization_memberships").select("role,is_active").eq("organization_id",thread.organization_id).eq("user_id",actor.id).eq("is_active",true).maybeSingle();
  if(!membership||!["owner","admin","manager","provider","staff"].includes(String(membership.role)))return json({error:"Communication permission required"},403);
  if(!String(b.storage_path).startsWith(String(thread.organization_id)+"/"))return json({error:"Fax document is outside this practice"},403);

  const to=String(thread.phone_number||"").trim(),from=(Deno.env.get("OCULIVO_FAX_FROM_NUMBER")||"").trim();
  if(!e164.test(to)||!e164.test(from))return json({error:"Fax numbers are not configured in E.164 format"},409);
  const project=Deno.env.get("SIGNALWIRE_PROJECT_ID")||"",token=Deno.env.get("SIGNALWIRE_AUTH_TOKEN")||"",space=(Deno.env.get("SIGNALWIRE_SPACE_URL")||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
  if(!project||!token||!space)return json({error:"Fax provider is not configured"},503);
  if(!secret)return json({error:"Fax callback secret is not configured"},503);

  const signed=await service.storage.from("oculivo-documents").createSignedUrl(String(b.storage_path),18000);
  if(signed.error||!signed.data?.signedUrl)return json({error:"Could not open fax document"},404);

  const callbackSig=await hmac(secret,String(thread.organization_id)+"."+String(thread.id));
  const callbackUrl=(Deno.env.get("SUPABASE_URL")||"")+"/functions/v1/send-fax?callback=1&org="+encodeURIComponent(String(thread.organization_id))+"&thread="+encodeURIComponent(String(thread.id))+"&sig="+callbackSig;
  const form=new URLSearchParams({
    MediaUrl:signed.data.signedUrl,
    To:to,
    From:from,
    Quality:"fine",
    StatusCallback:callbackUrl,
    StatusCallbackMethod:"POST",
    StoreMedia:"true",
    Ttl:"60"
  });
  const pr=await fetch("https://"+space+"/api/laml/2010-04-01/Accounts/"+encodeURIComponent(project)+"/Faxes",{
    method:"POST",
    headers:{Authorization:"Basic "+btoa(project+":"+token),"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},
    body:form.toString()
  });
  if(!pr.ok){console.error("SignalWire Fax",pr.status,await pr.text());return json({error:"Fax provider rejected the document"},502)}
  const pdata=await pr.json().catch(()=>({}));
  const sid=String(pdata.sid||pdata.Sid||"");
  const status=String(pdata.status||"queued");
  await logFax(service,thread,actor.id,"Fax "+status+" · "+String(b.file_name||"document.pdf")+(sid?" · "+sid:""),from);
  return json({status,provider_id:sid});
});