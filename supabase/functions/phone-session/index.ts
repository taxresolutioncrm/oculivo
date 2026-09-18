import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const e164=/^\+[1-9]\d{7,14}$/;
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization")||""; if(!auth.startsWith("Bearer "))return json({error:"Missing authorization"},401);
 const uc=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const {data:{user}}=await uc.auth.getUser(); if(!user)return json({error:"Invalid token"},401);
 let b:{action?:string;thread_id?:string;message_id?:string;organization_id?:string;to?:string}; try{b=await req.json()}catch{return json({error:"Invalid JSON"},400)}
 const service=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 if(b.action==="prepare"){
   let thread:any=null;
   if(b.thread_id){
     const result=await uc.from("communication_threads").select("id,organization_id,channel,phone_number").eq("id",b.thread_id).single();
     thread=result.data;
     if(!thread||thread.channel!=="phone")return json({error:"Phone thread not found or not authorized"},403);
   }else{
     const orgId=String(b.organization_id||"").trim(),to=String(b.to||"").trim();
     if(!orgId||!e164.test(to))return json({error:"organization_id and E.164 destination are required"},400);
     const {data:membership}=await uc.from("organization_memberships").select("role,is_active").eq("organization_id",orgId).eq("user_id",user.id).eq("is_active",true).maybeSingle();
     if(!membership||!["owner","admin","manager","provider","staff"].includes(String(membership.role)))return json({error:"Communication permission required"},403);
     const existing=await service.from("communication_threads").select("id,organization_id,channel,phone_number").eq("organization_id",orgId).eq("channel","phone").eq("phone_number",to).order("last_message_at",{ascending:false}).limit(1).maybeSingle();
     if(existing.error)return json({error:"Could not look up phone conversation"},500);
     thread=existing.data;
     if(!thread){
       const now=new Date().toISOString();
       const created=await service.from("communication_threads").insert({organization_id:orgId,channel:"phone",phone_number:to,subject:to,status:"open",last_message_at:now}).select("id,organization_id,channel,phone_number").single();
       if(created.error||!created.data)return json({error:"Could not create phone conversation"},500);
       thread=created.data;
     }
   }
   const {data:membership}=await uc.from("organization_memberships").select("role,is_active").eq("organization_id",thread.organization_id).eq("user_id",user.id).eq("is_active",true).maybeSingle();
   if(!membership||!["owner","admin","manager","provider","staff"].includes(String(membership.role)))return json({error:"Communication permission required"},403);
   const dest=(thread.phone_number||"").trim(), from=(Deno.env.get("OCULIVO_VOICE_FROM_NUMBER")||Deno.env.get("OCULIVO_SMS_FROM_NUMBER")||"").trim();
   if(!e164.test(dest)||!e164.test(from))return json({error:"Phone numbers are not configured in E.164 format"},409);
   const project=Deno.env.get("SIGNALWIRE_PROJECT_ID")||"", token=Deno.env.get("SIGNALWIRE_AUTH_TOKEN")||"", space=(Deno.env.get("SIGNALWIRE_SPACE_URL")||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
   const applicationId=(Deno.env.get("SIGNALWIRE_APPLICATION_ID")||"").trim();
   if(!project||!token||!space)return json({error:"Phone provider is not configured"},503);
   const reference="oculivo:"+user.id;
   const tokenBody:Record<string,string>={reference,display_name:user.email||reference};
   if(applicationId)tokenBody.application_id=applicationId;
   const tr=await fetch("https://"+space+"/api/fabric/subscribers/tokens",{method:"POST",headers:{Authorization:"Basic "+btoa(project+":"+token),"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(tokenBody)});
   if(!tr.ok){console.error("SignalWire subscriber token",tr.status,await tr.text());return json({error:"Could not start browser phone session"},502)}
   const td=await tr.json(); if(!td?.token)return json({error:"Phone provider returned no token"},502);
   const now=new Date().toISOString(); const ins=await service.from("communication_messages").insert({organization_id:thread.organization_id,thread_id:thread.id,direction:"outbound",sender_name:"Oculivo",sender_address:from,body:"Outbound browser call",is_read:true,sent_by:user.id,created_at:now}).select("id").single();
   if(ins.error||!ins.data?.id)return json({error:"Could not create CRM call record"},500);
   await service.from("communication_threads").update({last_message_at:now}).eq("id",thread.id);
   return json({token:td.token,destination:dest,caller_id:from,message_id:ins.data.id,thread_id:thread.id});
 }
 if(!b.message_id||!b.action)return json({error:"message_id and action are required"},400);
 if(!["connected","complete","failed"].includes(b.action))return json({error:"Invalid call status action"},400);
 const {data:m}=await service.from("communication_messages").select("id,sent_by,thread_id,organization_id").eq("id",b.message_id).single(); if(!m||m.sent_by!==user.id)return json({error:"Call record not authorized"},403);
 const label=b.action==="connected"?"Connected":b.action==="complete"?"Completed":"Failed";
 const at=new Date().toISOString();
 const upd=await service.from("communication_messages").update({body:"Outbound browser call · "+label}).eq("id",m.id).eq("sent_by",user.id);
 if(upd.error)return json({error:"Could not update CRM call status"},500);
 if(m.thread_id)await service.from("communication_threads").update({last_message_at:at}).eq("id",m.thread_id).eq("organization_id",m.organization_id);
 return json({status:b.action});
});