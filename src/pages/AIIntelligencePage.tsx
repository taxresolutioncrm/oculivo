import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function AIIntelligencePage({session,lang}:{session:Session;lang:'en'|'es'}){
  const [count,setCount]=useState(0)
  const [error,setError]=useState('')
  useEffect(()=>{(async()=>{
    const memberships=await supabase.from('organization_memberships').select('organization_id,is_active').eq('user_id',session.user.id).eq('is_active',true)
    if(memberships.error||!memberships.data?.length){setError(memberships.error?.message||'No active practice');return}
    const preferred=localStorage.getItem('oculivo-org-id')||''
    const allowed=memberships.data.map(m=>String(m.organization_id))
    const org=allowed.includes(preferred)?preferred:allowed[0]
    const docs=await supabase.from('documents').select('id',{count:'exact',head:true}).eq('organization_id',org)
    if(docs.error)setError(docs.error.message); else setCount(docs.count||0)
  })()},[session.user.id])
  const es=lang==='es'
  return <div className="module-page">
    <div className="module-page-head"><div><span className="eyebrow">ROMYLABS AI CORE</span><h1>{es?'Inteligencia IA':'AI Intelligence'}</h1><p>{es?'Inteligencia del consultorio para documentos, citas, facturación, seguros, operaciones y flujos aprobados de pacientes.':'Practice intelligence for documents, appointments, billing, insurance, operations, and approved patient workflows.'}</p></div></div>
    {error&&<div className="auth-note">{error}</div>}
    <div className="stats-grid"><article className="stat-card"><strong>{count}</strong><span>{es?'Documentos':'Documents'}</span></article><article className="stat-card"><strong>PHI</strong><span>{es?'Flujo protegido':'Protected workflow'}</span></article><article className="stat-card"><strong>{es?'Humano':'Human'}</strong><span>{es?'Verificación requerida':'Verification required'}</span></article></div>
    <section className="panel-card"><h2>{es?'Inteligencia de optometría':'Optometry Intelligence'}</h2><p>{es?'La arquitectura está lista para documentos, seguros, citas, facturación y hallazgos operativos. El procesamiento externo de PHI permanece desactivado hasta contar con la aprobación de privacidad/cumplimiento necesaria.':'The architecture is ready for documents, insurance, appointments, billing, and operational findings. External AI processing of PHI remains disabled until the configured provider/deployment has the required healthcare privacy/compliance approval.'}</p></section>
  </div>
}
