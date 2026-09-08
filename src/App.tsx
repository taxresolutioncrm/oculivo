import { useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, CalendarDays, CircleDollarSign, Glasses, Inbox, LayoutDashboard,
  Menu, MessageSquareText, Phone, Search, Stethoscope, TicketCheck,
  Timer, Users, X, BarChart3, BookOpen, Plus, ChevronDown, LogOut, Files, Sparkles
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { LiveModulePage, LiveOverview } from './components/LiveModules'
import AssistantDrawer from './components/AssistantDrawer'

type Lang = 'en' | 'es'
type NavItem = { key:string; path:string; icon:LucideIcon; group:'core'|'communications'|'operations'|'help' }
type SearchHit = { table:string; route:string; title:string; meta:string }
type OrgOption = { id:string; name:string; role:string }

const nav:NavItem[] = [
  {key:'overview',path:'/',icon:LayoutDashboard,group:'core'},
  {key:'schedule',path:'/schedule',icon:CalendarDays,group:'core'},
  {key:'patients',path:'/patients',icon:Users,group:'core'},
  {key:'clinical',path:'/clinical',icon:Stethoscope,group:'core'},
  {key:'optical',path:'/optical',icon:Glasses,group:'core'},
  {key:'inbox',path:'/inbox',icon:Inbox,group:'communications'},
  {key:'phone',path:'/phone',icon:Phone,group:'communications'},
  {key:'teamChat',path:'/team-chat',icon:MessageSquareText,group:'communications'},
  {key:'timeclock',path:'/timeclock',icon:Timer,group:'operations'},
  {key:'billing',path:'/billing',icon:CircleDollarSign,group:'operations'},
  {key:'documents',path:'/documents',icon:Files,group:'operations'},
  {key:'reports',path:'/reports',icon:BarChart3,group:'operations'},
  {key:'manual',path:'/manual',icon:BookOpen,group:'help'},
  {key:'support',path:'/support',icon:TicketCheck,group:'help'},
]

const navGroups:{key:NavItem['group'];en:string;es:string}[]=[
  {key:'core',en:'Practice',es:'Consultorio'},
  {key:'communications',en:'Communications',es:'Comunicaciones'},
  {key:'operations',en:'Operations',es:'Operaciones'},
  {key:'help',en:'Help',es:'Ayuda'}
]

const labels:Record<Lang,Record<string,string>> = {
  en:{overview:'Overview',schedule:'Schedule',patients:'Patients',clinical:'Clinical',optical:'Optical',inbox:'Inbox',phone:'Phone',teamChat:'Team Chat',timeclock:'Timeclock',billing:'Billing',documents:'Documents',reports:'Reports',manual:'Manual',support:'Support',practice:'PRACTICE',yourPractice:'Your practice',needHelp:'Need help?',contactSupport:'Contact RomyLabs support',search:'Search patients, calls, orders, messages...',call:'Call',newPatient:'New patient'},
  es:{overview:'Resumen',schedule:'Agenda',patients:'Pacientes',clinical:'Clínica',optical:'Óptica',inbox:'Bandeja',phone:'Teléfono',teamChat:'Chat del equipo',timeclock:'Reloj',billing:'Facturación',documents:'Documentos',reports:'Reportes',manual:'Manual',support:'Soporte',practice:'CONSULTORIO',yourPractice:'Tu consultorio',needHelp:'¿Necesitas ayuda?',contactSupport:'Contactar soporte de RomyLabs',search:'Buscar pacientes, llamadas, órdenes, mensajes...',call:'Llamar',newPatient:'Nuevo paciente'}
}

const moduleCopy:Record<Lang,Record<string,[string,string]>> = {
  en:{
    '/schedule':['Schedule','Appointments, provider schedules, booking, availability, and practice coordination.'],
    '/patients':['Patients','Patient profiles, contact information, intake, history, and practice relationships.'],
    '/clinical':['Clinical','Clinical records and provider workflows with tenant-secured access.'],
    '/optical':['Optical','Inventory, optical orders, frames, lenses, and fulfillment workflows.'],
    '/inbox':['Inbox','Unified email, SMS, phone and patient portal conversations.'],
    '/phone':['Phone','Calls, voicemails, call history and patient communication workflows.'],
    '/team-chat':['Team Chat','Internal channels, private conversations and staff coordination.'],
    '/timeclock':['Timeclock','Employee clock-in, clock-out, time entries and workforce operations.'],
    '/billing':['Billing','Insurance, invoices, payments, balances and revenue-cycle workflows.'],
    '/documents':['Documents','Private practice documents, patient files, clinical attachments, and secure storage.'],
    '/reports':['Reports','Practice operations, patient flow, revenue and team reporting.'],
    '/manual':['Manual','Oculivo help center, product manual and workflow guidance.'],
    '/support':['Support','Support tickets routed into the RomyLabs Admin Portal.'],
  },
  es:{
    '/schedule':['Agenda','Citas, horarios de proveedores, reservas, disponibilidad y coordinación del consultorio.'],
    '/patients':['Pacientes','Perfiles de pacientes, contacto, admisión, historial y relaciones del consultorio.'],
    '/clinical':['Clínica','Registros clínicos y flujos de proveedores con acceso seguro por consultorio.'],
    '/optical':['Óptica','Inventario, órdenes ópticas, monturas, lentes y flujos de entrega.'],
    '/inbox':['Bandeja','Correo, SMS, teléfono y conversaciones del portal del paciente en un solo lugar.'],
    '/phone':['Teléfono','Llamadas, correo de voz, historial y flujos de comunicación con pacientes.'],
    '/team-chat':['Chat del equipo','Canales internos, conversaciones privadas y coordinación del personal.'],
    '/timeclock':['Reloj','Entrada, salida, registros de tiempo y operaciones del personal.'],
    '/billing':['Facturación','Seguros, facturas, pagos, saldos y ciclo de ingresos.'],
    '/documents':['Documentos','Documentos privados, archivos de pacientes, adjuntos clínicos y almacenamiento seguro.'],
    '/reports':['Reportes','Operaciones del consultorio, flujo de pacientes, ingresos y equipo.'],
    '/manual':['Manual','Centro de ayuda de Oculivo, manual del producto y guía de flujos.'],
    '/support':['Soporte','Tickets de soporte enviados al portal administrativo de RomyLabs.'],
  }
}

function Brand(){
  return <div className="oculivo-logo-exact" aria-label="Oculivo">
    <svg viewBox="0 0 64 44" aria-hidden="true"><path d="M3 22C11 7 25 1 32 1c11 0 22 7 29 21-8 14-20 21-29 21C19 43 10 36 3 22Z" fill="#6b22ff"/><path d="M14 22C20 10 27 7 34 7c9 0 17 6 23 15-6 10-14 15-23 15-9 0-15-5-20-15Z" fill="#04b9ff"/><circle cx="33" cy="22" r="10" fill="#11113b"/><circle cx="33" cy="22" r="5.4" fill="#8a58ff"/><circle cx="36" cy="18" r="2.2" fill="#d7f6ff"/></svg>
    <span className="oculivo-word-exact">OCUL<b>IVO</b></span>
  </div>
}

function Login(){
  const [lang,setLang]=useState<Lang>(()=>(localStorage.getItem('oculivo-lang')==='es'?'es':'en'))
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const navigate=useNavigate()
  useEffect(()=>{localStorage.setItem('oculivo-lang',lang);document.documentElement.lang=lang},[lang])

  async function signIn(e:React.FormEvent){
    e.preventDefault(); setError(''); setLoading(true)
    const {error}=await supabase.auth.signInWithPassword({email,password})
    setLoading(false)
    if(error){setError(error.message);return}
    navigate('/')
  }

  async function reset(){
    if(!email){setError(lang==='es'?'Primero ingresa tu correo electrónico.':'Enter your email address first.');return}
    setError('')
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:'https://app.oculivo.com/reset-password'})
    setError(error ? error.message : (lang==='es'?'Correo de restablecimiento enviado.':'Password reset email sent.'))
  }

  return <main className="auth-page">
    <section className="auth-brand"><div className="auth-brand-inner"><Brand/><span className="eyebrow">RomyLabs Core Connect</span><h1>{lang==='es'?'Operaciones modernas para el cuidado de la vista, conectadas.':'Modern eye care operations, connected.'}</h1><p>{lang==='es'?'Agenda, pacientes, flujos clínicos, óptica, facturación, comunicaciones, documentos y operaciones del personal en un solo espacio.':'Scheduling, patients, clinical workflows, optical, billing, communications, documents, and staff operations in one workspace.'}</p></div></section>
    <section className="auth-form-wrap"><form className="auth-card" onSubmit={signIn}><div className="auth-login-lang"><button type="button" className={lang==='en'?'active':''} onClick={()=>setLang('en')}>EN</button><button type="button" className={lang==='es'?'active':''} onClick={()=>setLang('es')}>ES</button></div><div className="brand-mobile"><Brand/></div><h2>{lang==='es'?'Bienvenido de nuevo':'Welcome back'}</h2><p>{lang==='es'?'Inicia sesión en tu espacio de Oculivo.':'Sign in to your Oculivo workspace.'}</p><label>{lang==='es'?'Correo electrónico':'Email'}<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>{lang==='es'?'Contraseña':'Password'}<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="auth-note">{error}</div>}<button className="primary-button" disabled={loading}>{loading?(lang==='es'?'Iniciando sesión…':'Signing in…'):(lang==='es'?'Iniciar sesión':'Sign in')}</button><button className="link-button" type="button" onClick={reset}>{lang==='es'?'¿Olvidaste tu contraseña?':'Forgot password?'}</button></form></section>
  </main>
}

