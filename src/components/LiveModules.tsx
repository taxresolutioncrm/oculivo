import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { CalendarDays, MessageSquareText, Plus, RefreshCw, Search, Send, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BillingOps, ClinicalOps, DocumentsOps, OpticalOps, PatientsOps, ScheduleOps, SupportOps, TimeclockOps } from './OperationalModules'
import { InboxComms, PhoneOps } from './CommunicationsModules'

type Row = Record<string, unknown>
function localized(v:unknown,lang:'en'|'es'){
 const raw=text(v),k=raw.toLowerCase().replace(/[ -]+/g,'_')
 if(lang!=='es')return raw
 const m:Record<string,string>={active:'Activo',archived:'Archivado',inactive:'Inactivo',draft:'Borrador',signed:'Firmado',pending:'Pendiente',scheduled:'Programada',confirmed:'Confirmada',completed:'Completada',cancelled:'Cancelada',canceled:'Cancelada',paid:'Pagada',unpaid:'Sin pagar',partial:'Parcial',open:'Abierto',closed:'Cerrado',email:'Correo',sms:'SMS',phone:'Teléfono',general:'General'}
 return m[k]||raw
}

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
        setError(memberships.error?.message || (document.documentElement.lang==='es'?'No se encontró una membresía activa de Oculivo para esta cuenta.':'No active Oculivo organization membership was found for this account.'))
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
        organizationName: text(organization.data?.name) || (document.documentElement.lang==='es'?'Tu consultorio':'Your practice'),
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
        <div className="record-card-head"><div><strong>{rowTitle(row)}</strong><span>{rowMeta(row)}</span></div>{text(row.status) && <span className="status-badge">{localized(row.status,lang)}</span>}</div>
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
  useEffect(()=>{
    if(!org?.organizationId)return
    const ch=supabase.channel('oculivo-team-channels-'+org.organizationId)
      .on('postgres_changes',{event:'*',schema:'public',table:'team_channels',filter:'organization_id=eq.'+org.organizationId},()=>void loadChannels())
      .subscribe()
    return()=>{void supabase.removeChannel(ch)}
  },[org?.organizationId])
  useEffect(()=>{
    if(!org?.organizationId||!channelId)return
    const ch=supabase.channel('oculivo-team-messages-'+channelId)
      .on('postgres_changes',{event:'*',schema:'public',table:'team_messages',filter:'channel_id=eq.'+channelId},()=>void loadMessages(channelId))
      .subscribe()
    return()=>{void supabase.removeChannel(ch)}
  },[org?.organizationId,channelId])

  async function createChannel(name='general') {
    if (!org || !['owner','admin'].includes(org?.role||'')) return
    const clean=name.trim().toLowerCase().replace(/[^a-z0-9-_ ]+/g,'').replace(/\s+/g,'-').slice(0,40)
    if(!clean)return
    setBusy(true); setError('')
    const existing=channels.find(c=>text(c.name).toLowerCase()===clean)
    if(existing){setChannelId(String(existing.id));setNewChannel('');setBusy(false);return}
    const result = await supabase.from('team_channels').insert({
      organization_id: org.organizationId,
      name: clean,
      description: clean==='general' ? (document.documentElement.lang==='es'?'Chat general del consultorio':'Practice-wide team chat') : (document.documentElement.lang==='es'?'Canal del equipo del consultorio':'Practice team channel'),
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
    {orgLoading ? <div className="live-loading">{lang==='es'?'Cargando chat del equipo…':'Loading team chat…'}</div> : orgError ? <ErrorBox message={orgError} lang={lang}/> :
    <div className="chat-layout">
      <aside className="chat-channels">
        <div className="chat-channel-title"><strong>{lang==='es'?'Canales':'Channels'}</strong>{['owner','admin'].includes(org?.role||'')&&!channels.length&&<button onClick={()=>void createChannel('general')} disabled={busy}><Plus size={14}/>General</button>}</div>
        {['owner','admin'].includes(org?.role||'')&&<form className="chat-channel-create" onSubmit={e=>{e.preventDefault();void createChannel(newChannel)}}><input value={newChannel} onChange={e=>setNewChannel(e.target.value)} placeholder={lang==='es'?'Nuevo canal':'New channel'}/><button type="submit" disabled={busy||!newChannel.trim()}><Plus size={13}/></button></form>}
        {channels.map(c=><button key={String(c.id)} className={channelId===String(c.id)?'active':''} onClick={()=>setChannelId(String(c.id))}># {text(c.name)||(lang==='es'?'canal':'channel')}{c.is_private===true?' 🔒':''}</button>)}
      </aside>
      <section className="panel chat-main">
        {error && <ErrorBox message={error} lang={lang}/>}
        {!channelId ? <Empty message={lang==='es'?'Aún no hay canal del equipo':'No team channel yet'} lang={lang}/> :
        <>
          <div className="chat-messages">{messages.length ? messages.map((m,i)=><div className={String(m.sender_id)===session.user.id?'chat-message mine':'chat-message'} key={text(m.id)||String(i)}><div><strong>{String(m.sender_id)===session.user.id?(lang==='es'?'Tú':'You'):(lang==='es'?'Miembro del equipo':'Team member')}</strong><span>{text(m.created_at).replace('T',' ').slice(0,16)}</span></div><p>{text(m.body)}</p></div>) : <Empty message={lang==='es'?'Aún no hay mensajes':'No messages yet'} lang={lang}/>}</div>
          {org?.role==='read_only'?<div className="inbox-readonly-note">{lang==='es'?'Tu rol tiene acceso de solo lectura.':'Your role has read-only access.'}</div>:<form className="chat-compose" onSubmit={sendMessage}><input value={body} onChange={e=>setBody(e.target.value)} placeholder={lang==='es'?'Mensaje al equipo…':'Message the team…'} /><button type="submit" disabled={busy || !body.trim()}><Send size={16}/>{lang==='es'?'Enviar':'Send'}</button></form>}
        </>}
      </section>
    </div>}
  </section>
}

function ManualPage({lang}:{lang:'en'|'es'}) {
  const [query,setQuery]=useState('')
  const sections = lang==='es' ? [
    ['Primeros pasos','Inicia sesión, elige tu consultorio, revisa el Resumen y usa la navegación izquierda para moverte por los flujos de pacientes y operaciones.'],
    ['Agenda','Usa Agenda para crear y editar citas, asignar proveedores y ubicaciones, y evitar conflictos de horario del proveedor.'],
    ['Pacientes','Crea y edita perfiles, archiva pacientes y abre el historial conectado de citas, clínica, óptica, documentos y facturación según tus permisos.'],
    ['Clínica','Los usuarios clínicos autorizados pueden crear y editar registros, documentar agudeza visual, presión intraocular, evaluación y plan de tratamiento, y firmar el registro.'],
    ['Óptica','Administra órdenes ópticas, estados de pedido e inventario con cantidades, puntos de reorden, costos y precios de venta.'],
    ['Bandeja','Inicia y responde conversaciones de correo y SMS. Los hilos y mensajes se actualizan en tiempo real dentro del consultorio.'],
    ['Teléfono y fax','Marca números E.164 desde el navegador, conserva el historial de llamadas y envía faxes PDF privados desde un hilo telefónico.'],
    ['Chat del equipo','Usa canales internos del consultorio para colaboración en tiempo real.'],
    ['Reloj','Marca entrada y salida y revisa horas del día, de la semana y por turno.'],
    ['Facturación','Los roles autorizados pueden crear facturas, registrar pagos, crear y editar reclamaciones y revisar métricas financieras.'],
    ['Documentos','Sube PDF e imágenes a almacenamiento privado, abre enlaces firmados temporales y elimina documentos cuando tu rol lo permite.'],
    ['Firmas electrónicas','Crea sobres PDF, coloca campos, envía solicitudes, reenvía, rastrea, anula y conserva evidencia y certificados de firma.'],
    ['Reportes','Revisa conteos operativos y, para roles de facturación, métricas financieras actuales del consultorio.'],
    ['Soporte','Envía tickets de soporte a RomyLabs desde el CRM y conserva la copia local del ticket.'],
    ['IA','Oculivo AI puede ayudar con guía de flujos y resumir la información que proporciones dentro del alcance permitido para la práctica.'],
    ['Seguridad','Oculivo usa acceso por organización, controles de rol y seguridad a nivel de fila para separar los datos de cada consultorio.'],
  ] : [
    ['Getting started','Sign in, choose your practice, review the Overview, and use the left navigation to move through patient and office workflows.'],
    ['Scheduling','Use Schedule to create and edit appointments, assign providers and locations, and prevent provider time conflicts.'],
    ['Patients','Create and edit profiles, archive patients, and open connected appointment, clinical, optical, document, and billing history according to your role.'],
    ['Clinical','Authorized clinical users can create and edit records, document visual acuity, intraocular pressure, assessment and treatment plan, and sign the record.'],
    ['Optical','Manage optical orders, order status progression, and inventory quantities, reorder points, cost, and retail pricing.'],
    ['Inbox','Start and reply to email and SMS conversations. Threads and messages update in real time within the practice.'],
    ['Phone & fax','Dial E.164 numbers from the browser, retain call history, and send private PDF faxes from a phone thread.'],
    ['Team Chat','Use internal practice channels for real-time staff collaboration.'],
    ['Timeclock','Clock in and out and review daily, weekly, and per-shift hours.'],
    ['Billing','Authorized roles can create invoices, record payments, create and edit claims, and review financial metrics.'],
    ['Documents','Upload PDFs and images to private storage, open temporary signed links, and delete documents when your role allows it.'],
    ['E-Signatures','Create PDF envelopes, place fields, send requests, resend, track, void, and retain signing evidence and certificates.'],
    ['Reports','Review operational counts and, for billing roles, current practice financial metrics.'],
    ['Support','Submit support tickets to RomyLabs from the CRM and retain the local ticket mirror.'],
    ['AI','Oculivo AI can help with workflow guidance and summarize information you provide within the authorized practice scope.'],
    ['Security','Oculivo uses organization-scoped access, role controls, and row-level security to separate practice data.'],
  ]
  const q=query.trim().toLowerCase()
  const visible=q?sections.filter(([title,body])=>(title+' '+body).toLowerCase().includes(q)):sections
  return <section className="page"><div className="page-head"><div><span className="date-kicker">{lang==='es'?'CENTRO DE AYUDA DE OCULIVO':'OCULIVO HELP CENTER'}</span><h1>{lang==='es'?'Manual':'Manual'}</h1><p>{lang==='es'?'Busca instrucciones de los flujos disponibles en Oculivo.':'Search guidance for the workflows available in Oculivo.'}</p></div></div><div className="searchbox" style={{marginBottom:18,maxWidth:620}}><Search size={18}/><input aria-label={lang==='es'?'Buscar en el manual':'Search manual'} value={query} onChange={e=>setQuery(e.target.value)} placeholder={lang==='es'?'Buscar agenda, facturación, fax, firmas…':'Search scheduling, billing, fax, signatures…'}/></div>{visible.length?<div className="manual-grid">{visible.map(([title,body])=><article className="panel manual-card" key={title}><h2>{title}</h2><p>{body}</p></article>)}</div>:<Empty message={lang==='es'?'No se encontraron temas del manual':'No manual topics found'} lang={lang}/>}</section>
}

export function LiveModulePage({path,title,description,session,lang}:{path:string;title:string;description:string;session:Session;lang:'en'|'es'}) {
  if (path === '/patients') return <section className="page"><PatientsOps session={session} lang={lang}/></section>
  if (path === '/schedule') return <section className="page"><ScheduleOps session={session} lang={lang}/></section>
  if (path === '/clinical') return <section className="page"><ClinicalOps session={session} lang={lang}/></section>
  if (path === '/optical') return <section className="page"><OpticalOps session={session} lang={lang}/></section>
  if (path === '/timeclock') return <section className="page"><TimeclockOps session={session} lang={lang}/></section>
  if (path === '/billing') return <section className="page"><BillingOps session={session} lang={lang}/></section>
  if (path === '/documents') return <section className="page"><DocumentsOps session={session} lang={lang}/></section>
  if (path === '/inbox') return <section className="page"><InboxComms session={session} lang={lang}/></section>
  if (path === '/phone') return <section className="page"><PhoneOps session={session} lang={lang}/></section>
  if (path === '/support') return <section className="page"><SupportOps session={session} lang={lang}/></section>
  if (path === '/team-chat') return <TeamChat session={session} lang={lang}/>
  if (path === '/manual') return <ManualPage lang={lang}/>
  if (path === '/reports') return <ReportsPage session={session} lang={lang}/>
  return <GenericLivePage path={path} title={title} description={description} session={session} lang={lang}/>
}

export function LiveOverview({session,lang}:{session:Session;lang:'en'|'es'}) {
  const {org,error:orgError,loading:orgLoading} = useOrg(session)
  const [stats,setStats] = useState({appointments:0,patients:0,conversations:0,timeEntries:0})
  const [appointments,setAppointments] = useState<Row[]>([])
  const [patientNames,setPatientNames] = useState<Record<string,string>>({})
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

  async function load() {
    if (!org) return
    setLoading(true); setError('')
    const canReadCommunications=['owner','admin','manager','provider','staff'].includes(org.role)
    const [a,p,c,t,arows,patients] = await Promise.all([
      supabase.from('appointments').select('id',{count:'exact',head:true}).eq('organization_id',org.organizationId),
      supabase.from('patients').select('id',{count:'exact',head:true}).eq('organization_id',org.organizationId),
      canReadCommunications
        ? supabase.from('communication_threads').select('id',{count:'exact',head:true}).eq('organization_id',org.organizationId)
        : Promise.resolve({count:0,error:null}),
      supabase.from('time_entries').select('id',{count:'exact',head:true}).eq('organization_id',org.organizationId),
      supabase.from('appointments').select('id,patient_id,starts_at,ends_at,status,appointment_type,room').eq('organization_id',org.organizationId).gte('starts_at',new Date().toISOString()).order('starts_at',{ascending:true}).limit(8),
      supabase.from('patients').select('id,first_name,last_name').eq('organization_id',org.organizationId).limit(500),
    ])
    const firstError = a.error || p.error || c.error || t.error || arows.error || patients.error
    if (firstError) setError(firstError.message)
    setStats({appointments:a.count||0,patients:p.count||0,conversations:c.count||0,timeEntries:t.count||0})
    setAppointments((arows.data||[]) as Row[])
    setPatientNames(Object.fromEntries((patients.data||[]).map((x:any)=>[String(x.id),[x.first_name,x.last_name].filter(Boolean).join(' ')||'Patient'])))
    setLoading(false)
  }

  useEffect(()=>{void load()},[org?.organizationId])

  const fmtDate=(v:any)=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—'
  const fmtTime=(v:any)=>v?new Date(v).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'—'

  return <section className="page overview-page">
    <div className="page-head overview-head"><div><span className="date-kicker">{lang==='es'?'DATOS EN VIVO DEL CONSULTORIO':'LIVE PRACTICE DATA'}</span><h1>{lang==='es'?'Resumen':'Overview'}</h1><p>{org ? (lang==='es'?`Esto es lo que está pasando en ${org.organizationName}.`:`Here’s what’s happening across ${org.organizationName}.`) : (lang==='es'?'Cargando tu consultorio…':'Loading your practice…')}</p></div><button className="refresh-button" onClick={()=>void load()}><RefreshCw size={15}/>{lang==='es'?'Actualizar':'Refresh'}</button></div>
    {orgError && <ErrorBox message={orgError} lang={lang}/>}
    {error && <ErrorBox message={error} lang={lang}/>}
    <div className="metric-grid">
      <Link to="/schedule" className="metric-card metric-link"><div><span>{lang==='es'?'Citas':'Appointments'}</span><CalendarDays size={17}/></div><strong>{orgLoading||loading?'…':stats.appointments}</strong><p>{lang==='es'?'Abrir agenda':'Open schedule'}</p></Link>
      <Link to="/patients" className="metric-card metric-link"><div><span>{lang==='es'?'Pacientes':'Patients'}</span><Users size={17}/></div><strong>{orgLoading||loading?'…':stats.patients}</strong><p>{lang==='es'?'Abrir pacientes':'Open patients'}</p></Link>
      {org&&['owner','admin','manager','provider','staff'].includes(org.role)&&<Link to="/inbox" className="metric-card metric-link"><div><span>{lang==='es'?'Conversaciones':'Conversations'}</span><MessageSquareText size={17}/></div><strong>{orgLoading||loading?'…':stats.conversations}</strong><p>{lang==='es'?'Abrir bandeja':'Open inbox'}</p></Link>}
      <Link to="/timeclock" className="metric-card metric-link"><div><span>{lang==='es'?'Registros de tiempo':'Time entries'}</span><CalendarDays size={17}/></div><strong>{orgLoading||loading?'…':stats.timeEntries}</strong><p>{lang==='es'?'Abrir reloj':'Open timeclock'}</p></Link>
    </div>
    <div className="overview-grid">
      <section className="panel schedule-panel">
        <div className="panel-title-row"><div><h2>{lang==='es'?'Flujo de pacientes':'Patient flow'}</h2><p>{lang==='es'?'Próximas citas del consultorio':'Upcoming appointments in this practice'}</p></div><Link to="/schedule">{lang==='es'?'Ver agenda completa':'View full schedule'}</Link></div>
        <div className="overview-appointment-list">
          {appointments.length?appointments.map((row:any)=><Link to="/schedule" className="overview-appointment" key={String(row.id)}>
            <div className="overview-appointment-time"><strong>{fmtTime(row.starts_at)}</strong><span>{fmtDate(row.starts_at)}</span></div>
            <div className="overview-appointment-patient"><strong>{patientNames[String(row.patient_id)]||(lang==='es'?'Paciente':'Patient')}</strong><span>{row.appointment_type||'Eye care visit'}{row.room?' · '+row.room:''}</span></div>
            <span className="status-badge">{localized(row.status,lang)}</span>
          </Link>):<Empty message={lang==='es'?'No hay citas próximas':'No upcoming appointments'} lang={lang}/>}
        </div>
      </section>
      <section className="panel inbox-panel"><div className="panel-title-row"><div><h2>{lang==='es'?'Estado del consultorio':'Practice status'}</h2><p>{lang==='es'?'Resumen conectado del backend':'Connected practice snapshot'}</p></div></div><div className="overview-status"><span><b>{org?.organizationName||(lang==='es'?'Consultorio':'Practice')}</b>{lang==='es'?'Organización':'Organization'}</span><span><b>{localized(org?.role||'—',lang)}</b>{lang==='es'?'Tu rol':'Your role'}</span><span><b>{stats.conversations}</b>{lang==='es'?'Hilos de comunicación':'Communication threads'}</span><span><b>{stats.patients}</b>{lang==='es'?'Pacientes activos':'Patient records'}</span></div></section>
    </div>
  </section>
}

function ReportsPage({session,lang}:{session:Session;lang:'en'|'es'}) {
  const {org,error:orgError,loading:orgLoading} = useOrg(session)
  const [counts,setCounts] = useState<Record<string,number>>({})
  const [money,setMoney] = useState({invoiced:0,paid:0,claims:0,outstanding:0})
  const [error,setError] = useState('')

  const canReadFinancial=['owner','admin','manager','billing'].includes(org?.role||'')
  const sources = useMemo(()=>{
    const all=[
      [lang==='es'?'Pacientes':'Patients','patients'],
      [lang==='es'?'Citas':'Appointments','appointments'],
      [lang==='es'?'Registros clínicos':'Clinical records','clinical_records'],
      [lang==='es'?'Órdenes ópticas':'Optical orders','optical_orders'],
      [lang==='es'?'Reclamaciones':'Claims','insurance_claims'],
      [lang==='es'?'Facturas':'Invoices','invoices'],
      [lang==='es'?'Pagos':'Payments','payments'],
      [lang==='es'?'Mensajes':'Messages','communication_messages'],
      [lang==='es'?'Tickets de soporte':'Support tickets','support_tickets'],
    ] as const
    return all.filter(([,table])=>{
      if(table==='clinical_records')return ['owner','admin','manager','provider'].includes(org?.role||'')
      if(table==='communication_messages')return ['owner','admin','manager','provider','staff'].includes(org?.role||'')
      if(['insurance_claims','invoices','payments'].includes(table))return ['owner','admin','manager','billing'].includes(org?.role||'')
      return true
    })
  },[lang,org?.role])

  useEffect(()=>{
    if(!org)return
    ;(async()=>{
      setError('')
      const results=await Promise.all(sources.map(async([label,table])=>{
        const r=await supabase.from(table).select('id',{count:'exact',head:true}).eq('organization_id',org.organizationId)
        return [label,r.count||0,r.error?.message||''] as const
      }))
      const bad=results.find(x=>x[2])
      if(bad)setError(bad[2])
      setCounts(Object.fromEntries(results.map(([label,count])=>[label,count])))
      if(canReadFinancial){
        const [invoices,payments,claims]=await Promise.all([
          supabase.from('invoices').select('patient_amount,amount_paid').eq('organization_id',org.organizationId).limit(5000),
          supabase.from('payments').select('amount').eq('organization_id',org.organizationId).limit(5000),
          supabase.from('insurance_claims').select('billed_amount').eq('organization_id',org.organizationId).limit(5000),
        ])
        const first=invoices.error||payments.error||claims.error
        if(first){setError(first.message);return}
        const invoiced=(invoices.data||[]).reduce((sum:any,x:any)=>sum+Number(x.patient_amount||0),0)
        const paid=(payments.data||[]).reduce((sum:any,x:any)=>sum+Number(x.amount||0),0)
        const claimTotal=(claims.data||[]).reduce((sum:any,x:any)=>sum+Number(x.billed_amount||0),0)
        const invoicePaid=(invoices.data||[]).reduce((sum:any,x:any)=>sum+Number(x.amount_paid||0),0)
        setMoney({invoiced,paid,claims:claimTotal,outstanding:Math.max(0,invoiced-invoicePaid)})
      }else setMoney({invoiced:0,paid:0,claims:0,outstanding:0})
    })()
  },[org?.organizationId,sources,canReadFinancial])

  const usd=(v:number)=>v.toLocaleString(undefined,{style:'currency',currency:'USD'})
  return <section className="page"><div className="page-head"><div><span className="date-kicker">{lang==='es'?'REPORTES EN VIVO':'LIVE REPORTING'}</span><h1>{lang==='es'?'Reportes':'Reports'}</h1><p>{lang==='es'?'Conteos actuales y métricas operativas de Oculivo.':'Current Oculivo operational counts and metrics.'}</p></div></div>
    {orgLoading?<div className="live-loading">{lang==='es'?'Cargando reportes…':'Loading reports…'}</div>:orgError?<ErrorBox message={orgError} lang={lang}/>:error?<ErrorBox message={error} lang={lang}/>:<>
      {canReadFinancial&&<div className="metric-grid"><article className="metric-card"><div><span>{lang==='es'?'Responsabilidad facturada':'Patient billed'}</span></div><strong>{usd(money.invoiced)}</strong></article><article className="metric-card"><div><span>{lang==='es'?'Pagos registrados':'Payments recorded'}</span></div><strong>{usd(money.paid)}</strong></article><article className="metric-card"><div><span>{lang==='es'?'Saldo pendiente':'Outstanding'}</span></div><strong>{usd(money.outstanding)}</strong></article><article className="metric-card"><div><span>{lang==='es'?'Reclamaciones facturadas':'Claims billed'}</span></div><strong>{usd(money.claims)}</strong></article></div>}
      <div className="report-grid">{sources.map(([label])=><article className="panel report-card" key={label}><span>{label}</span><strong>{counts[label]??0}</strong></article>)}</div>
    </>}
  </section>
}
