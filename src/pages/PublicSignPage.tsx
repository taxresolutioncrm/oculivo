import { useEffect,useMemo,useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
type Lang='en'|'es'
type Field={id:string;type:string;label?:string;required?:boolean}

export default function PublicSignPage(){
 const {token=''}=useParams()
 const [lang,setLang]=useState<Lang>(()=>localStorage.getItem('oculivo-lang')==='es'||(!localStorage.getItem('oculivo-lang')&&navigator.language.toLowerCase().startsWith('es'))?'es':'en')
 const [doc,setDoc]=useState<any>(null),[values,setValues]=useState<Record<string,string>>({}),[signature,setSignature]=useState(''),[consent,setConsent]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),[declined,setDeclined]=useState(false)
 useEffect(()=>{localStorage.setItem('oculivo-lang',lang);document.documentElement.lang=lang},[lang])
 const copy=lang==='es'?{
  failed:'Falló la solicitud de firma',loading:'Cargando documento seguro…',title:'Firma electrónica de Oculivo',
  prepared:'Preparado para',signed:'✓ Firmado',declined:'Rechazado',
  completed:'Completado. El PDF firmado y el Certificado de finalización están protegidos con el registro de auditoría del sobre.',
  declinedMsg:'Rechazaste este acuerdo. El motivo queda registrado en el historial de auditoría.',
  preview:'Vista previa del documento no disponible.',legal:'Nombre legal',
  consent:'Acepto usar registros y firmas electrónicas y mi intención es que la firma que adopto sea legalmente vinculante para este documento.',
  decline:'Rechazar',finish:'Finalizar y firmar',submitting:'Enviando…',
  declinePrompt:'Indica al remitente por qué rechazas firmar este documento:',reasonRequired:'Se requiere un motivo para rechazar.',
  iframe:'Documento para firmar',secure:'Firma electrónica segura de Oculivo'
 }:{
  failed:'Signing request failed',loading:'Loading secure document…',title:'Oculivo E-Signature',
  prepared:'Prepared for',signed:'✓ Signed',declined:'Declined',
  completed:'Completed. The signed PDF and Certificate of Completion are locked with the envelope audit record.',
  declinedMsg:'You declined this agreement. The reason is recorded in the audit history.',
  preview:'Document preview unavailable.',legal:'Legal name',
  consent:'I agree to use electronic records and signatures and intend the signature I adopt to be legally binding for this document.',
  decline:'Decline',finish:'Finish & Sign',submitting:'Submitting…',
  declinePrompt:'Please tell the sender why you are declining to sign this document:',reasonRequired:'A reason is required to decline.',
  iframe:'Document to sign',secure:'Oculivo secure e-signature'
 }
 async function call(body:any){const {data,error:e}=await supabase.functions.invoke('universal-esign',{body});if(e||data?.error)throw new Error(data?.error||e?.message||copy.failed);return data}
 async function load(){setLoading(true);setError('');try{const d=await call({action:'load',token});setDoc(d.document);setSignature(d.document.signer_name||'');setDone(d.document.status==='signed');setDeclined(d.document.status==='declined');const auto:Record<string,string>={};for(const f of d.document.fields||[]){if(f.type==='date')auto[f.id]=new Date().toLocaleDateString(lang==='es'?'es-DO':'en-US');if(f.type==='name')auto[f.id]=d.document.signer_name||'';if(f.type==='initials')auto[f.id]=(d.document.signer_name||'').split(/\s+/).filter(Boolean).map((x:string)=>x[0]).join('').toUpperCase()}setValues(auto)}catch(e:any){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{void load()},[token,lang])
 const ready=useMemo(()=>Boolean(signature.trim()&&consent&&(doc?.fields||[]).every((f:Field)=>f.required===false||['signature','initials','name','date'].includes(f.type)||String(values[f.id]||'').trim())),[signature,consent,doc,values])
 async function sign(){if(!ready)return;setBusy(true);setError('');try{await call({action:'sign',token,signature_name:signature.trim(),values,consent:true});setDone(true)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function decline(){const reason=window.prompt(copy.declinePrompt);if(reason===null)return;if(!reason.trim()){setError(copy.reasonRequired);return}setBusy(true);setError('');try{await call({action:'decline',token,reason:reason.trim()});setDeclined(true)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 if(loading)return <main style={{maxWidth:900,margin:'60px auto',padding:24}}>{copy.loading}</main>
 if(error&&!doc)return <main style={{maxWidth:700,margin:'60px auto',padding:24}}><div style={{display:'flex',justifyContent:'flex-end',gap:6}}><button onClick={()=>setLang('en')}>EN</button><button onClick={()=>setLang('es')}>ES</button></div><h1>{copy.title}</h1><div>{error}</div></main>
 return <main style={{maxWidth:1100,margin:'0 auto',padding:'32px 20px 60px',fontFamily:'Inter,system-ui,sans-serif',color:'#172033'}}>
  <header style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'center',marginBottom:20,flexWrap:'wrap'}}><div><div style={{fontSize:12,fontWeight:900,color:'#7C3AED',textTransform:'uppercase',letterSpacing:'.1em'}}>{copy.secure}</div><h1 style={{margin:'6px 0'}}>{doc?.title}</h1><div style={{color:'#64748b'}}>{copy.prepared} {doc?.signer_name} · {doc?.signer_email}</div></div><div style={{display:'flex',alignItems:'center',gap:8}}><button onClick={()=>setLang('en')} disabled={lang==='en'}>EN</button><button onClick={()=>setLang('es')} disabled={lang==='es'}>ES</button><strong>{done?copy.signed:declined?copy.declined:doc?.status}</strong></div></header>
  {done&&<div style={{padding:13,borderRadius:9,background:'#ecfdf5',color:'#065f46',marginBottom:14}}>{copy.completed}</div>}
  {declined&&<div style={{padding:13,borderRadius:9,background:'#fef2f2',color:'#991b1b',marginBottom:14}}>{copy.declinedMsg}</div>}
  {error&&<div style={{padding:10,borderRadius:8,background:'#fee2e2',color:'#991b1b',marginBottom:12}}>{error}</div>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:18,alignItems:'start'}}>
   <section style={{border:'1px solid #dbe4ee',borderRadius:14,overflow:'hidden',background:'#f8fafc',minHeight:650}}>{doc?.file_url?<iframe title={copy.iframe} src={doc.file_url} style={{width:'100%',height:760,border:0}}/>:<div style={{padding:40}}>{copy.preview}</div>}</section>
   <section style={{border:'1px solid #dbe4ee',borderRadius:14,padding:18,background:'#fff',position:'sticky',top:20}}>
    {!done&&!declined&&<><label style={{display:'block',marginBottom:12}}><strong>{copy.legal}</strong><input value={signature} onChange={e=>setSignature(e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:10,marginTop:5,border:'1px solid #cbd5e1',borderRadius:8}}/></label>
    {(doc?.fields||[]).filter((f:Field)=>['text','title','checkbox'].includes(f.type)).map((f:Field)=><label key={f.id} style={{display:'block',marginBottom:12}}><strong>{f.label||f.type}</strong>{f.type==='checkbox'?<input type="checkbox" checked={Boolean(values[f.id])} onChange={e=>setValues(v=>({...v,[f.id]:e.target.checked?'yes':''}))} style={{marginLeft:9}}/>:<input value={values[f.id]||''} onChange={e=>setValues(v=>({...v,[f.id]:e.target.value}))} style={{width:'100%',boxSizing:'border-box',padding:10,marginTop:5,border:'1px solid #cbd5e1',borderRadius:8}}/>}</label>)}
    <label style={{display:'flex',gap:9,fontSize:13,lineHeight:1.45,marginTop:14}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{copy.consent}</span></label>
    <div style={{display:'flex',gap:8,marginTop:16}}><button disabled={busy} onClick={decline} style={{flex:1,padding:11,borderRadius:8,border:'1px solid #fecaca',background:'#fff',color:'#b91c1c',fontWeight:800}}>{copy.decline}</button><button disabled={busy||!ready} onClick={sign} style={{flex:2,padding:11,borderRadius:8,border:0,background:'#7C3AED',color:'#fff',fontWeight:800,opacity:(busy||!ready)?.5:1}}>{busy?copy.submitting:copy.finish}</button></div></>}
   </section>
  </div>
 </main>
}
