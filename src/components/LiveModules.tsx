import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { CalendarDays, MessageSquareText, Plus, RefreshCw, Send, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BillingOps, ClinicalOps, DocumentsOps, OpticalOps, PatientsOps, ScheduleOps, SupportOps, TimeclockOps } from './OperationalModules'
import { InboxComms, PhoneOps } from './CommunicationsModules'

type Row = Record<string, unknown>

type OrgContext = {
  organizationId: string
  role: string
  organizationName: string
}

const TABLE_BY_PATH: Record<string, string> = {
  '/schedule': 'appointments',
  '/patients': 'patients',
  '/clinical': 'clinical_records',
  '/optical': 'optical_orders',
  '/inbox': 'communication_threads',
  '/phone': 'communication_messages',
  '/timeclock': 'time_entries',
  '/billing': 'invoices',
  '/support': 'support_tickets',
}

function text(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function prettyKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function rowTitle(row: Row) {
  const first = text(row.first_name)
  const last = text(row.last_name)
  if (first || last) return [first, last].filter(Boolean).join(' ')
  for (const key of ['name','title','subject','patient_name','file_name','document_type','status','body','description']) {
    const value = text(row[key])
    if (value) return value
  }
  return 'Record'
}

function rowMeta(row: Row) {
  const bits: string[] = []
  for (const key of ['email','phone','status','type','channel','document_type','created_at','scheduled_at','appointment_date','clock_in']) {
    const value = text(row[key])
    if (value) bits.push(key.endsWith('_at') || key.includes('date') ? value.replace('T',' ').slice(0,16) : value)
    if (bits.length >= 3) break
  }
  return bits.join(' · ')
}

function useOrg(session: Session) {
  const [org,setOrg] = useState<OrgContext | null>(null)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  const [selectionVersion,setSelectionVersion] = useState(0)

  useEffect(() => {
    const onOrgChange = () => setSelectionVersion((v) => v + 1)
    window.addEventListener('oculivo-org-change', onOrgChange)
    return () => window.removeEventListener('oculivo-org-change', onOrgChange)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      const memberships = await supabase
        .from('organization_memberships')
        .select('organization_id,role,is_active')
        .eq('user_id', session.user.id)
        .eq('is_active', true)

      if (!active) return
      if (memberships.error || !memberships.data?.length) {
        setOrg(null)
        setError(memberships.error?.message || 'No active Oculivo organization membership was found for this account.')
        setLoading(false)
        return
      }

      const preferred = localStorage.getItem('oculivo-org-id') || ''
      const selected = memberships.data.find((m) => String(m.organization_id) === preferred) || memberships.data[0]
      const organizationId = String(selected.organization_id)

      if (preferred !== organizationId) localStorage.setItem('oculivo-org-id', organizationId)

      const organization = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .maybeSingle()

      if (!active) return
      if (organization.error) {
        setError(organization.error.message)
        setLoading(false)
        return
      }

      setError('')
      setOrg({
        organizationId,
        role: text(selected.role) || 'member',
        organizationName: text(organization.data?.name) || 'Your practice',
      })
      setLoading(false)
    })()
    return () => { active = false }
  }, [session.user.id, selectionVersion])

  return {org,error,loading}
}

function Empty({message,lang='en'}:{message:string;lang?:'en'|'es'}) {
  return <div className="live-empty"><strong>{message}</strong><p>{lang==='es'?'Cuando se agreguen datos a Oculivo aparecerán aquí automáticamente.':'When data is added to Oculivo it will appear here automatically.'}</p></div>
}

function ErrorBox({message,lang='en'}:{message:string;lang?:'en'|'es'}) {
  return <div className="live-error"><strong>{lang==='es'?'No se pudo cargar este espacio de trabajo':'Unable to load this workspace'}</strong><p>{message}</p></div>
}

function Records({rows,lang='en'}:{rows:Row[];lang?:'en'|'es'}) {
  if (!rows.length) return <Empty message={lang==='es'?'Aún no hay registros':'No records yet'} lang={lang} />
  return <div className="record-list">
    {rows.map((row,index) => {
      const id = text(row.id) || String(index)
      const visible = Object.entries(row)
        .filter(([key,value]) => !['id','organization_id','patient_id','provider_id','user_id','sender_id','channel_id'].includes(key) && text(value))
        .slice(0,6)
      return <article className="record-card" key={id}>
        <div className="record-card-head"><div><strong>{rowTitle(row)}</strong><span>{rowMeta(row)}</span></div>{text(row.status) && <span className="status-badge">{text(row.status)}</span>}</div>
        <div className="record-fields">{visible.map(([key,value]) => <div key={key}><span>{prettyKey(key)}</span><b>{text(value).slice(0,120)}</b></div>)}</div>
      </article>
    })}
  </div>
}

