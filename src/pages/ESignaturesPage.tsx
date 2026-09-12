import { useEffect,useMemo,useState } from 'react'
import { supabase } from '../lib/supabase'


type FieldType='signature'|'initials'|'name'|'date'|'title'|'text'|'checkbox'
type Field={id:string,type:FieldType,label:string,page:number,x:number,y:number,w:number,h:number,required:boolean}
type Doc={id:string;title:string;signer_name:string;signer_email:string;status:string;sent_at?:string|null;opened_at?:string|null;signed_at?:string|null;declined_at?:string|null;decline_reason?:string|null;certificate_path?:string|null}
const placements={bottomLeft:{x:.08,y:.82,w:.30,h:.055},bottomCenter:{x:.35,y:.82,w:.30,h:.055},bottomRight:{x:.62,y:.82,w:.30,h:.055},center:{x:.35,y:.46,w:.30,h:.055}}
const labelFor=(t:FieldType)=>({signature:'Signature',initials:'Initials',name:'Full Name',date:'Date Signed',title:'Title',text:'Text',checkbox:'Checkbox'}[t])
const toBase64=(file:File)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',').pop()||'');r.onerror=()=>reject(r.error);r.readAsDataURL(file)})
const buttonStyle={border:'1px solid #cbd5e1',background:'#fff',borderRadius:9,padding:'9px 12px',fontWeight:700,cursor:'pointer'} as const

