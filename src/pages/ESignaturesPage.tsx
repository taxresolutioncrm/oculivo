import { useEffect,useMemo,useState } from 'react'
import { supabase } from '../lib/supabase'

type Lang='en'|'es'
type FieldType='signature'|'initials'|'name'|'date'|'title'|'text'|'checkbox'
type Field={id:string,type:FieldType,label:string,page:number,x:number,y:number,w:number,h:number,required:boolean}
type Doc={id:string;title:string;signer_name:string;signer_email:string;status:string;sent_at?:string|null;opened_at?:string|null;signed_at?:string|null;declined_at?:string|null;decline_reason?:string|null;certificate_path?:string|null}
const placements={bottomLeft:{x:.08,y:.82,w:.30,h:.055},bottomCenter:{x:.35,y:.82,w:.30,h:.055},bottomRight:{x:.62,y:.82,w:.30,h:.055},center:{x:.35,y:.46,w:.30,h:.055}}
const fieldLabel=(type:FieldType,lang:Lang)=>({
 signature:lang==='es'?'Firma':'Signature',
 initials:lang==='es'?'Iniciales':'Initials',
 name:lang==='es'?'Nombre completo':'Full Name',
 date:lang==='es'?'Fecha de firma':'Date Signed',
 title:lang==='es'?'Título':'Title',
 text:lang==='es'?'Texto':'Text',
 checkbox:lang==='es'?'Casilla':'Checkbox'
}[type])
const toBase64=(file:File)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',').pop()||'');r.onerror=()=>reject(r.error);r.readAsDataURL(file)})
const buttonStyle={border:'1px solid #cbd5e1',background:'#fff',borderRadius:9,padding:'9px 12px',fontWeight:700,cursor:'pointer'} as const

