import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization")||""; if(!auth.startsWith("Bearer "))return json({error:"Missing authorization"},401);
 const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const service=createClient(url,serviceKey,{auth:{persistSession:false}});
 const {data:{user}}=await userClient.auth.getUser(); if(!user)return json({error:"Invalid token"},401);
 let b:{thread_id?:string;organization_id?:string;to?:string;body?:string;subject?:string}; try{b=await req.json()}catch{return json({error:"Invalid JSON"},400)}
 const body=(b.body||"").trim(); if(!body)return json({error:"body is required"},400);
 let thread:any=null;
 if(b.thread_id){
   const result=await userClient.from("communication_threads").select("id,organization_id,channel,email_address,subject").eq("id",b.thread_id).single();
   thread=result.data;
   if(!thread||thread.channel!=="email")return json({error:"Email thread not found or not authorized"},403);
 }else{
   const orgId=String(b.organization_id||"").trim(),to=String(b.to||"").trim().toLowerCase();
   if(!orgId||!validEmail.test(to))return json({error:"organization_id and valid recipient email are required"},400);
   const {data:membership}=await userClient.from("organization_memberships").select("role,is_active").eq("organization_id",orgId).eq("user_id",user.id).eq("is_active",true).maybeSingle();
   if(!membership||!["owner","admin","manager","provider","staff"].includes(String(membership.role)))return json({error:"Communication permission required"},403);
   const existing=await service.from("communication_threads").select("id,organization_id,channel,email_address,subject").eq("organization_id",orgId).eq("channel","email").eq("email_address",to).order("last_message_at",{ascending:false}).limit(1).maybeSingle();
   if(existing.error)return json({error:"Could not look up email conversation"},500);
   thread=existing.data;
   if(!thread){
     const now=new Date().toISOString();
     const created=await service.from("communication_threads").insert({organization_id:orgId,channel:"email",email_address:to,subject:String(b.subject||"").trim()||to,status:"open",last_message_at:now}).select("id,organization_id,channel,email_address,subject").single();
     if(created.error||!created.data)return json({error:"Could not create email conversation"},500);
     thread=created.data;
   }
 }
 const {data:membership}=await userClient.from("organization_memberships").select("role,is_active").eq("organization_id",thread.organization_id).eq("user_id",user.id).eq("is_active",true).maybeSingle();
 if(!membership||!["owner","admin","manager","provider","staff"].includes(String(membership.role)))return json({error:"Communication permission required"},403);
 const to=(thread.email_address||"").trim();
 const endpoint=await service.from("communication_endpoints").select("address").eq("organization_id",thread.organization_id).eq("kind","email").eq("is_active",true).order("is_primary",{ascending:false}).limit(1).maybeSingle();
 const from=String(endpoint.data?.address||Deno.env.get("OCULIVO_FROM_EMAIL")||"").trim(), key=Deno.env.get("BREVO_API_KEY")||"";
 if(!validEmail.test(to)||!validEmail.test(from))return json({error:"Email addresses are not configured"},409); if(!key)return json({error:"Email provider is not configured"},503);
 const subject=(b.subject||thread.subject||"Oculivo message").trim();
 const pr=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{accept:"application/json","api-key":key,"content-type":"application/json"},body:JSON.stringify({sender:{name:"Oculivo",email:from},to:[{email:to}],subject,textContent:body,replyTo:{email:from}})});
 if(!pr.ok){console.error("Brevo",pr.status,await pr.text());return json({error:"Email provider rejected the message"},502)}
 const pdata=await pr.json().catch(()=>({})); const providerId=String(pdata?.messageId||pdata?.message_id||"").trim();
 const now=new Date().toISOString(); const ins=await service.from("communication_messages").insert({organization_id:thread.organization_id,thread_id:thread.id,direction:"outbound",sender_name:"Oculivo",sender_address:from,body,is_read:true,sent_by:user.id,created_at:now,provider_message_id:providerId?"brevo:"+providerId:null}).select("id").single();
 if(ins.error)return json({error:"Email sent but CRM logging failed"},500);
 await service.from("communication_threads").update({last_message_at:now,subject}).eq("id",thread.id).eq("organization_id",thread.organization_id);
 return json({status:"sent",message_id:ins.data?.id,provider_id:providerId||null,thread_id:thread.id});
});