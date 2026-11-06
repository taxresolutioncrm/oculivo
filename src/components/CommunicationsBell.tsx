import {useCallback,useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {Bell,X} from 'lucide-react'
import {supabase} from '../lib/supabase'

type Lang='en'|'es'
export default function CommunicationsBell({organizationId,lang,userId}:{organizationId:string;lang:Lang;userId:string}){
 const navigate=useNavigate()
 const [open,setOpen]=useState(false)
 const [unread,setUnread]=useState<number|null>(null)
 const [counts,setCounts]=useState<{email:number;sms:number}|null>(null)
 const [error,setError]=useState('')
 const es=lang==='es'
 const refresh=useCallback(async()=>{
  if(!organizationId||!userId||document.visibilityState==='hidden')return
  try{
   // Reads use existing authenticated RLS; never combine data across practices.
   const base=()=>supabase.from('communication_messages')
      .select('id,communication_threads!inner(channel)',{count:'exact',head:true})
      .eq('organization_id',organizationId).eq('direction','inbound').eq('is_read',false)
   const [email,sms]=await Promise.all([
     base().eq('communication_threads.channel','email'),
     base().eq('communication_threads.channel','sms'),
   ])
   if(email.error||sms.error){setError(es?'Notificaciones no disponibles. Reintentando.':'Notifications unavailable. Retrying.');return}
   setCounts({email:email.count||0,sms:sms.count||0})
   setUnread((email.count||0)+(sms.count||0))
   setError('')
  }catch{setError(es?'No se pudo actualizar.':'Could not refresh notifications.')}
 },[organizationId,userId,es])
 useEffect(()=>{setOpen(false);setCounts(null);setUnread(null);setError('')},[organizationId,userId])
 useEffect(()=>{
   void refresh()
   const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},60000)
   const onFocus=()=>void refresh()
   window.addEventListener('focus',onFocus)
   document.addEventListener('visibilitychange',onFocus)
   return()=>{clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus)}
 },[refresh])
 useEffect(()=>{
   if(!open)return
   const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)}
   document.addEventListener('keydown',onKey)
   return()=>document.removeEventListener('keydown',onKey)
 },[open])
 const go=(where:string)=>{setOpen(false);navigate(where)}
 return <div className="oculivo-comms">
   <style>{`
    .oculivo-comms{position:relative;display:flex;align-items:center}
    .oculivo-comms-trigger{position:relative;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;border:1px solid #53657a;border-radius:12px;background:transparent;color:inherit;cursor:pointer}
    .oculivo-comms-count{position:absolute;right:-5px;top:-7px;background:#a9f36d;color:#182b16;border-radius:999px;font-size:10px;font-weight:800;padding:2px 5px}
    .oculivo-comms-sheet{position:absolute;top:calc(100% + 8px);right:0;width:min(360px,calc(100vw - 20px));max-height:72dvh;overflow-y:auto;overscroll-behavior:contain;z-index:11000;border-radius:15px;background:#15283a;color:#f1f5f9;border:1px solid #506678;box-shadow:0 18px 40px #0008;padding:14px}
    .oculivo-comms-sheet button{min-height:44px;cursor:pointer}
    @media(max-width:640px){.oculivo-comms-sheet{position:fixed;top:auto;left:8px;right:8px;bottom:calc(12px + env(safe-area-inset-bottom,0px));width:auto;max-height:min(76dvh,calc(100dvh - 20px))}}
    @media(max-height:420px){.oculivo-comms-sheet{bottom:8px;max-height:calc(100dvh - 16px)}}
   `}</style>
   <button type="button" className="oculivo-comms-trigger" aria-label={es?'Notificaciones de comunicación':'Communications notifications'} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
     <Bell size={19}/>{unread!==null&&unread>0&&<span className="oculivo-comms-count">{unread>99?'99+':unread}</span>}{error&&<span style={{color:'#fecaca'}}>!</span>}
   </button>
   {open&&<section className="oculivo-comms-sheet" role="dialog" aria-modal="false" aria-label={es?'Notificaciones':'Communications notifications'}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <strong>{es?'Notificaciones de comunicación':'Communications Notifications'}</strong>
        <button type="button" aria-label={es?'Cerrar':'Close'} onClick={()=>setOpen(false)} style={{border:0,background:'transparent',color:'inherit'}}><X size={19}/></button>
      </div>
      <p style={{fontSize:12,color:'#cbd5e1'}}>{es?'Mensajes entrantes sin leer de este consultorio.':'Unread incoming messages for this practice.'}</p>
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <button type="button" onClick={()=>go('/inbox')} style={{flex:1,border:'1px solid #455a70',background:'#21364c',color:'#fff',borderRadius:10}}>📧 {es?'Correo':'Email'}: {counts?.email??'—'}</button>
        <button type="button" onClick={()=>go('/inbox')} style={{flex:1,border:'1px solid #455a70',background:'#21364c',color:'#fff',borderRadius:10}}>💬 SMS: {counts?.sms??'—'}</button>
      </div>
      <p style={{fontSize:11,color:'#9db3c3',marginTop:10}}>{es?'Llamadas: abre el teléfono. Las alertas de llamadas se agregarán después de verificar la recepción.':'Calls: open Phone. Call alerts require verified inbound event tracking.'}</p>
      <button type="button" onClick={()=>go('/phone')} style={{minHeight:44,border:'1px solid #455a70',background:'#21364c',color:'#fff',borderRadius:10,padding:'7px 12px'}}>📞 {es?'Teléfono':'Phone'}</button>
      {error&&<p role="status" style={{color:'#fecaca',fontSize:12}}>{error}</p>}
   </section>}
 </div>
}