export default function ESignaturesPage({lang}:{lang:Lang}){
 const [organizationId,setOrganizationId]=useState(()=>localStorage.getItem('oculivo-org-id')||'')
 useEffect(()=>{const h=(e:any)=>setOrganizationId(String(e.detail||localStorage.getItem('oculivo-org-id')||''));window.addEventListener('oculivo-org-change',h as EventListener);return()=>window.removeEventListener('oculivo-org-change',h as EventListener)},[])
 const initialField=()=>({id:crypto.randomUUID(),type:'signature' as FieldType,label:fieldLabel('signature',lang),page:1,...placements.bottomLeft,required:true})
 const [file,setFile]=useState<File|null>(null),[title,setTitle]=useState(''),[signerName,setSignerName]=useState(''),[signerEmail,setSignerEmail]=useState(''),[page,setPage]=useState(1),[type,setType]=useState<FieldType>('signature'),[placement,setPlacement]=useState<keyof typeof placements>('bottomLeft'),[fields,setFields]=useState<Field[]>([initialField()]),[docs,setDocs]=useState<Doc[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>setFields(v=>v.map(f=>({...f,label:fieldLabel(f.type,lang)}))),[lang])
 const scopeReady=Boolean(organizationId)
 const call=async(body:any)=>{const {data,error}=await supabase.functions.invoke('universal-esign',{body:{...body,organization_id:organizationId}});if(error||data?.error)throw new Error(data?.error||error?.message||(lang==='es'?'Falló la solicitud de firma electrónica':'E-sign request failed'));return data}
 const load=async()=>{try{const d=await call({action:'list'});setDocs(d.documents||[])}catch(e:any){setMessage(e.message)}}
 useEffect(()=>{if(scopeReady)void load()},[scopeReady])
 const canCreate=useMemo(()=>Boolean(scopeReady&&file&&title.trim()&&signerName.trim()&&signerEmail.trim()&&fields.some(f=>f.type==='signature')),[scopeReady,file,title,signerName,signerEmail,fields])
 function addField(){const box=placements[placement];setFields(v=>[...v,{id:crypto.randomUUID(),type,label:fieldLabel(type,lang),page:Math.max(1,page),...box,required:true}])}
 async function send(){if(!file||!canCreate)return;if(!file.name.toLowerCase().endsWith('.pdf')){setMessage(lang==='es'?'Elige un documento PDF.':'Choose a PDF document.');return}setBusy(true);setMessage('');try{const pdf_base64=await toBase64(file);const created=await call({action:'create',title:title.trim(),signer_name:signerName.trim(),signer_email:signerEmail.trim(),source_filename:file.name,pdf_base64,fields,origin:window.location.origin});await call({action:'send_invite',document_id:created.document.id,token:created.token,origin:window.location.origin});setMessage(lang==='es'?'Solicitud de firma enviada ✓':'Signing request sent ✓');setFile(null);setTitle('');setSignerName('');setSignerEmail('');setFields([initialField()]);await load()}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 async function openDoc(id:string,kind='document'){try{const d=await call({action:'open',document_id:id,kind});window.open(d.url,'_blank','noopener,noreferrer')}catch(e:any){setMessage(e.message)}}
 async function voidDoc(id:string){const reason=window.prompt(lang==='es'?'Motivo para anular este sobre:':'Reason for voiding this envelope:')||'';if(!window.confirm(lang==='es'?'¿Anular esta solicitud de firma?':'Void this signing request?'))return;try{await call({action:'void',document_id:id,reason});await load()}catch(e:any){setMessage(e.message)}}
 async function resend(id:string){setBusy(true);setMessage('');try{await call({action:'resend_invite',document_id:id,origin:window.location.origin});setMessage(lang==='es'?'Solicitud reenviada con un enlace nuevo ✓':'Request resent with a fresh signing link ✓');await load()}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 const status=(v:string)=>lang==='es'?({pending:'Pendiente',sent:'Enviado',viewed:'Visto',signed:'Firmado',declined:'Rechazado',voided:'Anulado'} as Record<string,string>)[v]||v:v
 return <main style={{padding:24,maxWidth:1200,margin:'0 auto',fontFamily:'Inter,system-ui,sans-serif',color:'#172033'}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',marginBottom:20,flexWrap:'wrap'}}><div><div style={{fontSize:12,fontWeight:900,letterSpacing:'.1em',textTransform:'uppercase',color:'#7C3AED'}}>Oculivo</div><h1 style={{margin:'5px 0'}}>{lang==='es'?'Firmas electrónicas':'E-Signatures'}</h1><p style={{margin:0,color:'#64748b'}}>{lang==='es'?'Crea, envía, reenvía, rastrea, anula y conserva sobres de firma seguros.':'Create, send, resend, track, void, and retain secure signing envelopes.'}</p></div><div style={{fontSize:12,color:'#475569'}}>{lang==='es'?'Evidencia y auditoría del sobre habilitadas':'Envelope evidence and audit enabled'}</div></div>
  {message&&<div style={{padding:11,borderRadius:8,background:'#eff6ff',marginBottom:14}}>{message}</div>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:18,alignItems:'start'}}>
   <section style={{border:'1px solid #e2e8f0',borderRadius:14,padding:18,background:'#fff'}}>
    <h2 style={{marginTop:0,fontSize:18}}>{lang==='es'?'Nuevo sobre':'New envelope'}</h2>
    <div style={{display:'grid',gap:10}}>
     <input type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/>
     <input placeholder={lang==='es'?'Título del documento':'Document title'} value={title} onChange={e=>setTitle(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:8}}/>
     <input placeholder={lang==='es'?'Nombre del firmante':'Signer name'} value={signerName} onChange={e=>setSignerName(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:8}}/>
     <input placeholder={lang==='es'?'Correo del firmante':'Signer email'} type="email" value={signerEmail} onChange={e=>setSignerEmail(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:8}}/>
     <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8}}>
      <select value={type} onChange={e=>setType(e.target.value as FieldType)}>{(['signature','initials','name','date','title','text','checkbox'] as FieldType[]).map(x=><option key={x} value={x}>{fieldLabel(x,lang)}</option>)}</select>
      <input aria-label={lang==='es'?'Página':'Page'} type="number" min={1} value={page} onChange={e=>setPage(Number(e.target.value)||1)}/>
      <select value={placement} onChange={e=>setPlacement(e.target.value as keyof typeof placements)}><option value="bottomLeft">{lang==='es'?'Abajo izquierda':'Bottom left'}</option><option value="bottomCenter">{lang==='es'?'Abajo centro':'Bottom center'}</option><option value="bottomRight">{lang==='es'?'Abajo derecha':'Bottom right'}</option><option value="center">{lang==='es'?'Centro':'Center'}</option></select>
      <button type="button" onClick={addField} style={buttonStyle}>{lang==='es'?'+ Campo':'+ Field'}</button>
     </div>
     <div>{fields.map(f=><div key={f.id} style={{display:'flex',gap:8,alignItems:'center',fontSize:12,padding:'5px 0'}}><strong>{f.label}</strong><span>{lang==='es'?'Página':'Page'} {f.page}</span><button type="button" aria-label={lang==='es'?'Eliminar campo':'Remove field'} onClick={()=>setFields(v=>v.filter(x=>x.id!==f.id))} style={{...buttonStyle,padding:'3px 7px'}}>×</button></div>)}</div>
     <button disabled={!canCreate||busy} onClick={send} style={{...buttonStyle,background:'#7C3AED',color:'#fff',borderColor:'#7C3AED',opacity:(!canCreate||busy)?.5:1}}>{busy?(lang==='es'?'Enviando…':'Sending…'):(lang==='es'?'Enviar para firma':'Send for Signature')}</button>
    </div>
   </section>
   <section style={{border:'1px solid #e2e8f0',borderRadius:14,padding:18,background:'#fff'}}>
    <h2 style={{marginTop:0,fontSize:18}}>{lang==='es'?'Sobres':'Envelopes'}</h2>
    {!docs.length?<p style={{color:'#64748b'}}>{lang==='es'?'Aún no hay sobres.':'No envelopes yet.'}</p>:<div style={{display:'grid',gap:9}}>{docs.map(d=><div key={d.id} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:12}}><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><strong>{d.title}</strong><span style={{color:'#64748b'}}>{d.signer_email}</span><span style={{marginLeft:'auto',fontSize:11,fontWeight:900,textTransform:'uppercase'}}>{status(d.status)}</span></div>{d.decline_reason&&<div style={{marginTop:6,color:'#991b1b',fontSize:12}}>{lang==='es'?'Rechazado':'Declined'}: {d.decline_reason}</div>}<div style={{display:'flex',gap:7,marginTop:9,flexWrap:'wrap'}}><button onClick={()=>openDoc(d.id)} style={buttonStyle}>{lang==='es'?'Abrir':'Open'}</button>{d.status==='signed'&&d.certificate_path&&<button onClick={()=>openDoc(d.id,'certificate')} style={buttonStyle}>{lang==='es'?'Certificado':'Certificate'}</button>}{['sent','viewed'].includes(d.status)&&<button disabled={busy} onClick={()=>void resend(d.id)} style={buttonStyle}>{lang==='es'?'Reenviar':'Resend'}</button>}{!['signed','voided','declined'].includes(d.status)&&<button disabled={busy} onClick={()=>voidDoc(d.id)} style={buttonStyle}>{lang==='es'?'Anular':'Void'}</button>}</div></div>)}</div>}
   </section>
  </div>
 </main>
}
