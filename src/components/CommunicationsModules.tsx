
import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { SignalWire, StaticCredentialProvider } from '@signalwire/js'
import { FileText, MessageSquareText, Mic, Phone, PhoneOff, Plus, RefreshCw, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Lang='en'|'es'
type Row=Record<string,any>
const t=(v:any)=>v==null?'':String(v)
const localized=(v:any,lang:Lang)=>{
 const raw=t(v),k=raw.toLowerCase().replace(/[ -]+/g,'_')
 if(lang!=='es')return raw
 const m:Record<string,string>={idle:'Inactivo',preparing:'Preparando',ringing:'Llamando',connected:'Conectada',ended:'Finalizada',error:'Error',open:'Abierto',closed:'Cerrado',active:'Activo',email:'Correo',sms:'SMS',phone:'Teléfono'}
 return m[k]||raw
}

function useOrgAccess(session:Session){
  const [orgId,setOrgId]=useState(localStorage.getItem('oculivo-org-id')||'')
  const [role,setRole]=useState('')
  useEffect(()=>{const f=(e:any)=>setOrgId(String(e?.detail||localStorage.getItem('oculivo-org-id')||''));window.addEventListener('oculivo-org-change',f);return()=>window.removeEventListener('oculivo-org-change',f)},[])
  useEffect(()=>{let active=true;(async()=>{const q=supabase.from('organization_memberships').select('organization_id,role,is_active').eq('user_id',session.user.id).eq('is_active',true);const r=orgId?await q.eq('organization_id',orgId).maybeSingle():await q.limit(1).maybeSingle();if(!active)return;if(r.data?.organization_id){const id=String(r.data.organization_id);localStorage.setItem('oculivo-org-id',id);setOrgId(id);setRole(String(r.data.role||''))}else setRole('')})();return()=>{active=false}},[session.user.id,orgId])
  return {orgId,role,canCommunicate:['owner','admin','manager','provider','staff'].includes(role)}
}

export function InboxComms({session,lang}:{session:Session;lang:Lang}){
 const {orgId,canCommunicate}=useOrgAccess(session),[threads,setThreads]=useState<Row[]>([]),[threadId,setThreadId]=useState(''),[messages,setMessages]=useState<Row[]>([]),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[newOpen,setNewOpen]=useState(false),[newChannel,setNewChannel]=useState<'email'|'sms'>('email'),[newTo,setNewTo]=useState(''),[newSubject,setNewSubject]=useState(''),[newBody,setNewBody]=useState('')
 async function loadThreads(selectId?:string){if(!orgId){setThreads([]);setThreadId('');return}const r=await supabase.from('communication_threads').select('*').eq('organization_id',orgId).order('last_message_at',{ascending:false,nullsFirst:false}).limit(200);if(r.error){setError(r.error.message);return}setThreads(r.data||[]);const target=selectId||threadId;if(target&&(r.data||[]).some(x=>String(x.id)===target))setThreadId(target);else if(r.data?.[0]?.id)setThreadId(String(r.data[0].id));else setThreadId('')}
 async function loadMessages(id=threadId){if(!orgId||!id){setMessages([]);return}const r=await supabase.from('communication_messages').select('*').eq('organization_id',orgId).eq('thread_id',id).order('created_at',{ascending:true}).limit(500);if(r.error){setError(r.error.message);return}setMessages(r.data||[]);const unread=(r.data||[]).filter(x=>x.direction==='inbound'&&!x.is_read).map(x=>x.id);if(canCommunicate&&unread.length)await supabase.from('communication_messages').update({is_read:true}).eq('organization_id',orgId).in('id',unread)}
 useEffect(()=>{setThreadId('');setMessages([]);void loadThreads()},[orgId])
 useEffect(()=>{void loadMessages(threadId)},[threadId,orgId])
 const active=threads.find(x=>String(x.id)===threadId)
 async function send(e:any){e.preventDefault();if(!active||!body.trim()||busy||!canCommunicate)return;setBusy(true);setError('');const channel=String(active.channel);const fn=channel==='sms'?'send-sms':channel==='email'?'send-email':'';if(!fn){setError(lang==='es'?'Este canal no admite respuestas desde la bandeja.':'This channel does not support inbox replies.');setBusy(false);return}const r=await supabase.functions.invoke(fn,{body:{thread_id:threadId,body:body.trim(),subject:active.subject||undefined}});if(r.error||r.data?.error){setError(r.data?.error||r.error?.message||(lang==='es'?'No se pudo enviar el mensaje.':'Send failed'))}else{setBody('');await Promise.all([loadMessages(threadId),loadThreads(threadId)])}setBusy(false)}
 async function startConversation(e:any){
   e.preventDefault();if(!orgId||!canCommunicate||busy||!newTo.trim()||!newBody.trim())return
   setBusy(true);setError('')
   const fn=newChannel==='email'?'send-email':'send-sms'
   const payload:any={organization_id:orgId,to:newTo.trim(),body:newBody.trim()}
   if(newChannel==='email'&&newSubject.trim())payload.subject=newSubject.trim()
   const r=await supabase.functions.invoke(fn,{body:payload})
   if(r.error||r.data?.error){setError(r.data?.error||r.error?.message||(lang==='es'?'No se pudo iniciar la conversación.':'Could not start conversation.'))}
   else{
     const id=String(r.data?.thread_id||'')
     setNewOpen(false);setNewTo('');setNewSubject('');setNewBody('')
     await loadThreads(id)
     if(id)await loadMessages(id)
   }
   setBusy(false)
 }
 return <section><div className="wf-head"><div><h2>{lang==='es'?'Bandeja unificada':'Unified inbox'}</h2><p>{lang==='es'?'Correo y SMS por consultorio':'Practice-scoped email and SMS'}</p></div><div style={{display:'flex',gap:8}}>{canCommunicate&&<button className="wf-primary" onClick={()=>setNewOpen(v=>!v)}><Plus size={14}/>{lang==='es'?'Nueva conversación':'New conversation'}</button>}<button className="refresh-button" onClick={()=>void loadThreads()}><RefreshCw size={14}/>{lang==='es'?'Actualizar':'Refresh'}</button></div></div>{error&&<div className="wf-alert">{error}</div>}
 {newOpen&&<form className="wf-form" onSubmit={startConversation}><div className="wf-two"><label className="wf-field"><span>{lang==='es'?'Canal':'Channel'}</span><select value={newChannel} onChange={e=>setNewChannel(e.target.value as 'email'|'sms')}><option value="email">{lang==='es'?'Correo':'Email'}</option><option value="sms">SMS</option></select></label><label className="wf-field"><span>{newChannel==='email'?(lang==='es'?'Correo del destinatario':'Recipient email'):(lang==='es'?'Teléfono E.164':'E.164 phone')}</span><input required type={newChannel==='email'?'email':'tel'} placeholder={newChannel==='email'?'patient@example.com':'+15551234567'} value={newTo} onChange={e=>setNewTo(e.target.value)}/></label></div>{newChannel==='email'&&<label className="wf-field"><span>{lang==='es'?'Asunto':'Subject'}</span><input value={newSubject} onChange={e=>setNewSubject(e.target.value)}/></label>}<label className="wf-field"><span>{lang==='es'?'Mensaje':'Message'}</span><textarea rows={3} required value={newBody} onChange={e=>setNewBody(e.target.value)}/></label><div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><button type="button" className="refresh-button" onClick={()=>setNewOpen(false)}>{lang==='es'?'Cancelar':'Cancel'}</button><button type="submit" className="wf-primary" disabled={busy||!newTo.trim()||!newBody.trim()}><Send size={14}/>{busy?(lang==='es'?'Enviando…':'Sending…'):(lang==='es'?'Enviar':'Send')}</button></div></form>}
 <div className="inbox-workspace"><aside className="inbox-thread-list">{!threads.length&&<div className="inbox-empty"><MessageSquareText size={20}/><strong>{lang==='es'?'Sin conversaciones todavía':'No conversations yet'}</strong><p>{lang==='es'?'Inicia un correo o SMS nuevo, o espera un mensaje entrante.':'Start a new email or SMS, or wait for an inbound message.'}</p></div>}{threads.map(x=><button key={x.id} className={threadId===String(x.id)?'active':''} onClick={()=>setThreadId(String(x.id))}><strong>{x.subject||x.phone_number||x.email_address||(lang==='es'?'Conversación':'Conversation')}</strong><span>{localized(x.channel,lang)} · {localized(x.status,lang)}</span></button>)}</aside><div className="inbox-thread"><header><div><h3>{active?.subject||active?.phone_number||active?.email_address||(lang==='es'?'Conversación':'Conversation')}</h3><span>{localized(active?.channel||'',lang)}</span></div></header><div className="inbox-messages">{messages.map(m=><article key={m.id} className={m.direction==='outbound'?'message-bubble outbound':'message-bubble'}><div><strong>{m.sender_name||(m.direction==='outbound'?(lang==='es'?'Consultorio':'Practice'):(lang==='es'?'Paciente':'Patient'))}</strong><span>{new Date(m.created_at).toLocaleString()}</span></div><p>{m.body}</p></article>)}</div>{active&&canCommunicate&&(String(active.channel)==='sms'||String(active.channel)==='email')?<form className="inbox-compose" onSubmit={send}><textarea rows={2} value={body} onChange={e=>setBody(e.target.value)} placeholder={lang==='es'?'Escribe una respuesta…':'Write a reply…'}/><button type="submit" disabled={busy||!body.trim()}><Send size={15}/>{busy?(lang==='es'?'Enviando…':'Sending…'):(lang==='es'?'Enviar':'Send')}</button></form>:<div className="inbox-readonly-note">{!canCommunicate?(lang==='es'?'Tu rol tiene acceso de solo lectura.':'Your role has read-only access.'):(lang==='es'?'Selecciona un hilo de correo o SMS para responder.':'Select an email or SMS thread to reply.')}</div>}</div></div></section>
}

export function PhoneOps({session,lang}:{session:Session;lang:Lang}){
 const {orgId,canCommunicate}=useOrgAccess(session),[threads,setThreads]=useState<Row[]>([]),[threadId,setThreadId]=useState(''),[status,setStatus]=useState<'idle'|'preparing'|'ringing'|'connected'|'ended'|'error'>('idle'),[destination,setDestination]=useState(''),[error,setError]=useState(''),[faxFile,setFaxFile]=useState<File|null>(null),[faxBusy,setFaxBusy]=useState(false),[faxMessage,setFaxMessage]=useState('')
 const audioRef=useRef<HTMLAudioElement>(null),clientRef=useRef<any>(null),callRef=useRef<any>(null),messageIdRef=useRef(''),terminalRef=useRef(false)
 async function load(){if(!orgId)return;const r=await supabase.from('communication_threads').select('*').eq('organization_id',orgId).eq('channel','phone').order('last_message_at',{ascending:false,nullsFirst:false}).limit(200);if(r.error){setError(r.error.message);return}setThreads(r.data||[]);if(!threadId&&r.data?.[0]?.id)setThreadId(String(r.data[0].id))}
 useEffect(()=>{void load()},[orgId])
 useEffect(()=>()=>{void cleanup()},[])
 async function cleanup(){try{await clientRef.current?.destroy?.()}catch{}clientRef.current=null;callRef.current=null;if(audioRef.current)audioRef.current.srcObject=null}
 async function report(action:string){if(!messageIdRef.current)return;await supabase.functions.invoke('phone-session',{body:{action,message_id:messageIdRef.current}})}
 async function waitForReady(client:any){
  await new Promise<void>((resolve,reject)=>{
   let settled=false,sub:any
   const done=(err?:unknown)=>{if(settled)return;settled=true;window.clearTimeout(timer);try{sub?.unsubscribe?.()}catch{};err?reject(err):resolve()}
   const timer=window.setTimeout(()=>done(new Error(lang==='es'?'La sesión telefónica tardó demasiado en conectarse.':'Phone session timed out before becoming ready.')),10000)
   sub=client.ready$.subscribe({next:(ready:any)=>{if(ready===false)return;done()},error:(err:unknown)=>done(err)})
  })
 }
 async function finish(action:'complete'|'failed'){
  if(terminalRef.current)return
  terminalRef.current=true
  if(action==='failed'){setError(lang==='es'?'La llamada falló.':'Phone call failed');setStatus('error')}else setStatus('ended')
  await report(action)
  await cleanup()
 }
 async function start(){
  if(!threadId||!canCommunicate)return
  terminalRef.current=false;messageIdRef.current='';setStatus('preparing');setError('')
  const prep=await supabase.functions.invoke('phone-session',{body:{action:'prepare',thread_id:threadId}})
  if(prep.error||prep.data?.error||!prep.data?.token||!prep.data?.destination){setError(prep.data?.error||prep.error?.message||(lang==='es'?'No se pudo preparar la llamada.':'Could not prepare call'));setStatus('error');return}
  try{
   messageIdRef.current=String(prep.data.message_id||'');setDestination(String(prep.data.destination||''))
   const provider=new StaticCredentialProvider({token:String(prep.data.token)})
   const client=new SignalWire(provider)
   clientRef.current=client
   await waitForReady(client)
   const call=await client.dial(String(prep.data.destination),{audio:true,video:false,receiveAudio:true,receiveVideo:false})
   callRef.current=call;setStatus('ringing')
   call.remoteStream$.subscribe((stream:MediaStream|null)=>{if(audioRef.current&&stream){audioRef.current.srcObject=stream;audioRef.current.play().catch(()=>undefined)}})
   call.status$.subscribe(async(next:string)=>{
    if(next==='connected'){setStatus('connected');await report('connected');return}
    if(next==='ringing'||next==='trying'||next==='connecting'){setStatus('ringing');return}
    if(next==='failed'){await finish('failed');return}
    if(next==='disconnected'||next==='ended'||next==='destroyed')await finish('complete')
   })
  }catch(e:any){setError(e?.message||(lang==='es'?'La llamada falló.':'Phone call failed'));await finish('failed')}
 }
 async function hangup(){try{await callRef.current?.hangup?.()}finally{await finish('complete')}}
 async function sendFax(){
  if(!orgId||!threadId||!faxFile||!canCommunicate||faxBusy)return
  setFaxBusy(true);setFaxMessage('');setError('')
  try{
   if(faxFile.type&&faxFile.type!=='application/pdf')throw new Error(lang==='es'?'El fax debe ser un archivo PDF.':'Fax document must be a PDF.')
   if(faxFile.size>25*1024*1024)throw new Error(lang==='es'?'El fax supera el límite de 25 MB.':'Fax document exceeds the 25 MB limit.')
   const safe=faxFile.name.replace(/[^a-zA-Z0-9._-]+/g,'-')
   const storagePath=orgId+'/fax/'+Date.now()+'-'+safe
   const up=await supabase.storage.from('oculivo-documents').upload(storagePath,faxFile,{contentType:'application/pdf',upsert:false})
   if(up.error)throw up.error
   const doc=await supabase.from('documents').insert({organization_id:orgId,patient_id:null,uploaded_by:session.user.id,document_type:'fax',file_name:faxFile.name,storage_path:storagePath,mime_type:'application/pdf',file_size:faxFile.size,description:lang==='es'?'Fax saliente':'Outbound fax'}).select('id').single()
   if(doc.error){await supabase.storage.from('oculivo-documents').remove([storagePath]);throw doc.error}
   const sent=await supabase.functions.invoke('send-fax',{body:{thread_id:threadId,storage_path:storagePath,file_name:faxFile.name}})
   if(sent.error||sent.data?.error){await supabase.from('documents').delete().eq('id',doc.data.id).eq('organization_id',orgId);await supabase.storage.from('oculivo-documents').remove([storagePath]);throw new Error(sent.data?.error||sent.error?.message||(lang==='es'?'No se pudo enviar el fax.':'Fax send failed'))}
   setFaxMessage(lang==='es'?'Fax en cola para envío. El estado final aparecerá en la bandeja.':'Fax queued. Final delivery status will appear in the inbox.')
   setFaxFile(null)
  }catch(e:any){setError(e?.message||(lang==='es'?'No se pudo enviar el fax.':'Fax send failed'))}
  finally{setFaxBusy(false)}
 }
 const active=threads.find(x=>String(x.id)===threadId),inCall=['preparing','ringing','connected'].includes(status)
 return <section><audio ref={audioRef} autoPlay playsInline/><div className="wf-head"><div><h2>{lang==='es'?'Teléfono':'Phone'}</h2><p>{lang==='es'?'Llamadas del consultorio desde el navegador':'Practice calls from your browser'}</p></div><button className="refresh-button" onClick={()=>void load()}><RefreshCw size={14}/>{lang==='es'?'Actualizar':'Refresh'}</button></div>{error&&<div className="wf-alert">{error}</div>}<div className="phone-workspace"><aside className="inbox-thread-list">{!threads.length&&<div className="inbox-empty"><Phone size={20}/><strong>{lang==='es'?'Sin conversaciones telefónicas':'No phone conversations'}</strong><p>{lang==='es'?'Los hilos telefónicos aparecerán aquí cuando estén disponibles.':'Phone threads will appear here when available.'}</p></div>}{threads.map(x=><button key={x.id} className={threadId===String(x.id)?'active':''} onClick={()=>{setThreadId(String(x.id));setStatus('idle');setError('')}}><strong>{x.subject||x.phone_number||(lang==='es'?'Conversación telefónica':'Phone conversation')}</strong><span>{x.phone_number||''}</span></button>)}</aside><div className="phone-dialer-card"><div className={'phone-orb '+status}><Phone size={28}/></div><span className="date-kicker">{localized(status,lang).toUpperCase()}</span><h2>{active?.phone_number||destination|| (lang==='es'?'Selecciona un hilo':'Select a phone thread')}</h2><p>{status==='connected'?(lang==='es'?'Llamada conectada':'Call connected'):status==='ringing'?(lang==='es'?'Llamando…':'Ringing…'):status==='preparing'?(lang==='es'?'Preparando sesión segura…':'Preparing secure session…'):(lang==='es'?'Usa el micrófono de este navegador para llamar desde la identidad telefónica del consultorio.':'Uses this browser microphone and the practice phone identity.')}</p>{!inCall?<button className="wf-primary" disabled={!threadId||!canCommunicate} onClick={()=>void start()}><Phone size={16}/>{status==='ended'||status==='error'?(lang==='es'?'Llamar otra vez':'Call again'):(lang==='es'?'Iniciar llamada':'Start call')}</button>:<button className="wf-danger" disabled={status==='preparing'} onClick={()=>void hangup()}><PhoneOff size={16}/>{lang==='es'?'Colgar':'Hang up'}</button>}<div className="phone-mic-note"><Mic size={13}/>{!canCommunicate?(lang==='es'?'Tu rol tiene acceso de solo lectura.':'Your role has read-only access.'):(lang==='es'?'El navegador pedirá permiso para usar el micrófono.':'Your browser will ask for microphone permission.')}</div>
<div className="fax-send-card"><div><FileText size={16}/><strong>{lang==='es'?'Enviar fax':'Send fax'}</strong></div><p>{lang==='es'?'Usa el número del hilo seleccionado y un PDF privado del consultorio.':'Uses the selected thread number and a private practice PDF.'}</p><input type="file" accept="application/pdf,.pdf" disabled={!threadId||!canCommunicate||faxBusy} onChange={e=>setFaxFile(e.target.files?.[0]||null)}/><button className="wf-primary" disabled={!threadId||!canCommunicate||!faxFile||faxBusy} onClick={()=>void sendFax()}><FileText size={15}/>{faxBusy?(lang==='es'?'Enviando fax…':'Sending fax…'):(lang==='es'?'Enviar fax':'Send fax')}</button>{faxMessage&&<div className="wf-alert">{faxMessage}</div>}</div></div></div></section>
}
