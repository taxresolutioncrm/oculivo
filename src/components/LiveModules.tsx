import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CalendarDays, MessageSquareText, Plus, RefreshCw, Send, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

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
  return key.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      const membership = await supabase
        .from('organization_memberships')
        .select('organization_id,role')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle()
      if (!active) return
      if (membership.error || !membership.data?.organization_id) {
        setError(membership.error?.message || 'No active Oculivo organization membership was found for this account.')
        setLoading(false)
        return
      }
      const organizationId = String(membership.data.organization_id)
      const organization = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .maybeSingle()
      if (!active) return
      setOrg({
        organizationId,
        role: text(membership.data.role) || 'member',
        organizationName: text(organization.data?.name) || 'Your practice',
      })
      setLoading(false)
    })()
    return () => { active = false }
  }, [session.user.id])

  return {org,error,loading}
}

function Empty({message}:{message:string}) {
  return <div className="live-empty"><strong>{message}</strong><p>When data is added to Oculivo it will appear here automatically.</p></div>
}

function ErrorBox({message}:{message:string}) {
  return <div className="live-error"><strong>Unable to load this workspace</strong><p>{message}</p></div>
}

function Records({rows}:{rows:Row[]}) {
  if (!rows.length) return <Empty message="No records yet" />
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

function GenericLivePage({path,title,description,session}:{path:string;title:string;description:string;session:Session}) {
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
      <div><span className="date-kicker">LIVE OCULIVO DATA</span><h1>{title}</h1><p>{description}</p></div>
      <button className="refresh-button" onClick={()=>void load()} disabled={loading || !org}><RefreshCw size={15}/>{loading?'Loading…':'Refresh'}</button>
    </div>
    {org && <div className="org-context"><strong>{org.organizationName}</strong><span>{org.role}</span></div>}
    <div className="panel live-panel">
      {orgLoading || loading ? <div className="live-loading">Loading {title.toLowerCase()}…</div> :
       orgError ? <ErrorBox message={orgError}/> :
       error ? <ErrorBox message={error}/> :
       <Records rows={rows}/>}
    </div>
  </section>
}

function TeamChat({session}:{session:Session}) {
  const {org,error:orgError,loading:orgLoading} = useOrg(session)
  const [channels,setChannels] = useState<Row[]>([])
  const [channelId,setChannelId] = useState('')
  const [messages,setMessages] = useState<Row[]>([])
  const [body,setBody] = useState('')
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)

  async function loadChannels() {
    if (!org) return
    const result = await supabase.from('team_channels').select('*').eq('organization_id',org.organizationId)
    if (result.error) { setError(result.error.message); return }
    const next = (result.data || []) as Row[]
    setChannels(next)
    if (!channelId && next[0]?.id) setChannelId(String(next[0].id))
  }

  async function loadMessages(id=channelId) {
    if (!org || !id) { setMessages([]); return }
    const result = await supabase.from('team_messages').select('*').eq('organization_id',org.organizationId).eq('channel_id',id).limit(100)
    if (result.error) setError(result.error.message)
    else setMessages((result.data || []) as Row[])
  }

  useEffect(()=>{void loadChannels()},[org?.organizationId])
  useEffect(()=>{void loadMessages(channelId)},[channelId,org?.organizationId])

  async function createGeneral() {
    if (!org) return
    setBusy(true); setError('')
    const result = await supabase.from('team_channels').insert({
      organization_id: org.organizationId,
      name: 'general',
      description: 'Practice-wide team chat',
      is_private: false,
      created_by: session.user.id,
    }).select('*').single()
    if (result.error) setError(result.error.message)
    else {
      await loadChannels()
      if (result.data?.id) setChannelId(String(result.data.id))
    }
    setBusy(false)
  }

  async function sendMessage(e:React.FormEvent) {
    e.preventDefault()
    if (!org || !channelId || !body.trim()) return
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
    <div className="page-head"><div><span className="date-kicker">LIVE TEAM CHAT</span><h1>Team Chat</h1><p>Practice channels and internal staff conversations.</p></div><button className="refresh-button" onClick={()=>void loadMessages()}><RefreshCw size={15}/>Refresh</button></div>
    {orgLoading ? <div className="live-loading">Loading team chat…</div> : orgError ? <ErrorBox message={orgError}/> :
    <div className="chat-layout">
      <aside className="chat-channels">
        <div className="chat-channel-title"><strong>Channels</strong>{!channels.length && <button onClick={()=>void createGeneral()} disabled={busy}><Plus size={14}/>General</button>}</div>
        {channels.map(c=><button key={String(c.id)} className={channelId===String(c.id)?'active':''} onClick={()=>setChannelId(String(c.id))}># {text(c.name)||'channel'}{c.is_private===true?' 🔒':''}</button>)}
      </aside>
      <section className="panel chat-main">
        {error && <ErrorBox message={error}/>}
        {!channelId ? <Empty message="No team channel yet"/> :
        <>
          <div className="chat-messages">{messages.length ? messages.map((m,i)=><div className={String(m.sender_id)===session.user.id?'chat-message mine':'chat-message'} key={text(m.id)||String(i)}><div><strong>{String(m.sender_id)===session.user.id?'You':'Team member'}</strong><span>{text(m.created_at).replace('T',' ').slice(0,16)}</span></div><p>{text(m.body)}</p></div>) : <Empty message="No messages yet"/>}</div>
          <form className="chat-compose" onSubmit={sendMessage}><input value={body} onChange={e=>setBody(e.target.value)} placeholder="Message the team…" /><button disabled={busy || !body.trim()}><Send size={16}/>Send</button></form>
        </>}
      </section>
    </div>}
  </section>
}

function ManualPage() {
  const sections = [
    ['Getting started','Sign in, choose your practice, review the Overview, and use the left navigation to move through patient and office workflows.'],
    ['Scheduling','Use Schedule for appointments and provider coordination. Website bookings and staff-created appointments appear in the same operational flow.'],
    ['Patients & clinical','Patient records connect practice contact information with appointments, clinical records, documents, optical, insurance, and billing workflows.'],
    ['Communications','Inbox, Phone, and Team Chat separate patient-facing communication from internal staff collaboration.'],
    ['Security','Oculivo uses organization-scoped access controls and Supabase row-level security to keep practice data separated.'],
  ]
  return <section className="page"><div className="page-head"><div><span className="date-kicker">OCULIVO MANUAL</span><h1>Manual</h1><p>Quick product guidance for practice staff.</p></div></div><div className="manual-grid">{sections.map(([title,body])=><article className="panel manual-card" key={title}><h2>{title}</h2><p>{body}</p></article>)}</div></section>
}

export function LiveModulePage({path,title,description,session}:{path:string;title:string;description:string;session:Session}) {
  if (path === '/team-chat') return <TeamChat session={session}/>
  if (path === '/manual') return <ManualPage/>
  if (path === '/reports') return <ReportsPage session={session}/>
  return <GenericLivePage path={path} title={title} description={description} session={session}/>
}

export function LiveOverview({session}:{session:Session}) {
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
    <div className="page-head overview-head"><div><span className="date-kicker">LIVE PRACTICE DATA</span><h1>Overview</h1><p>{org ? `Here’s what’s happening across ${org.organizationName}.` : 'Loading your practice…'}</p></div><button className="refresh-button" onClick={()=>void load()}><RefreshCw size={15}/>Refresh</button></div>
    {orgError && <ErrorBox message={orgError}/>}
    {error && <ErrorBox message={error}/>}
    <div className="metric-grid">
      <article className="metric-card"><div><span>Appointments</span><CalendarDays size={17}/></div><strong>{orgLoading||loading?'…':stats.appointments}</strong><p>Practice appointments</p></article>
      <article className="metric-card"><div><span>Patients</span><Users size={17}/></div><strong>{orgLoading||loading?'…':stats.patients}</strong><p>Patient records</p></article>
      <article className="metric-card"><div><span>Conversations</span><MessageSquareText size={17}/></div><strong>{orgLoading||loading?'…':stats.conversations}</strong><p>Communication threads</p></article>
      <article className="metric-card"><div><span>Time entries</span><CalendarDays size={17}/></div><strong>{orgLoading||loading?'…':stats.timeEntries}</strong><p>Staff time records</p></article>
    </div>
    <div className="overview-grid">
      <section className="panel schedule-panel"><div className="panel-title-row"><div><h2>Patient flow</h2><p>Recent appointments in this practice</p></div><a href="/schedule">View full schedule</a></div><Records rows={appointments}/></section>
      <section className="panel inbox-panel"><div className="panel-title-row"><div><h2>Practice status</h2><p>Connected backend snapshot</p></div></div><div className="overview-status"><span><b>{org?.organizationName||'Practice'}</b>Organization</span><span><b>{org?.role||'—'}</b>Your role</span><span><b>{stats.conversations}</b>Communication threads</span></div></section>
    </div>
  </section>
}

function ReportsPage({session}:{session:Session}) {
  const {org,error:orgError,loading:orgLoading} = useOrg(session)
  const [counts,setCounts] = useState<Record<string,number>>({})
  const [error,setError] = useState('')

  const sources = useMemo(()=>[
    ['Patients','patients'],['Appointments','appointments'],['Clinical records','clinical_records'],
    ['Optical orders','optical_orders'],['Claims','insurance_claims'],['Invoices','invoices'],
    ['Payments','payments'],['Messages','communication_messages'],['Support tickets','support_tickets'],
  ] as const,[])

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

  return <section className="page"><div className="page-head"><div><span className="date-kicker">LIVE REPORTING</span><h1>Reports</h1><p>Current record counts across core Oculivo workflows.</p></div></div>
    {orgLoading?<div className="live-loading">Loading reports…</div>:orgError?<ErrorBox message={orgError}/>:error?<ErrorBox message={error}/>:<div className="report-grid">{sources.map(([label])=><article className="panel report-card" key={label}><span>{label}</span><strong>{counts[label]??0}</strong></article>)}</div>}
  </section>
}
