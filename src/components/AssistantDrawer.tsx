
import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Bot, Send, Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Lang='en'|'es'
type Msg={role:'user'|'assistant';content:string}

export default function AssistantDrawer({session,lang}:{session:Session;lang:Lang}){
  const [open,setOpen]=useState(false),[messages,setMessages]=useState<Msg[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const end=useRef<HTMLDivElement|null>(null)
  useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth'})},[messages,busy])

  async function send(e:React.FormEvent){
    e.preventDefault()
    const prompt=text.trim()
    if(!prompt||busy)return
    const orgId=localStorage.getItem('oculivo-org-id')||''
    const next=[...messages,{role:'user' as const,content:prompt}]
    setMessages(next);setText('');setBusy(true);setError('')
    const {data,error}=await supabase.functions.invoke('oculivo-ai',{body:{
      message:prompt,
      organization_id:orgId,
      route:window.location.pathname,
      language:lang,
      history:next.slice(-10)
    }})
    if(error){
      setError(lang==='es'?'El asistente de Oculivo no está disponible en este momento.':'Oculivo AI is unavailable right now.')
    }else{
      const answer=String(data?.answer||data?.message||data?.content||'').trim()
      if(answer)setMessages(v=>[...v,{role:'assistant',content:answer}])
      else setError(lang==='es'?'El asistente no devolvió una respuesta.':'The assistant returned no response.')
    }
    setBusy(false)
  }

  return <>
    <button className="ai-launcher" onClick={()=>setOpen(true)} aria-label={lang==='es'?'Abrir asistente Oculivo':'Open Oculivo AI'}><Sparkles size={18}/><span>{lang==='es'?'Preguntar a Oculivo':'Ask Oculivo'}</span></button>
    {open&&<aside className="ai-drawer">
      <header><div className="ai-drawer-icon"><Bot size={18}/></div><div><strong>Oculivo AI</strong><span>{lang==='es'?'Asistente del consultorio':'Practice assistant'}</span></div><button onClick={()=>setOpen(false)}><X size={18}/></button></header>
      <div className="ai-safety">{lang==='es'?'Puede ayudar con flujos del consultorio y resumir contexto. No cambia contraseñas ni ejecuta nómina.':'Can help with practice workflows and summarize context. It cannot change passwords or run payroll.'}</div>
      <div className="ai-thread">
        {!messages.length&&<div className="ai-empty"><Sparkles size={22}/><strong>{lang==='es'?'¿En qué puedo ayudarte?':'How can I help?'}</strong><p>{lang==='es'?'Pregunta sobre pacientes, agenda, facturación, comunicaciones o flujos de Oculivo.':'Ask about patients, scheduling, billing, communications, or Oculivo workflows.'}</p></div>}
        {messages.map((m,i)=><article key={i} className={'ai-msg '+m.role}><strong>{m.role==='user'?(lang==='es'?'Tú':'You'):'Oculivo AI'}</strong><p>{m.content}</p></article>)}
        {busy&&<div className="ai-thinking">{lang==='es'?'Pensando…':'Thinking…'}</div>}
        {error&&<div className="ai-error">{error}</div>}
        <div ref={end}/>
      </div>
      <form className="ai-compose" onSubmit={send}><textarea rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder={lang==='es'?'Pregunta a Oculivo…':'Ask Oculivo…'}/><button disabled={busy||!text.trim()}><Send size={16}/></button></form>
    </aside>}
  </>
}
