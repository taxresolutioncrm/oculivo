import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const e164=/^\+[1-9]\d{7,14}$/;
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const auth=req.headers.get("Authorization")||""; if(!auth.startsWith("Bearer "))return json({error:"Missing authorization"},401);
 const uc=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const {data:{user}}=await uc.auth.getUser(); if(!user)return json({error:"Invalid token"},401);
 let b:{action?:string;thread_id?:string;message_id?:string}; try{b=await req.json()}catch{return json({error:"Invalid JSON"},400)}
 const service=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 if(b.action==="prepare"){
   if(!b.thread_id)return json({error:"thread_id is required"},400);
   const {data:thread}=await uc.from("communication_threads").select("id,organization_id,channel,phone_number").eq("id",b.thread_id).single();
   if(!thread||thread.channel!=="phone")return json({error:"Phone thread not found or not authorized"},403);
 const {data:membership}=await uc.from("organization_memberships").select("role,is_active").eq("organization_id",thread.organization_id).eq("user_id",user.id).eq("is_active",true).maybeSingle();
 if(!membership||membership.role==="read_only")return json({error:"Communication permission required"},403);
   const dest=(thread.phone_number||"").trim(), from=(Deno.env.get("OCULIVO_VOICE_FROM_NUMBER")||Deno.env.get("OCULIVO_SMS_FROM_NUMBER")||"").trim();
   if(!e164.test(dest)||!e164.test(from))return json({error:"Phone numbers are not configured in E.164 format"},409);
   const project=Deno.env.get("SIGNALWIRE_PROJECT_ID")||"", token=Deno.env.get("SIGNALWIRE_AUTH_TOKEN")||"", space=(Deno.env.get("SIGNALWIRE_SPACE_URL")||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
   if(!project||!token||!space)return json({error:"Phone provider is not configured"},503);
   const reference="oculivo:"+user.id;
   const tr=await fetch("https://"+space+"/api/fabric/subscribers/tokens",{method:"POST",headers:{Authorization:"Basic "+btoa(project+":"+token),"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({reference,display_name:user.email||reference})});
   if(!tr.ok)return json({error:"Could not start browser phone session"},502);
   const td=await tr.json(); if(!td?.token)return json({error:"Phone provider returned no token"},502);
   const now=new Date().toISOString(); const ins=await service.from("communication_messages").insert({organization_id:thread.organization_id,thread_id:thread.id,direction:"outbound",sender_name:"Oculivo",sender_address:from,body:"Outbound browser call",is_read:true,sent_by:user.id,created_at:now}).select("id").single();
   if(ins.error||!ins.data?.id)return json({error:"Could not create CRM call record"},500);
   await service.from("communication_threads").update({last_message_at:now}).eq("id",thread.id);
   return json({token:td.token,destination:dest,message_id:ins.data.id});
 }
 if(!b.message_id||!b.action)return json({error:"message_id and action are required"},400);
 const {data:m}=await service.from("communication_messages").select("id,sent_by").eq("id",b.message_id).single(); if(!m||m.sent_by!==user.id)return json({error:"Call record not authorized"},403);
 return json({status:b.action});
});