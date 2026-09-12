import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const BUCKET='universal-esign'
const MAX_BYTES=25*1024*1024
const enc=new TextEncoder()
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,'Content-Type':'application/json'}})
const now=()=>new Date().toISOString()
const ip=(r:Request)=>r.headers.get('cf-connecting-ip')||r.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||null
const safe=(v:string)=>String(v||'document.pdf').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,180)
const shaText=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('')
const shaBytes=async(b:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('')
function b64ToBytes(v:string){const clean=v.includes(',')?v.slice(v.indexOf(',')+1):v;const bin=atob(clean);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function secret(){return [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('')}

type Field={id:string,type:'signature'|'initials'|'name'|'date'|'title'|'text'|'checkbox',label?:string,page:number,x:number,y:number,w:number,h:number,required?:boolean}
type Meta={id:string;scope_id:string;brand:string;title:string;signer_name:string;signer_email:string;original_path:string;signed_path:string|null;certificate_path:string|null;fields:Field[];token_hash:string;status:'pending'|'sent'|'viewed'|'signed'|'declined'|'voided';created_at:string;sent_at:string|null;opened_at:string|null;signed_at:string|null;declined_at:string|null;decline_reason:string|null;voided_at:string|null;expires_at:string;created_by:string;audit:any[];source_sha256?:string|null;signed_sha256?:string|null;certificate_sha256?:string|null}

async function ensureBucket(admin:any){const {data}=await admin.storage.getBucket(BUCKET);if(!data)await admin.storage.createBucket(BUCKET,{public:false,fileSizeLimit:MAX_BYTES,allowedMimeTypes:['application/pdf','application/json']})}
async function readMeta(admin:any,scope:string,id:string):Promise<Meta|null>{const {data,error}=await admin.storage.from(BUCKET).download(`${scope}/meta/${id}.json`);if(error||!data)return null;return JSON.parse(await data.text())}
async function writeMeta(admin:any,m:Meta){const body=new Blob([JSON.stringify(m)],{type:'application/json'});const {error}=await admin.storage.from(BUCKET).upload(`${m.scope_id}/meta/${m.id}.json`,body,{contentType:'application/json',upsert:true});if(error)throw error}
function publicMeta(m:Meta,url:string|null){return {id:m.id,title:m.title,brand:m.brand,signer_name:m.signer_name,signer_email:m.signer_email,fields:m.fields,status:m.status,expires_at:m.expires_at,sent_at:m.sent_at,opened_at:m.opened_at,signed_at:m.signed_at,declined_at:m.declined_at,decline_reason:m.decline_reason,certificate_path:m.certificate_path,file_url:url}}
async function stamp(admin:any,m:Meta,signature:string,values:Record<string,string>){const {data,error}=await admin.storage.from(BUCKET).download(m.original_path);if(error||!data)throw error||new Error('Original document not found');const bytes=new Uint8Array(await data.arrayBuffer());const pdf=await PDFDocument.load(bytes);const font=await pdf.embedFont(StandardFonts.Helvetica),italic=await pdf.embedFont(StandardFonts.HelveticaOblique),pages=pdf.getPages();for(const f of m.fields){const p=pages[Math.max(0,Math.min(pages.length-1,(f.page||1)-1))];if(!p)continue;const {width,height}=p.getSize();let v=String(values[f.id]||'').trim();if(f.type==='signature')v=signature;if(f.type==='initials'&&!v)v=signature.split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,4).toUpperCase();if(f.type==='name'&&!v)v=m.signer_name||signature;if(f.type==='date'&&!v)v=new Date().toLocaleDateString('en-US');if(f.type==='checkbox')v=v?'☑':'☐';if(f.required!==false&&!v)throw new Error(`Required field missing: ${f.label||f.type}`);const x=Math.max(0,Math.min(1,Number(f.x||0)))*width,top=Math.max(0,Math.min(1,Number(f.y||0)))*height,bh=Math.max(.02,Math.min(.3,Number(f.h||.05)))*height,y=Math.max(3,height-top-bh),bw=Math.max(.03,Math.min(1,Number(f.w||.25)))*width,size=Math.max(8,Math.min(f.type==='signature'?18:12,bh*.55));p.drawText(v.slice(0,220),{x:x+3,y:y+Math.max(0,(bh-size)/2),size,font:f.type==='signature'?italic:font,color:rgb(.04,.12,.22),maxWidth:Math.max(10,bw-6)})}return new Uint8Array(await pdf.save())}

async function resolveScope(admin:any,user:any,b:any){
  const orgId=String(b.organization_id||'').trim();if(!orgId)throw new Error('Practice is required')
  const {data:membership}=await admin.from('organization_memberships').select('role,is_active').eq('organization_id',orgId).eq('user_id',user.id).eq('is_active',true).maybeSingle()
  if(!membership)throw new Error('Forbidden')
  if(!['owner','admin','manager','provider','staff'].includes(String(membership.role)))throw new Error('Forbidden')
  return {id:orgId,role:String(membership.role)}
}
async function sendInvite(admin:any,scope:any,meta:Meta,signUrl:string){
  const key=Deno.env.get('BREVO_API_KEY')||'',from=(Deno.env.get('OCULIVO_FROM_EMAIL')||'').trim();if(!key||!from)throw new Error('Oculivo email is not configured')
  const res=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':key,'Content-Type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{name:'Oculivo',email:from},replyTo:{email:from},to:[{email:meta.signer_email,name:meta.signer_name}],subject:'Signature Requested: '+meta.title,htmlContent:`<p>Hi ${meta.signer_name},</p><p>Your Oculivo practice has a document ready for review and electronic signature.</p><p><a href="${signUrl}">Review & Sign Document</a></p><p>This secure link expires in 14 days.</p>`})});if(!res.ok)throw new Error('Email provider rejected the signature request')
}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS})
 if(req.method!=='POST')return json({error:'POST only'},405)
 try{
  const url=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||''
  const admin=createClient(url,service,{auth:{persistSession:false}});await ensureBucket(admin)
  const b=await req.json().catch(()=>({}));const action=String(b.action||'')
  if(['load','sign','decline'].includes(action)){
   const [scope,id,raw]=String(b.token||'').split('.');if(!scope||!id||!raw)return json({error:'Invalid signing link'},400)
   const m=await readMeta(admin,scope,id);if(!m||m.token_hash!==await shaText(raw))return json({error:'Signing request not found'},404)
   if(m.status==='voided')return json({error:'This signing request was voided'},410)
   if(m.status==='declined')return json({error:'This signing request was declined'},410)
   if(new Date(m.expires_at).getTime()<Date.now()&&m.status!=='signed')return json({error:'This signing link expired'},410)
   if(action==='load'){if(m.status==='sent'){m.status='viewed';m.opened_at=now();m.audit.push({event:'viewed',at:m.opened_at,ip:ip(req),user_agent:req.headers.get('user-agent')});await writeMeta(admin,m)}const path=m.status==='signed'&&m.signed_path?m.signed_path:m.original_path;const {data,error}=await admin.storage.from(BUCKET).createSignedUrl(path,900);if(error||!data?.signedUrl)return json({error:'Could not open document'},500);return json({ok:true,document:publicMeta(m,data.signedUrl)})}
   if(action==='decline'){if(!['sent','viewed'].includes(m.status))return json({error:'Document is not available to decline'},409);const reason=String(b.reason||'').trim();if(!reason)return json({error:'A decline reason is required'},400);m.status='declined';m.declined_at=now();m.decline_reason=reason;m.audit.push({event:'declined',at:m.declined_at,reason,email:m.signer_email,ip:ip(req),user_agent:req.headers.get('user-agent')});await writeMeta(admin,m);return json({ok:true,declined_at:m.declined_at})}
   if(m.status==='signed')return json({ok:true,already_signed:true,signed_at:m.signed_at})
   if(!['sent','viewed'].includes(m.status))return json({error:'Document is not signable'},409)
   if(b.consent!==true)return json({error:'Electronic signature consent is required'},400)
   const signature=String(b.signature_name||'').trim();if(!signature)return json({error:'Signature name is required'},400)
   const values=b.values&&typeof b.values==='object'?b.values:{} as Record<string,string>
   const {data:orig,error:oe}=await admin.storage.from(BUCKET).download(m.original_path);if(oe||!orig)return json({error:'Could not load source PDF'},500)
   const sourceBytes=new Uint8Array(await orig.arrayBuffer()),sourceHash=await shaBytes(sourceBytes)
   const signed=await stamp(admin,m,signature,values),signedHash=await shaBytes(signed),signedPath=`${m.scope_id}/signed/${m.id}.pdf`
   const {error:up}=await admin.storage.from(BUCKET).upload(signedPath,signed,{contentType:'application/pdf',upsert:true});if(up)return json({error:'Could not save signed PDF'},500)
   const at=now(),cert=await PDFDocument.create(),cp=cert.addPage([612,792]),cf=await cert.embedFont(StandardFonts.Helvetica),cb=await cert.embedFont(StandardFonts.HelveticaBold);let cy=744;const line=(t:string,bold=false,size=10)=>{cp.drawText(t,{x:54,y:cy,size,font:bold?cb:cf,color:rgb(.08,.12,.18),maxWidth:504});cy-=size+9};line('Certificate of Completion',true,18);cy-=6;line('Envelope ID: '+m.id,true);line('Product: '+m.brand);line('Document: '+m.title);line('Signer: '+signature);line('Signer Email: '+m.signer_email);line('Completed At: '+at);line('IP Address: '+String(ip(req)||'Unavailable'));cy-=8;line('Source SHA-256',true);line(sourceHash,false,8);line('Signed PDF SHA-256',true);line(signedHash,false,8);line('Electronic Records & Signature Consent: Accepted',true)
   const certBytes=new Uint8Array(await cert.save()),certHash=await shaBytes(certBytes),certPath=`${m.scope_id}/certificates/${m.id}.pdf`;const {error:ce}=await admin.storage.from(BUCKET).upload(certPath,certBytes,{contentType:'application/pdf',upsert:true});if(ce)return json({error:'Could not save completion certificate'},500)
   m.status='signed';m.signed_path=signedPath;m.signed_at=at;m.source_sha256=sourceHash;m.signed_sha256=signedHash;m.certificate_path=certPath;m.certificate_sha256=certHash;m.audit.push({event:'signed',at,signer:signature,email:m.signer_email,consent:true,ip:ip(req),user_agent:req.headers.get('user-agent')},{event:'certificate_generated',at,actor:'system'});await writeMeta(admin,m);return json({ok:true,signed_at:at,certificate_path:certPath})
  }

  const auth=req.headers.get('Authorization')||'';const jwt=auth.replace(/^Bearer\s+/i,'');if(!jwt)return json({error:'Unauthorized'},401)
  const caller=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false}});const {data:{user},error:ue}=await caller.auth.getUser();if(ue||!user)return json({error:'Unauthorized'},401)
  const scope=await resolveScope(admin,user,b)

  if(action==='create'){
   const title=String(b.title||'').trim(),signerName=String(b.signer_name||'').trim(),signerEmail=String(b.signer_email||'').trim().toLowerCase(),bytes=b64ToBytes(String(b.pdf_base64||'')),fields=Array.isArray(b.fields)?b.fields as Field[]:[]
   if(!title||!signerName||!/^\S+@\S+\.\S+$/.test(signerEmail))return json({error:'Title, signer name, and valid signer email are required'},400)
   if(!bytes.length||bytes.length>MAX_BYTES)return json({error:'PDF is required and must be 25MB or smaller'},400)
   if(!fields.some(f=>f.type==='signature'))return json({error:'At least one signature field is required'},400)
   const id=crypto.randomUUID(),raw=secret(),path=`${scope.id}/original/${id}-${safe(String(b.source_filename||'document.pdf'))}`;const {error:up}=await admin.storage.from(BUCKET).upload(path,bytes,{contentType:'application/pdf',upsert:false});if(up)throw up;const at=now();const m:Meta={id,scope_id:scope.id,brand:'Oculivo',title,signer_name:signerName,signer_email:signerEmail,original_path:path,signed_path:null,certificate_path:null,fields,token_hash:await shaText(raw),status:'pending',created_at:at,sent_at:null,opened_at:null,signed_at:null,declined_at:null,decline_reason:null,voided_at:null,expires_at:new Date(Date.now()+14*86400000).toISOString(),created_by:user.id,audit:[{event:'created',at,actor:user.email}]};await writeMeta(admin,m);return json({ok:true,document:publicMeta(m,null),token:`${scope.id}.${id}.${raw}`,sign_url:`${String(b.origin||req.headers.get('origin')||'https://app.oculivo.com').replace(/\/$/,'')}/office-sign/${scope.id}.${id}.${raw}`})
  }
  if(action==='send_invite'){const m=await readMeta(admin,scope.id,String(b.document_id||''));if(!m)return json({error:'Document not found'},404);if(!['pending','sent','viewed'].includes(m.status))return json({error:'Document is not sendable'},409);const envelopeToken=String(b.token||'');const tokenParts=envelopeToken.split('.');if(tokenParts.length!==3||tokenParts[0]!==scope.id||tokenParts[1]!==m.id)return json({error:'Fresh signing token required'},400);const signUrl=`${String(b.origin||req.headers.get('origin')||'https://app.oculivo.com').replace(/\/$/,'')}/office-sign/${envelopeToken}`;await sendInvite(admin,scope,m,signUrl);const at=now(),wasSent=Boolean(m.sent_at);m.status='sent';m.sent_at=at;m.audit.push({event:wasSent?'resent':'sent',at,actor:user.email});await writeMeta(admin,m);return json({ok:true,status:'sent'})}
  if(action==='list'){const {data,error}=await admin.storage.from(BUCKET).list(`${scope.id}/meta`,{limit:200,sortBy:{column:'created_at',order:'desc'}});if(error)throw error;const docs=[];for(const f of data||[]){if(!f.name.endsWith('.json'))continue;const m=await readMeta(admin,scope.id,f.name.replace(/\.json$/,''));if(m)docs.push(publicMeta(m,null))}return json({ok:true,documents:docs})}
  if(action==='open'){const m=await readMeta(admin,scope.id,String(b.document_id||''));if(!m)return json({error:'Document not found'},404);const kind=String(b.kind||'document');const path=kind==='certificate'?m.certificate_path:(m.status==='signed'&&m.signed_path?m.signed_path:m.original_path);if(!path)return json({error:'Requested file is not available'},404);const {data,error}=await admin.storage.from(BUCKET).createSignedUrl(path,900);if(error||!data?.signedUrl)return json({error:'Could not open file'},500);return json({ok:true,url:data.signedUrl})}
  if(action==='void'){const m=await readMeta(admin,scope.id,String(b.document_id||''));if(!m)return json({error:'Document not found'},404);if(m.status==='signed')return json({error:'Signed documents cannot be voided'},409);m.status='voided';m.voided_at=now();m.audit.push({event:'voided',at:m.voided_at,actor:user.email,reason:String(b.reason||'').trim()||null});await writeMeta(admin,m);return json({ok:true})}
  return json({error:'Unknown action'},400)
 }catch(e){console.error('universal-esign',e);const m=String((e as Error)?.message||e);return json({error:m},m==='Unauthorized'?401:m==='Forbidden'?403:500)}
})