function ResetPassword(){
  const [lang,setLang]=useState<Lang>(()=>(localStorage.getItem('oculivo-lang')==='es'?'es':'en'))
  const [password,setPassword]=useState('')
  const [message,setMessage]=useState('')
  useEffect(()=>{localStorage.setItem('oculivo-lang',lang);document.documentElement.lang=lang},[lang])
  async function submit(e:React.FormEvent){
    e.preventDefault()
    const {error}=await supabase.auth.updateUser({password})
    setMessage(error?error.message:(lang==='es'?'Contraseña actualizada. Ya puedes volver a Oculivo.':'Password updated. You can return to Oculivo.'))
  }
  return <main className="center-page"><form className="auth-card" onSubmit={submit}><div className="auth-login-lang"><button type="button" className={lang==='en'?'active':''} onClick={()=>setLang('en')}>EN</button><button type="button" className={lang==='es'?'active':''} onClick={()=>setLang('es')}>ES</button></div><h2>{lang==='es'?'Establecer nueva contraseña':'Set new password'}</h2><label>{lang==='es'?'Nueva contraseña':'New password'}<input type="password" minLength={12} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{message&&<div className="auth-note">{message}</div>}<button className="primary-button">{lang==='es'?'Actualizar contraseña':'Update password'}</button></form></main>
}

