import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const e164=/^\+[1-9]\d{7,14}$/;
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

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const url=new URL(req.url),org=url.searchParams.get("org")||"",sig=url.searchParams.get("sig")||"";
  const secret=Deno.env.get("OCULIVO_INBOUND_SMS_SECRET")||"";
  if(!secret||!org||!sig||!same(sig,await hmac(secret,org)))return json({error:"Invalid webhook signature"},403);

  const form=await req.formData().catch(()=>null);
  if(!form)return json({error:"Invalid webhook payload"},400);
  const from=String(form.get("From")||"").trim();
  const to=String(form.get("To")||"").trim();
  const body=String(form.get("Body")||"").trim();
  const configuredTo=String(Deno.env.get("OCULIVO_SMS_FROM_NUMBER")||"").trim();
  const rawProviderId=String(form.get("MessageSid")||form.get("SmsSid")||"").trim(),providerMessageId=rawProviderId?"signalwire:"+rawProviderId:null;
  if(!e164.test(from)||!e164.test(to)||!body)return json({error:"Invalid inbound SMS payload"},400);
  if(!e164.test(configuredTo)||to!==configuredTo)return json({error:"Inbound SMS destination is not configured for Oculivo"},403);

  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  if(providerMessageId){const dupe=await sb.from("communication_messages").select("id").eq("organization_id",org).eq("provider_message_id",providerMessageId).limit(1);if(!dupe.error&&dupe.data?.length)return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>",{status:200,headers:{"Content-Type":"text/xml"}});}
  const existing=await sb.from("communication_threads").select("id,organization_id").eq("organization_id",org).eq("channel","sms").eq("phone_number",from).order("last_message_at",{ascending:false}).limit(1).maybeSingle();
  if(existing.error)return json({error:"Could not look up SMS conversation"},500);
  let thread=existing.data;
  const now=new Date().toISOString();
  if(!thread){
    const created=await sb.from("communication_threads").insert({organization_id:org,channel:"sms",phone_number:from,subject:from,status:"open",last_message_at:now}).select("id,organization_id").single();
    if(created.error||!created.data)return json({error:"Could not create SMS conversation"},500);
    thread=created.data;
  }
  const ins=await sb.from("communication_messages").insert({organization_id:org,thread_id:thread.id,direction:"inbound",sender_name:from,sender_address:from,body,is_read:false,sent_by:null,created_at:now,provider_message_id:providerMessageId});
  if(ins.error)return json({error:"Could not store inbound SMS"},500);
  await sb.from("communication_threads").update({last_message_at:now,status:"open"}).eq("id",thread.id).eq("organization_id",org);
  return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>",{status:200,headers:{"Content-Type":"text/xml"}});
});