function GenericLivePage({path,title,description,session,lang}:{path:string;title:string;description:string;session:Session;lang:'en'|'es'}) {
  const {org,error:orgError,loading:orgLoading} = useOrg(session)
  const [rows,setRows] = useState<Row[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

  const table = TABLE_BY_PATH[path]

  async function load() {
    if (!org || !table) return
    setLoading(true)
    setError('')
    const result = await supabase.from(table).select('*').eq('organization_id',org.organizationId).limit(50)
    if (result.error) setError(result.error.message)
    else setRows((result.data || []) as Row[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [org?.organizationId,table])

  return <section className="page">
    <div className="page-head">
      <div><span className="date-kicker">{lang==='es'?'DATOS DE OCULIVO EN VIVO':'LIVE OCULIVO DATA'}</span><h1>{title}</h1><p>{description}</p></div>
      <button className="refresh-button" onClick={()=>void load()} disabled={loading || !org}><RefreshCw size={15}/>{loading?(lang==='es'?'Cargando…':'Loading…'):(lang==='es'?'Actualizar':'Refresh')}</button>
    </div>
    {org && <div className="org-context"><strong>{org.organizationName}</strong><span>{org.role}</span></div>}
    <div className="panel live-panel">
      {orgLoading || loading ? <div className="live-loading">{lang==='es'?`Cargando ${title.toLowerCase()}…`:`Loading ${title.toLowerCase()}…`}</div> :
       orgError ? <ErrorBox message={orgError} lang={lang}/> :
       error ? <ErrorBox message={error} lang={lang}/> :
       <Records rows={rows} lang={lang}/>}
    </div>
  </section>
}

function TeamChat({session,lang}:{session:Session;lang:'en'|'es'}) {
  const {org,error:orgError,loading:orgLoading} = useOrg(session)
  const [channels,setChannels] = useState<Row[]>([])
  const [channelId,setChannelId] = useState('')
  const [messages,setMessages] = useState<Row[]>([])
  const [body,setBody] = useState('')
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [newChannel,setNewChannel] = useState('')

  async function loadChannels() {
    if (!org) return
    const result = await supabase.from('team_channels').select('*').eq('organization_id',org.organizationId).order('created_at',{ascending:true})
    if (result.error) { setError(result.error.message); return }
    const next = (result.data || []) as Row[]
    setChannels(next)
    if (!channelId && next[0]?.id) setChannelId(String(next[0].id))
  }

  async function loadMessages(id=channelId) {
    if (!org || !id) { setMessages([]); return }
    const result = await supabase.from('team_messages').select('*').eq('organization_id',org.organizationId).eq('channel_id',id).order('created_at',{ascending:true}).limit(200)
    if (result.error) setError(result.error.message)
    else setMessages((result.data || []) as Row[])
  }

  useEffect(()=>{setChannelId('');setMessages([]);void loadChannels()},[org?.organizationId])
  useEffect(()=>{void loadMessages(channelId)},[channelId,org?.organizationId])

  async function createChannel(name='general') {
    if (!org || !['owner','admin','manager'].includes(org?.role||'')) return
    const clean=name.trim().toLowerCase().replace(/[^a-z0-9-_ ]+/g,'').replace(/\s+/g,'-').slice(0,40)
    if(!clean)return
    setBusy(true); setError('')
    const existing=channels.find(c=>text(c.name).toLowerCase()===clean)
    if(existing){setChannelId(String(existing.id));setNewChannel('');setBusy(false);return}
    const result = await supabase.from('team_channels').insert({
      organization_id: org.organizationId,
      name: clean,
      description: clean==='general' ? 'Practice-wide team chat' : 'Practice team channel',
      is_private: false,
      created_by: session.user.id,
    }).select('*').single()
    if (result.error) setError(result.error.message)
    else {
      await loadChannels()
      if (result.data?.id) setChannelId(String(result.data.id))
      setNewChannel('')
    }
    setBusy(false)
  }

  async function sendMessage(e:React.FormEvent) {
    e.preventDefault()
    if (!org || !channelId || !body.trim() || org?.role==='read_only') return
    setBusy(true); setError('')
    const result = await supabase.from('team_messages').insert({
      organization_id: org.organizationId,
      channel_id: channelId,
      sender_id: session.user.id,
      body: body.trim(),
    })
    if (result.error) setError(result.error.message)
    else { setBody(''); await loadMessages(channelId) }
    setBusy(false)
  }

  return <section className="page">
    <div className="page-head"><div><span className="date-kicker">{lang==='es'?'CHAT DEL EQUIPO EN VIVO':'LIVE TEAM CHAT'}</span><h1>{lang==='es'?'Chat del equipo':'Team Chat'}</h1><p>{lang==='es'?'Canales del consultorio y conversaciones internas del personal.':'Practice channels and internal staff conversations.'}</p></div><button className="refresh-button" onClick={()=>void loadMessages()}><RefreshCw size={15}/>{lang==='es'?'Actualizar':'Refresh'}</button></div>
    {orgLoading ? <div className="live-loading">Loading team chat…</div> : orgError ? <ErrorBox message={orgError} lang={lang}/> :
    <div className="chat-layout">
      <aside className="chat-channels">
        <div className="chat-channel-title"><strong>{lang==='es'?'Canales':'Channels'}</strong>{['owner','admin','manager'].includes(org?.role||'')&&!channels.length&&<button onClick={()=>void createChannel('general')} disabled={busy}><Plus size={14}/>General</button>}</div>
        {['owner','admin','manager'].includes(org?.role||'')&&<form className="chat-channel-create" onSubmit={e=>{e.preventDefault();void createChannel(newChannel)}}><input value={newChannel} onChange={e=>setNewChannel(e.target.value)} placeholder={lang==='es'?'Nuevo canal':'New channel'}/><button disabled={busy||!newChannel.trim()}><Plus size={13}/></button></form>}
        {channels.map(c=><button key={String(c.id)} className={channelId===String(c.id)?'active':''} onClick={()=>setChannelId(String(c.id))}># {text(c.name)||'channel'}{c.is_private===true?' 🔒':''}</button>)}
      </aside>
      <section className="panel chat-main">
        {error && <ErrorBox message={error} lang={lang}/>}
        {!channelId ? <Empty message={lang==='es'?'Aún no hay canal del equipo':'No team channel yet'} lang={lang}/> :
        <>
          <div className="chat-messages">{messages.length ? messages.map((m,i)=><div className={String(m.sender_id)===session.user.id?'chat-message mine':'chat-message'} key={text(m.id)||String(i)}><div><strong>{String(m.sender_id)===session.user.id?'You':'Team member'}</strong><span>{text(m.created_at).replace('T',' ').slice(0,16)}</span></div><p>{text(m.body)}</p></div>) : <Empty message={lang==='es'?'Aún no hay mensajes':'No messages yet'} lang={lang}/>}</div>
          {org?.role==='read_only'?<div className="inbox-readonly-note">{lang==='es'?'Tu rol tiene acceso de solo lectura.':'Your role has read-only access.'}</div>:<form className="chat-compose" onSubmit={sendMessage}><input value={body} onChange={e=>setBody(e.target.value)} placeholder={lang==='es'?'Mensaje al equipo…':'Message the team…'} /><button disabled={busy || !body.trim()}><Send size={16}/>{lang==='es'?'Enviar':'Send'}</button></form>}
        </>}
      </section>
    </div>}
  </section>
}

function ManualPage({lang}:{lang:'en'|'es'}) {
  const sections = lang==='es' ? [
    ['Primeros pasos','Inicia sesión, elige tu consultorio, revisa el Resumen y usa la navegación izquierda para moverte por los flujos de pacientes y operaciones.'],
    ['Agenda','Usa Agenda para citas y coordinación de proveedores. Las reservas del sitio web y las citas creadas por el personal aparecen en el mismo flujo.'],
    ['Pacientes y clínica','Los registros de pacientes conectan contacto, citas, registros clínicos, documentos, óptica, seguros y facturación.'],
    ['Comunicaciones','Bandeja, Teléfono y Chat del equipo separan la comunicación con pacientes de la colaboración interna.'],
    ['Seguridad','Oculivo usa acceso por organización y seguridad a nivel de fila en Supabase para separar los datos de cada consultorio.'],
  ] : [
    ['Getting started','Sign in, choose your practice, review the Overview, and use the left navigation to move through patient and office workflows.'],
    ['Scheduling','Use Schedule for appointments and provider coordination. Website bookings and staff-created appointments appear in the same operational flow.'],
    ['Patients & clinical','Patient records connect practice contact information with appointments, clinical records, documents, optical, insurance, and billing workflows.'],
    ['Communications','Inbox, Phone, and Team Chat separate patient-facing communication from internal staff collaboration.'],
    ['Security','Oculivo uses organization-scoped access controls and Supabase row-level security to keep practice data separated.'],
  ]
  return <section className="page"><div className="page-head"><div><span className="date-kicker">{lang==='es'?'MANUAL DE OCULIVO':'OCULIVO MANUAL'}</span><h1>Manual</h1><p>{lang==='es'?'Guía rápida del producto para el personal del consultorio.':'Quick product guidance for practice staff.'}</p></div></div><div className="manual-grid">{sections.map(([title,body])=><article className="panel manual-card" key={title}><h2>{title}</h2><p>{body}</p></article>)}</div></section>
}

export function LiveModulePage({path,title,description,session,lang}:{path:string;title:string;description:string;session:Session;lang:'en'|'es'}) {
  if (path === '/patients') return <PatientsOps session={session} lang={lang}/>
  if (path === '/schedule') return <ScheduleOps session={session} lang={lang}/>
  if (path === '/clinical') return <ClinicalOps session={session} lang={lang}/>
  if (path === '/optical') return <OpticalOps session={session} lang={lang}/>
  if (path === '/timeclock') return <TimeclockOps session={session} lang={lang}/>
  if (path === '/billing') return <BillingOps session={session} lang={lang}/>
  if (path === '/documents') return <DocumentsOps session={session} lang={lang}/>
  if (path === '/inbox') return <InboxComms session={session} lang={lang}/>
  if (path === '/phone') return <PhoneOps session={session} lang={lang}/>
  if (path === '/support') return <SupportOps session={session} lang={lang}/>
  if (path === '/team-chat') return <TeamChat session={session} lang={lang}/>
  if (path === '/manual') return <ManualPage lang={lang}/>
  if (path === '/reports') return <ReportsPage session={session} lang={lang}/>
  return <GenericLivePage path={path} title={title} description={description} session={session} lang={lang}/>
}

export function LiveOverview({session,lang}:{session:Session;lang:'en'|'es'}) {
  const {org,error:orgError,loading:orgLoading} = useOrg(session)
  const [stats,setStats] = useState({appointments:0,patients:0,conversations:0,timeEntries:0})
  const [appointments,setAppointments] = useState<Row[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

  async function load() {
    if (!org) return
    setLoading(true); setError('')
    const [a,p,c,t,arows] = await Promise.all([
      supabase.from('appointments').select('id',{count:'exact',head:true}).eq('organization_id',org.organizationId),
      supabase.from('patients').select('id',{count:'exact',head:true}).eq('organization_id',org.organizationId),
      supabase.from('communication_threads').select('id',{count:'exact',head:true}).eq('organization_id',org.organizationId),
      supabase.from('time_entries').select('id',{count:'exact',head:true}).eq('organization_id',org.organizationId),
      supabase.from('appointments').select('*').eq('organization_id',org.organizationId).limit(8),
    ])
    const firstError = a.error || p.error || c.error || t.error || arows.error
    if (firstError) setError(firstError.message)
    setStats({appointments:a.count||0,patients:p.count||0,conversations:c.count||0,timeEntries:t.count||0})
    setAppointments((arows.data||[]) as Row[])
    setLoading(false)
  }

  useEffect(()=>{void load()},[org?.organizationId])

  return <section className="page overview-page">
    <div className="page-head overview-head"><div><span className="date-kicker">{lang==='es'?'DATOS EN VIVO DEL CONSULTORIO':'LIVE PRACTICE DATA'}</span><h1>{lang==='es'?'Resumen':'Overview'}</h1><p>{org ? (lang==='es'?`Esto es lo que está pasando en ${org.organizationName}.`:`Here’s what’s happening across ${org.organizationName}.`) : (lang==='es'?'Cargando tu consultorio…':'Loading your practice…')}</p></div><button className="refresh-button" onClick={()=>void load()}><RefreshCw size={15}/>{lang==='es'?'Actualizar':'Refresh'}</button></div>
    {orgError && <ErrorBox message={orgError} lang={lang}/>}
    {error && <ErrorBox message={error} lang={lang}/>}
    <div className="metric-grid">
      <article className="metric-card"><div><span>{lang==='es'?'Citas':'Appointments'}</span><CalendarDays size={17}/></div><strong>{orgLoading||loading?'…':stats.appointments}</strong><p>{lang==='es'?'Citas del consultorio':'Practice appointments'}</p></article>
      <article className="metric-card"><div><span>{lang==='es'?'Pacientes':'Patients'}</span><Users size={17}/></div><strong>{orgLoading||loading?'…':stats.patients}</strong><p>{lang==='es'?'Registros de pacientes':'Patient records'}</p></article>
      <article className="metric-card"><div><span>{lang==='es'?'Conversaciones':'Conversations'}</span><MessageSquareText size={17}/></div><strong>{orgLoading||loading?'…':stats.conversations}</strong><p>{lang==='es'?'Hilos de comunicación':'Communication threads'}</p></article>
      <article className="metric-card"><div><span>{lang==='es'?'Registros de tiempo':'Time entries'}</span><CalendarDays size={17}/></div><strong>{orgLoading||loading?'…':stats.timeEntries}</strong><p>{lang==='es'?'Tiempo del personal':'Staff time records'}</p></article>
    </div>
    <div className="overview-grid">
      <section className="panel schedule-panel"><div className="panel-title-row"><div><h2>{lang==='es'?'Flujo de pacientes':'Patient flow'}</h2><p>{lang==='es'?'Citas recientes de este consultorio':'Recent appointments in this practice'}</p></div><Link to="/schedule">{lang==='es'?'Ver agenda completa':'View full schedule'}</Link></div><Records rows={appointments} lang={lang}/></section>
      <section className="panel inbox-panel"><div className="panel-title-row"><div><h2>{lang==='es'?'Estado del consultorio':'Practice status'}</h2><p>{lang==='es'?'Resumen conectado del backend':'Connected backend snapshot'}</p></div></div><div className="overview-status"><span><b>{org?.organizationName||(lang==='es'?'Consultorio':'Practice')}</b>{lang==='es'?'Organización':'Organization'}</span><span><b>{org?.role||'—'}</b>{lang==='es'?'Tu rol':'Your role'}</span><span><b>{stats.conversations}</b>{lang==='es'?'Hilos de comunicación':'Communication threads'}</span></div></section>
    </div>
  </section>
}

function ReportsPage({session,lang}:{session:Session;lang:'en'|'es'}) {
  const {org,error:orgError,loading:orgLoading} = useOrg(session)
  const [counts,setCounts] = useState<Record<string,number>>({})
  const [error,setError] = useState('')

  const sources = useMemo(()=>[
    [lang==='es'?'Pacientes':'Patients','patients'],[lang==='es'?'Citas':'Appointments','appointments'],[lang==='es'?'Registros clínicos':'Clinical records','clinical_records'],
    [lang==='es'?'Órdenes ópticas':'Optical orders','optical_orders'],[lang==='es'?'Reclamaciones':'Claims','insurance_claims'],[lang==='es'?'Facturas':'Invoices','invoices'],
    [lang==='es'?'Pagos':'Payments','payments'],[lang==='es'?'Mensajes':'Messages','communication_messages'],[lang==='es'?'Tickets de soporte':'Support tickets','support_tickets'],
  ] as const,[lang])

  useEffect(()=>{
    if(!org)return
    ;(async()=>{
      const results=await Promise.all(sources.map(async([label,table])=>{
        const r=await supabase.from(table).select('id',{count:'exact',head:true}).eq('organization_id',org.organizationId)
        return [label,r.count||0,r.error?.message||''] as const
      }))
      const bad=results.find(x=>x[2])
      if(bad)setError(bad[2])
      setCounts(Object.fromEntries(results.map(([label,count])=>[label,count])))
    })()
  },[org?.organizationId])

  return <section className="page"><div className="page-head"><div><span className="date-kicker">{lang==='es'?'REPORTES EN VIVO':'LIVE REPORTING'}</span><h1>{lang==='es'?'Reportes':'Reports'}</h1><p>{lang==='es'?'Conteos actuales de registros en los flujos principales de Oculivo.':'Current record counts across core Oculivo workflows.'}</p></div></div>
    {orgLoading?<div className="live-loading">Loading reports…</div>:orgError?<ErrorBox message={orgError} lang={lang}/>:error?<ErrorBox message={error} lang={lang}/>:<div className="report-grid">{sources.map(([label])=><article className="panel report-card" key={label}><span>{label}</span><strong>{counts[label]??0}</strong></article>)}</div>}
  </section>
}
