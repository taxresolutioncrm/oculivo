import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const auth=req.headers.get("Authorization")||""; if(!auth.startsWith("Bearer "))return json({error:"Missing authorization"},401);
 const uc=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const {data:{user}}=await uc.auth.getUser(); if(!user)return json({error:"Invalid token"},401);
 let b:any; try{b=await req.json()}catch{return json({error:"Invalid JSON"},400)}
 const org=String(b.organization_id||""); if(!org)return json({error:"organization_id required"},400);
 const {data:mem}=await uc.from("organization_memberships").select("role,is_active").eq("organization_id",org).eq("user_id",user.id).eq("is_active",true).maybeSingle(); if(!mem)return json({error:"Not authorized for this practice"},403);
 const key=Deno.env.get("OPENAI_API_KEY")||""; if(!key)return json({error:"AI provider is not configured"},503);
 const system="You are Oculivo AI, an assistant inside an eye-care practice CRM. Help with workflow guidance, summaries, scheduling, billing, communications, optical and operational questions. Never claim to change passwords or payroll. Never expose data from another organization. Do not diagnose medical conditions or replace clinician judgment.";
 const history=Array.isArray(b.history)?b.history.slice(-10):[];
 const messages=[{role:"system",content:system},...history.map((m:any)=>({role:m.role==="assistant"?"assistant":"user",content:String(m.content||"").slice(0,4000)})),{role:"user",content:String(b.message||"").slice(0,4000)}];
 const pr=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("OCULIVO_AI_MODEL")||"gpt-5.1-mini",messages,temperature:0.2})});
 if(!pr.ok){console.error("AI",pr.status,await pr.text());return json({error:"AI provider request failed"},502)}
 const d=await pr.json(); const answer=d?.choices?.[0]?.message?.content||""; return json({answer});
});