export default function ESignaturesPage(){
 const [organizationId,setOrganizationId]=useState(()=>localStorage.getItem('oculivo-org-id')||'');useEffect(()=>{const h=(e:any)=>setOrganizationId(String(e.detail||localStorage.getItem('oculivo-org-id')||''));window.addEventListener('oculivo-org-change',h as EventListener);return()=>window.removeEventListener('oculivo-org-change',h as EventListener)},[])
 const [file,setFile]=useState<File|null>(null),[title,setTitle]=useState(''),[signerName,setSignerName]=useState(''),[signerEmail,setSignerEmail]=useState(''),[page,setPage]=useState(1),[type,setType]=useState<FieldType>('signature'),[placement,setPlacement]=useState<keyof typeof placements>('bottomLeft'),[fields,setFields]=useState<Field[]>([{id:crypto.randomUUID(),type:'signature',label:'Signature',page:1,...placements.bottomLeft,required:true}]),[docs,setDocs]=useState<Doc[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const scopeReady=Boolean(organizationId)
 const call=async(body:any)=>{const {data,error}=await supabase.functions.invoke('universal-esign',{body:{...body,organization_id:organizationId}});if(error||data?.error)throw new Error(data?.error||error?.message||'E-sign request failed');return data}
 const load=async()=>{try{const d=await call({action:'list'});setDocs(d.documents||[])}catch(e:any){setMessage(e.message)}}
 useEffect(()=>{if(scopeReady)void load()},[scopeReady])
 const canCreate=useMemo(()=>Boolean(scopeReady&&file&&title.trim()&&signerName.trim()&&signerEmail.trim()&&fields.some(f=>f.type==='signature')),[scopeReady,file,title,signerName,signerEmail,fields])
 function addField(){const box=placements[placement];setFields(v=>[...v,{id:crypto.randomUUID(),type,label:labelFor(type),page:Math.max(1,page),...box,required:true}])}
 async function send(){if(!file||!canCreate)return;if(!file.name.toLowerCase().endsWith('.pdf')){setMessage('Choose a PDF document.');return}setBusy(true);setMessage('');try{const pdf_base64=await toBase64(file);const created=await call({action:'create',title:title.trim(),signer_name:signerName.trim(),signer_email:signerEmail.trim(),source_filename:file.name,pdf_base64,fields,origin:window.location.origin});await call({action:'send_invite',document_id:created.document.id,token:created.token,origin:window.location.origin});setMessage('Signing request sent ✓');setFile(null);setTitle('');setSignerName('');setSignerEmail('');setFields([{id:crypto.randomUUID(),type:'signature',label:'Signature',page:1,...placements.bottomLeft,required:true}]);await load()}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 async function openDoc(id:string,kind='document'){try{const d=await call({action:'open',document_id:id,kind});window.open(d.url,'_blank','noopener,noreferrer')}catch(e:any){setMessage(e.message)}}
 async function voidDoc(id:string){const reason=window.prompt('Reason for voiding this envelope:')||'';if(!window.confirm('Void this signing request?'))return;try{await call({action:'void',document_id:id,reason});await load()}catch(e:any){setMessage(e.message)}}
 return <main style={{padding:24,maxWidth:1200,margin:'0 auto',fontFamily:'Inter,system-ui,sans-serif',color:'#172033'}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'end',marginBottom:20}}><div><div style={{fontSize:12,fontWeight:900,letterSpacing:'.1em',textTransform:'uppercase',color:'#7C3AED'}}>Oculivo</div><h1 style={{margin:'5px 0'}}>E-Signatures</h1><p style={{margin:0,color:'#64748b'} }>Create, send, track, correct, void, and retain secure signing envelopes.</p></div><div style={{fontSize:12,color:'#475569'}}>DocuSign-style envelope evidence enabled</div></div>
  {message&&<div style={{padding:11,borderRadius:8,background:'#eff6ff',marginBottom:14}}>{message}</div>}
  <div style={{display:'grid',gridTemplateColumns:'minmax(320px,420px) 1fr',gap:18,alignItems:'start'}}>
   <section style={{border:'1px solid #e2e8f0',borderRadius:14,padding:18,background:'#fff'}}>
    <h2 style={{marginTop:0,fontSize:18}}>New envelope</h2>
    <div style={{display:'grid',gap:10}}>
     <input type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/>
     <input placeholder="Document title" value={title} onChange={e=>setTitle(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:8}}/>
     <input placeholder="Signer name" value={signerName} onChange={e=>setSignerName(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:8}}/>
     <input placeholder="Signer email" type="email" value={signerEmail} onChange={e=>setSignerEmail(e.target.value)} style={{padding:10,border:'1px solid #cbd5e1',borderRadius:8}}/>
     <div style={{display:'grid',gridTemplateColumns:'1fr 80px 1fr auto',gap:8}}>
      <select value={type} onChange={e=>setType(e.target.value as FieldType)}>{(['signature','initials','name','date','title','text','checkbox'] as FieldType[]).map(x=><option key={x} value={x}>{labelFor(x)}</option>)}</select>
      <input type="number" min={1} value={page} onChange={e=>setPage(Number(e.target.value)||1)}/>
      <select value={placement} onChange={e=>setPlacement(e.target.value as keyof typeof placements)}><option value="bottomLeft">Bottom left</option><option value="bottomCenter">Bottom center</option><option value="bottomRight">Bottom right</option><option value="center">Center</option></select>
      <button type="button" onClick={addField} style={buttonStyle}>+ Field</button>
     </div>
     <div>{fields.map(f=><div key={f.id} style={{display:'flex',gap:8,alignItems:'center',fontSize:12,padding:'5px 0'}}><strong>{f.label}</strong><span>Page {f.page}</span><button onClick={()=>setFields(v=>v.filter(x=>x.id!==f.id))} style={{...buttonStyle,padding:'3px 7px'}}>×</button></div>)}</div>
     <button disabled={!canCreate||busy} onClick={send} style={{...buttonStyle,background:'#7C3AED',color:'#fff',borderColor:'#7C3AED',opacity:(!canCreate||busy)?.5:1}}>{busy?'Sending…':'Send for Signature'}</button>
    </div>
   </section>
   <section style={{border:'1px solid #e2e8f0',borderRadius:14,padding:18,background:'#fff'}}>
    <h2 style={{marginTop:0,fontSize:18}}>Envelopes</h2>
    {!docs.length?<p style={{color:'#64748b'}}>No envelopes yet.</p>:<div style={{display:'grid',gap:9}}>{docs.map(d=><div key={d.id} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:12}}><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><strong>{d.title}</strong><span style={{color:'#64748b'}}>{d.signer_email}</span><span style={{marginLeft:'auto',fontSize:11,fontWeight:900,textTransform:'uppercase'}}>{d.status}</span></div>{d.decline_reason&&<div style={{marginTop:6,color:'#991b1b',fontSize:12}}>Declined: {d.decline_reason}</div>}<div style={{display:'flex',gap:7,marginTop:9,flexWrap:'wrap'}}><button onClick={()=>openDoc(d.id)} style={buttonStyle}>Open</button>{d.status==='signed'&&d.certificate_path&&<button onClick={()=>openDoc(d.id,'certificate')} style={buttonStyle}>Certificate</button>}{!['signed','voided','declined'].includes(d.status)&&<button onClick={()=>voidDoc(d.id)} style={buttonStyle}>Void</button>}</div></div>)}</div>}
   </section>
  </div>
 </main>
}
