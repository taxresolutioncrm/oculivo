import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const e164=/^\+[1-9]\d{7,14}$/;
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization")||""; if(!auth.startsWith("Bearer "))return json({error:"Missing authorization"},401);
 const userClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const {data:{user}}=await userClient.auth.getUser(); if(!user)return json({error:"Invalid token"},401);
 let b:{thread_id?:string;body?:string}; try{b=await req.json()}catch{return json({error:"Invalid JSON"},400)}
 const body=(b.body||"").trim(); if(!b.thread_id||!body)return json({error:"thread_id and body are required"},400);
 const {data:thread}=await userClient.from("communication_threads").select("id,organization_id,channel,phone_number").eq("id",b.thread_id).single();
 if(!thread||thread.channel!=="sms")return json({error:"SMS thread not found or not authorized"},403);
 const {data:membership}=await userClient.from("organization_memberships").select("role,is_active").eq("organization_id",thread.organization_id).eq("user_id",user.id).eq("is_active",true).maybeSingle();
 if(!membership||membership.role==="read_only")return json({error:"Communication permission required"},403);
 const to=(thread.phone_number||"").trim(); const from=(Deno.env.get("OCULIVO_SMS_FROM_NUMBER")||"").trim();
 if(!e164.test(to)||!e164.test(from))return json({error:"SMS phone numbers are not configured in E.164 format"},409);
 const project=Deno.env.get("SIGNALWIRE_PROJECT_ID")||"", token=Deno.env.get("SIGNALWIRE_AUTH_TOKEN")||"", space=(Deno.env.get("SIGNALWIRE_SPACE_URL")||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
 if(!project||!token||!space)return json({error:"SMS provider is not configured"},503);
 const form=new URLSearchParams({From:from,To:to,Body:body});
 const pr=await fetch("https://"+space+"/api/laml/2010-04-01/Accounts/"+encodeURIComponent(project)+"/Messages.json",{method:"POST",headers:{Authorization:"Basic "+btoa(project+":"+token),"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},body:form.toString()});
 if(!pr.ok){console.error("SignalWire SMS",pr.status,await pr.text());return json({error:"SMS provider rejected the message"},502)}
 const pdata=await pr.json().catch(()=>({})); const service=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 const now=new Date().toISOString(); const ins=await service.from("communication_messages").insert({organization_id:thread.organization_id,thread_id:thread.id,direction:"outbound",sender_name:"Oculivo",sender_address:from,body,is_read:true,sent_by:user.id,created_at:now}).select("id").single();
 if(ins.error)return json({error:"SMS sent but CRM logging failed"},500);
 await service.from("communication_threads").update({last_message_at:now}).eq("id",thread.id);
 return json({status:"sent",message_id:ins.data?.id,provider_id:pdata.sid||pdata.Sid||null});
});