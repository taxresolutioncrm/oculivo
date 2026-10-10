import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))return json({error:"Missing authorization"},401);

  const userClient=createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {global:{headers:{Authorization:auth}},auth:{persistSession:false}}
  );
  const {data:{user}}=await userClient.auth.getUser();
  if(!user)return json({error:"Invalid token"},401);

  let b:{organization_id?:string;patient_id?:string;test_email?:string;subject?:string;body?:string};
  try{b=await req.json()}catch{return json({error:"Invalid JSON"},400)}
  const organizationId=String(b.organization_id||"").trim();
  const subject=String(b.subject||"").trim();
  const body=String(b.body||"").trim();
  if(!organizationId||!subject||!body)return json({error:"organization_id, subject and body are required"},400);

  const {data:membership}=await userClient.from("organization_memberships")
    .select("role,is_active")
    .eq("organization_id",organizationId)
    .eq("user_id",user.id)
    .eq("is_active",true)
    .maybeSingle();
  if(!membership||!["owner","admin","manager","provider","staff"].includes(String(membership.role))){
    return json({error:"Communication permission required"},403);
  }

  let to="", patientId:string|null=null, recipientName="Recipient";
  if(b.patient_id){
    const {data:patient,error:patientError}=await userClient.from("patients")
      .select("id,organization_id,first_name,last_name,email")
      .eq("id",b.patient_id)
      .eq("organization_id",organizationId)
      .maybeSingle();
    if(patientError||!patient)return json({error:"Patient not found or not authorized"},404);
    to=String(patient.email||"").trim().toLowerCase();
    patientId=String(patient.id);
    recipientName=[patient.first_name,patient.last_name].filter(Boolean).join(" ").trim()||"Patient";
  }else{
    to=String(b.test_email||"").trim().toLowerCase();
    recipientName="Test Recipient";
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))return json({error:"A valid recipient email is required"},400);

  const from=(Deno.env.get("OCULIVO_FROM_EMAIL")||"").trim();
  const key=Deno.env.get("BREVO_API_KEY")||"";
  if(!from)return json({error:"Practice email is not configured"},409);
  if(!key)return json({error:"Email provider is not configured"},503);

  const service=createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {auth:{persistSession:false}}
  );

  let threadId:string|null=null;
  const existing=await service.from("communication_threads")
    .select("id")
    .eq("organization_id",organizationId)
    .eq("channel","email")
    .eq("email_address",to)
    .order("last_message_at",{ascending:false,nullsFirst:false})
    .limit(1)
    .maybeSingle();
  if(existing.data?.id)threadId=String(existing.data.id);

  const now=new Date().toISOString();
  if(!threadId){
    const created=await service.from("communication_threads").insert({
      organization_id:organizationId,
      channel:"email",
      email_address:to,
      subject,
      status:"open",
      last_message_at:now
    }).select("id").single();
    if(created.error||!created.data?.id){
      console.error("Email blast thread creation failed",created.error);
      return json({error:"Could not create the CRM email thread"},500);
    }
    threadId=String(created.data.id);
  }

  const provider=await fetch("https://api.brevo.com/v3/smtp/email",{
    method:"POST",
    headers:{accept:"application/json","api-key":key,"content-type":"application/json"},
    body:JSON.stringify({
      sender:{name:"Oculivo",email:from},
      to:[{email:to,name:recipientName}],
      subject,
      textContent:body,
      replyTo:{email:from}
    })
  });
  if(!provider.ok){
    console.error("Brevo",provider.status,await provider.text());
    return json({error:"Email provider rejected the message"},502);
  }

  const logged=await service.from("communication_messages").insert({
    organization_id:organizationId,
    thread_id:threadId,
    direction:"outbound",
    sender_name:"Oculivo",
    sender_address:from,
    body,
    is_read:true,
    sent_by:user.id,
    created_at:now
  }).select("id").single();
  if(logged.error)return json({error:"Email sent but CRM logging failed"},500);
  await service.from("communication_threads").update({subject,last_message_at:now}).eq("id",threadId);

  return json({status:"sent",thread_id:threadId,message_id:logged.data?.id,patient_id:patientId});
});