function safeText(v:unknown){return typeof v==='string'||typeof v==='number'?String(v):''}
function hitTitle(row:Record<string,unknown>){
  const first=safeText(row.first_name),last=safeText(row.last_name)
  if(first||last)return [first,last].filter(Boolean).join(' ')
  for(const k of ['name','title','subject','patient_name','body','description','status']){const v=safeText(row[k]);if(v)return v.slice(0,90)}
  return 'Oculivo record'
}
function hitMeta(row:Record<string,unknown>){
  const vals=['email','phone','status','created_at','scheduled_at'].map(k=>safeText(row[k])).filter(Boolean)
  return vals.slice(0,3).join(' · ')
}

function SearchOverlay({session,open,onClose,lang}:{session:Session;open:boolean;onClose:()=>void;lang:Lang}){
  const [query,setQuery]=useState('')
  const [hits,setHits]=useState<SearchHit[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const navigate=useNavigate()

  useEffect(()=>{if(!open){setQuery('');setHits([]);setError('')}},[open])
  useEffect(()=>{
    if(!open||query.trim().length<2){setHits([]);return}
    const handle=setTimeout(async()=>{
      setLoading(true);setError('')
      const memberships=await supabase.from('organization_memberships').select('organization_id,is_active').eq('user_id',session.user.id).eq('is_active',true)
      if(memberships.error||!memberships.data?.length){setError(memberships.error?.message||(lang==='es'?'No se encontró un consultorio activo.':'No active practice found.'));setLoading(false);return}
      const preferred=localStorage.getItem('oculivo-org-id')||''
      const allowed=(memberships.data||[]).map(m=>String(m.organization_id))
      const org=allowed.includes(preferred)?preferred:allowed[0]
      const q=query.trim().toLowerCase()
      const [patients,appointments,threads,optical,invoices,documents,support]=await Promise.all([
        supabase.from('patients').select('id,first_name,last_name,email,phone,status').eq('organization_id',org).limit(60),
        supabase.from('appointments').select('id,appointment_type,starts_at,status,room').eq('organization_id',org).limit(60),
        supabase.from('communication_threads').select('id,subject,phone_number,email_address,channel,status,last_message_at').eq('organization_id',org).limit(60),
        supabase.from('optical_orders').select('id,order_number,order_type,status').eq('organization_id',org).limit(60),
        supabase.from('invoices').select('id,invoice_number,status,patient_amount,amount_paid,created_at').eq('organization_id',org).limit(60),
        supabase.from('documents').select('id,file_name,document_type,created_at').eq('organization_id',org).limit(60),
        supabase.from('support_tickets').select('id,subject,category,priority,status,created_at').eq('organization_id',org).limit(60)
      ])
      const packs=[
        {table:'patients',route:'/patients',label:lang==='es'?'Pacientes':'Patients',result:patients},
        {table:'appointments',route:'/schedule',label:lang==='es'?'Agenda':'Schedule',result:appointments},
        {table:'communication_threads',route:'/inbox',label:lang==='es'?'Bandeja':'Inbox',result:threads},
        {table:'optical_orders',route:'/optical',label:lang==='es'?'Óptica':'Optical',result:optical},
        {table:'invoices',route:'/billing',label:lang==='es'?'Facturación':'Billing',result:invoices},
        {table:'documents',route:'/documents',label:lang==='es'?'Documentos':'Documents',result:documents},
        {table:'support_tickets',route:'/support',label:lang==='es'?'Soporte':'Support',result:support}
      ]
      const results=packs.map(({table,route,label,result})=>{
        if(result.error)return {error:result.error.message,hits:[] as SearchHit[]}
        const found=((result.data||[]) as Record<string,unknown>[]).filter(row=>JSON.stringify(row).toLowerCase().includes(q)).slice(0,8).map(row=>({table,route,title:hitTitle(row),meta:label+(hitMeta(row)?' · '+hitMeta(row):'')}))
        return {error:'',hits:found}
      })
      const bad=results.find(x=>x.error)
      if(bad?.error)setError(lang==='es'?'No se pudo completar la búsqueda.':'Search could not be completed.')
      setHits(results.flatMap(x=>x.hits).slice(0,30))
      setLoading(false)
    },250)
    return()=>clearTimeout(handle)
  },[query,open,session.user.id])

  if(!open)return null
  return <div className="search-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="search-modal"><div className="search-modal-head"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={labels[lang].search}/><button onClick={onClose}><X size={18}/></button></div><div className="search-results">{loading?<div className="search-state">{lang==='es'?'Buscando…':'Searching…'}</div>:error?<div className="search-state error">{error}</div>:query.length<2?<div className="search-state">{lang==='es'?'Escribe al menos 2 caracteres.':'Type at least 2 characters.'}</div>:hits.length?hits.map((h,i)=><button key={h.table+i} onClick={()=>{navigate(h.route);onClose()}}><strong>{h.title}</strong><span>{h.meta}</span></button>):<div className="search-state">{lang==='es'?'No se encontraron resultados.':'No results found.'}</div>}</div></div></div>
}

function Shell({session}:{session:Session}){
  const [open,setOpen]=useState(false)
  const [searchOpen,setSearchOpen]=useState(false)
  const [assistantOpen,setAssistantOpen]=useState(false)
  const [orgMenuOpen,setOrgMenuOpen]=useState(false)
  const [orgs,setOrgs]=useState<OrgOption[]>([])
  const [selectedOrgId,setSelectedOrgId]=useState(()=>localStorage.getItem('oculivo-org-id')||'')
  const [lang,setLang]=useState<Lang>(()=>(localStorage.getItem('oculivo-lang')==='es'?'es':'en'))
  const location=useLocation()
  const navigate=useNavigate()
  useEffect(()=>setOpen(false),[location.pathname])
  useEffect(()=>{
    let active=true
    ;(async()=>{
      const memberships=await supabase.from('organization_memberships').select('organization_id,role,is_active').eq('user_id',session.user.id).eq('is_active',true)
      if(!active||memberships.error||!memberships.data?.length)return
      const ids=memberships.data.map(m=>String(m.organization_id))
      const organizations=await supabase.from('organizations').select('id,name').in('id',ids)
      if(!active)return
      const byId=new Map((organizations.data||[]).map(o=>[String(o.id),String(o.name||'Practice')]))
      const next=memberships.data.map(m=>({id:String(m.organization_id),name:byId.get(String(m.organization_id))||'Practice',role:String(m.role||'member')}))
      setOrgs(next)
      const stored=localStorage.getItem('oculivo-org-id')||''
      const resolved=next.some(o=>o.id===stored)?stored:next[0]?.id||''
      if(resolved){localStorage.setItem('oculivo-org-id',resolved);setSelectedOrgId(resolved);window.dispatchEvent(new CustomEvent('oculivo-org-change',{detail:resolved}))}
    })()
    return()=>{active=false}
  },[session.user.id])
  useEffect(()=>{localStorage.setItem('oculivo-lang',lang);document.documentElement.lang=lang==='es'?'es':'en'},[lang])
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearchOpen(true)}}
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)
  },[])
  const name=useMemo(()=>session.user.email?.split('@')[0]||'User',[session])
  const t=labels[lang]
  const selectedOrg=orgs.find(o=>o.id===selectedOrgId)||orgs[0]
  const currentNav=nav.find(item=>item.path===location.pathname)||nav[0]
  const currentLabel=t[currentNav.key]||t.overview
  function chooseOrg(id:string){localStorage.setItem('oculivo-org-id',id);setSelectedOrgId(id);setOrgMenuOpen(false);window.dispatchEvent(new CustomEvent('oculivo-org-change',{detail:id}))}
  function openNewPatient(){navigate('/patients?new=1')}
  async function signOut(){await supabase.auth.signOut()}

  return <div className="app-shell">
    <aside className={open?'sidebar open':'sidebar'}>
      <div className="sidebar-top"><Brand/><button className="icon-btn mobile-only" onClick={()=>setOpen(false)}><X size={22}/></button></div>
      <div className="practice-wrap"><button className="practice-switch" onClick={()=>setOrgMenuOpen(v=>!v)} aria-expanded={orgMenuOpen}><div className="practice-icon">O</div><div><span>{t.practice}</span><strong>{selectedOrg?.name||t.yourPractice}</strong></div><ChevronDown size={14}/></button>{orgMenuOpen&&<div className="practice-menu">{orgs.map(org=><button key={org.id} className={org.id===selectedOrgId?'active':''} onClick={()=>chooseOrg(org.id)}><strong>{org.name}</strong><span>{org.role}</span></button>)}</div>}</div>
      <nav className="sidebar-nav-scroll" aria-label={lang==='es'?'Navegación principal':'Primary navigation'}>{navGroups.map(group=><div className="nav-section" key={group.key}><div className="nav-section-label">{lang==='es'?group.es:group.en}</div>{nav.filter(item=>item.group===group.key).map(({key,path,icon:Icon})=><button type="button" key={path} className={location.pathname===path?'nav-item active':'nav-item'} aria-current={location.pathname===path?'page':undefined} onClick={()=>navigate(path)}><Icon size={17}/><span>{t[key]}</span></button>)}</div>)}</nav>
      <div className="sidebar-spacer"/>
      <button className="sidebar-ai" onClick={()=>setAssistantOpen(true)}><Sparkles size={16}/><div><strong>{lang==='es'?'Preguntar a Oculivo':'Ask Oculivo'}</strong><small>{lang==='es'?'Asistente de IA':'AI practice assistant'}</small></div></button>
      <NavLink to="/support" className="help-card"><span>?</span><div><strong>{t.needHelp}</strong><small>{t.contactSupport}</small></div></NavLink>
      <div className="sidebar-foot"><div className="user-chip"><div className="avatar">{name.slice(0,1).toUpperCase()}</div><div><strong>{session.user.email||'Practice owner'}</strong><span>{selectedOrg?.role|| (lang==='es'?'Usuario autenticado':'Authenticated user')}</span></div></div><button className="logout-button" onClick={()=>void signOut()} aria-label={lang==='es'?'Cerrar sesión':'Sign out'} title={lang==='es'?'Cerrar sesión':'Sign out'}><LogOut size={16}/></button></div>
    </aside>
    <div className="app-main">
      <header className="topbar"><button className="icon-btn mobile-only" onClick={()=>setOpen(true)}><Menu size={22}/></button><button className="searchbox search-trigger" onClick={()=>setSearchOpen(true)}><Search size={18}/><span>{t.search}</span></button><button className="kbd" onClick={()=>setSearchOpen(true)}>⌘<small>K</small></button><div className="top-actions"><div className="lang-toggle"><button className={lang==='en'?'active':''} onClick={()=>setLang('en')}>EN</button><button className={lang==='es'?'active':''} onClick={()=>setLang('es')}>ES</button></div><NavLink to="/phone" className="secondary-action"><Phone size={16}/>{t.call}</NavLink><NavLink to="/inbox" className="icon-action" aria-label={lang==='es'?'Abrir bandeja':'Open inbox'} title={lang==='es'?'Abrir bandeja':'Open inbox'}><Bell size={17}/></NavLink><button type="button" className="new-patient" onClick={openNewPatient}><Plus size={17}/>{t.newPatient}</button></div></header>
      <div className="context-strip"><div><span>{lang==='es'?'ESPACIO DE TRABAJO':'WORKSPACE'}</span><strong>{currentLabel}</strong></div><div className="context-strip-meta"><span className="context-live-dot"/><span>{selectedOrg?.name||t.yourPractice}</span><span className="context-role">{selectedOrg?.role||'member'}</span></div></div>
      <Routes><Route path="/" element={<LiveOverview session={session} lang={lang}/>}/>{Object.entries(moduleCopy[lang]).map(([path,[title,description]])=><Route key={path} path={path} element={<LiveModulePage path={path} title={title} description={description} session={session} lang={lang}/>}/>) }<Route path="*" element={<Navigate to="/" replace/>}/></Routes>
    </div>
    <SearchOverlay session={session} open={searchOpen} onClose={()=>setSearchOpen(false)} lang={lang}/>
    <AssistantDrawer session={session} lang={lang} open={assistantOpen} onClose={()=>setAssistantOpen(false)}/>
    {open&&<div className="overlay" onClick={()=>setOpen(false)}/>}
  </div>
}

export default function App(){
  const [session,setSession]=useState<Session|null|undefined>(undefined)
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session))
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next))
    return ()=>data.subscription.unsubscribe()
  },[])
  if(session===undefined)return <main className="center-page"><div className="loader">Oculivo…</div></main>
  return <Routes><Route path="/login" element={session?<Navigate to="/" replace/>:<Login/>}/><Route path="/reset-password" element={<ResetPassword/>}/><Route path="/*" element={session?<Shell session={session}/>:<Navigate to="/login" replace/>}/></Routes>
}
