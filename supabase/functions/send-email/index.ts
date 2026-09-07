import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization")||""; if(!auth.startsWith("Bearer "))return json({error:"Missing authorization"},401);
 const userClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const {data:{user}}=await userClient.auth.getUser(); if(!user)return json({error:"Invalid token"},401);
 let b:{thread_id?:string;body?:string;subject?:string}; try{b=await req.json()}catch{return json({error:"Invalid JSON"},400)}
 const body=(b.body||"").trim(); if(!b.thread_id||!body)return json({error:"thread_id and body are required"},400);
 const {data:thread}=await userClient.from("communication_threads").select("id,organization_id,channel,email_address,subject").eq("id",b.thread_id).single();
 if(!thread||thread.channel!=="email")return json({error:"Email thread not found or not authorized"},403);
 const {data:membership}=await userClient.from("organization_memberships").select("role,is_active").eq("organization_id",thread.organization_id).eq("user_id",user.id).eq("is_active",true).maybeSingle();
 if(!membership||membership.role==="read_only")return json({error:"Communication permission required"},403);
 const to=(thread.email_address||"").trim(), from=(Deno.env.get("OCULIVO_FROM_EMAIL")||"").trim(), key=Deno.env.get("BREVO_API_KEY")||"";
 if(!to||!from)return json({error:"Email addresses are not configured"},409); if(!key)return json({error:"Email provider is not configured"},503);
 const subject=(b.subject||thread.subject||"Oculivo message").trim();
 const pr=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{accept:"application/json","api-key":key,"content-type":"application/json"},body:JSON.stringify({sender:{name:"Oculivo",email:from},to:[{email:to}],subject,textContent:body,replyTo:{email:from}})});
 if(!pr.ok){console.error("Brevo",pr.status,await pr.text());return json({error:"Email provider rejected the message"},502)}
 const service=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 const now=new Date().toISOString(); const ins=await service.from("communication_messages").insert({organization_id:thread.organization_id,thread_id:thread.id,direction:"outbound",sender_name:"Oculivo",sender_address:from,body,is_read:true,sent_by:user.id,created_at:now}).select("id").single();
 if(ins.error)return json({error:"Email sent but CRM logging failed"},500);
 await service.from("communication_threads").update({last_message_at:now}).eq("id",thread.id);
 return json({status:"sent",message_id:ins.data?.id});
});