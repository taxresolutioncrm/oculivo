import { useEffect, useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Patient={id:string;first_name:string|null;last_name:string|null;email:string|null;[key:string]:unknown}
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
const emailOk=(value:unknown)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value??'').trim())
const suppressed=(row:Patient)=>Boolean(row.email_opt_out||row.marketing_opt_out||row.do_not_email||row.unsubscribed||row.email_suppressed)
const nameOf=(row:Patient)=>[row.first_name,row.last_name].filter(Boolean).join(' ').trim()||String(row.email||'Patient')
function merge(value:string,row:Patient){const name=nameOf(row);return value.replaceAll('{{name}}',name).replaceAll('{{first_name}}',String(row.first_name||name.split(/\s+/)[0]||'')).replaceAll('{{last_name}}',String(row.last_name||'')).replaceAll('{{email}}',String(row.email||''))}

export default function EmailBlastPage({lang}:{lang:'en'|'es'}){
  const orgId=localStorage.getItem('oculivo-org-id')||''
  const [rows,setRows]=useState<Patient[]>([])
  const [selected,setSelected]=useState<Set<string>>(()=>new Set())
  const [search,setSearch]=useState('')
  const [subject,setSubject]=useState('')
  const [message,setMessage]=useState('')
  const [testEmail,setTestEmail]=useState('')
  const [sending,setSending]=useState(false)
  const [status,setStatus]=useState<Record<string,string>>({})
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')

  useEffect(()=>{let active=true;(async()=>{
    if(!orgId){setRows([]);return}
    const {data,error}=await supabase.from('patients').select('*').eq('organization_id',orgId).order('last_name').limit(5000)
    if(!active)return
    if(error){setRows([]);setError(error.message);return}
    setRows(((data??[]) as Patient[]).filter(row=>emailOk(row.email)&&!suppressed(row)))
  })();return()=>{active=false}},[orgId])

  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return !q?rows:rows.filter(row=>(nameOf(row)+' '+String(row.email||'')).toLowerCase().includes(q))},[rows,search])
  const all=filtered.length>0&&filtered.every(row=>selected.has(row.id))
  const toggleAll=()=>setSelected(current=>{const next=new Set(current);filtered.forEach(row=>all?next.delete(row.id):next.add(row.id));return next})

  async function deliver(row:Patient,test=false){
    const {data,error}=await supabase.functions.invoke('email-blast-send',{body:{
      organization_id:orgId,
      patient_id:test?undefined:row.id,
      test_email:test?row.email:undefined,
      subject:merge(subject,row),
      body:merge(message,row)
    }})
    if(error||data?.error)throw new Error(error?.message||data?.error||'Email send failed')
  }

  async function sendTest(){
    setError('');setNotice('')
    if(!emailOk(testEmail))return setError(lang==='es'?'Ingresa un correo de prueba válido.':'Enter a valid test email address.')
    if(!subject.trim()||!message.trim())return setError(lang==='es'?'Asunto y mensaje son obligatorios.':'Subject and message are required.')
    setSending(true)
    try{await deliver({id:'test',first_name:'Test',last_name:'Recipient',email:testEmail},true);setNotice(lang==='es'?'Correo de prueba enviado.':'Test email sent.')}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setSending(false)}
  }

  async function sendBlast(){
    setError('');setNotice('')
    const recipients=rows.filter(row=>selected.has(row.id))
    if(!recipients.length)return setError(lang==='es'?'Selecciona al menos un paciente.':'Select at least one patient.')
    if(!subject.trim()||!message.trim())return setError(lang==='es'?'Asunto y mensaje son obligatorios.':'Subject and message are required.')
    const prompt=lang==='es'?'¿Enviar este correo a '+recipients.length+' paciente(s)?':'Send this email blast to '+recipients.length+' patient'+(recipients.length===1?'':'s')+'?'
    if(!confirm(prompt))return
    setSending(true);let sent=0,failed=0
    for(const row of recipients){
      setStatus(current=>({...current,[row.id]:'sending'}))
      try{await deliver(row);sent++;setStatus(current=>({...current,[row.id]:'sent'}))}
      catch{failed++;setStatus(current=>({...current,[row.id]:'failed'}))}
      await wait(350)
    }
    setSending(false)
    setNotice(lang==='es'?'Envío completo: '+sent+' enviados'+(failed?', '+failed+' fallidos':'')+'.':'Blast complete: '+sent+' sent'+(failed?', '+failed+' failed':'')+'.')
  }

  return <section>
    <div className="wf-head"><div><h2>{lang==='es'?'Envío masivo':'Email Blast'}</h2><p>{lang==='es'?'Correo masivo por consultorio con selección de pacientes y registro en comunicaciones.':'Practice-scoped bulk email with patient selection and communications logging.'}</p></div><span>{selected.size} {lang==='es'?'seleccionados':'selected'}</span></div>
    {error&&<div className="wf-alert">{error}</div>}{notice&&<div className="wf-alert">{notice}</div>}
    <div className="inbox-workspace">
      <aside className="inbox-thread-list" style={{maxHeight:620,overflow:'auto'}}>
        <div style={{padding:12,borderBottom:'1px solid var(--border)'}}><input style={{width:'100%'}} value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==='es'?'Buscar pacientes…':'Search patients…'}/><button className="refresh-button" style={{marginTop:8,width:'100%'}} onClick={toggleAll}>{all?(lang==='es'?'Limpiar visibles':'Clear visible'):(lang==='es'?'Seleccionar visibles':'Select visible')}</button></div>
        {filtered.map(row=><label key={row.id} style={{display:'flex',gap:9,alignItems:'center',padding:'10px 12px',cursor:'pointer',borderBottom:'1px solid var(--border)'}}><input type="checkbox" checked={selected.has(row.id)} onChange={()=>setSelected(current=>{const next=new Set(current);next.has(row.id)?next.delete(row.id):next.add(row.id);return next})}/><div style={{minWidth:0,flex:1}}><strong style={{display:'block'}}>{nameOf(row)}</strong><span>{row.email}</span></div><small>{status[row.id]||''}</small></label>)}
        {!filtered.length&&<div className="inbox-empty">{lang==='es'?'No hay destinatarios elegibles.':'No eligible recipients.'}</div>}
      </aside>
      <div className="inbox-thread">
        <div style={{padding:18}}>
          <label style={{display:'grid',gap:6,marginBottom:14}}><strong>{lang==='es'?'Asunto':'Subject'}</strong><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder={lang==='es'?'Asunto — admite variables':'Subject — supports merge fields'}/></label>
          <label style={{display:'grid',gap:6}}><strong>{lang==='es'?'Mensaje':'Message'}</strong><textarea rows={14} value={message} onChange={e=>setMessage(e.target.value)} placeholder={'Hi {{first_name}},\n\nYour message here…'}/></label>
          <p className="inbox-readonly-note">{lang==='es'?'Variables: {{first_name}}, {{last_name}}, {{name}}, {{email}}. No incluyas datos clínicos ni otra PHI en correos de marketing.':'Merge fields: {{first_name}}, {{last_name}}, {{name}}, {{email}}. Do not include clinical details or other PHI in marketing email.'}</p>
          <div style={{display:'flex',gap:8,marginTop:14}}><input style={{flex:1}} value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder={lang==='es'?'Correo de prueba':'Test email address'}/><button className="refresh-button" disabled={sending} onClick={()=>void sendTest()}><Send size={14}/>{lang==='es'?'Prueba':'Test'}</button><button className="wf-primary" disabled={sending||!selected.size} onClick={()=>void sendBlast()}><Send size={15}/>{sending?(lang==='es'?'Enviando…':'Sending…'):(lang==='es'?'Enviar':'Send Blast')}</button></div>
        </div>
      </div>
    </div>
  </section>
}
