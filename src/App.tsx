import { useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, CalendarDays, CircleDollarSign, FileText, Glasses, Inbox, LayoutDashboard,
  LogOut, Menu, MessageSquareText, Phone, Search, Settings, Stethoscope, TicketCheck,
  Timer, Users, X, BarChart3, BookOpen, Plus, ChevronDown, Sparkles, Clock3
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type NavItem = { label:string; path:string; icon:LucideIcon }

const nav:NavItem[] = [
  {label:'Overview',path:'/',icon:LayoutDashboard},
  {label:'Schedule',path:'/schedule',icon:CalendarDays},
  {label:'Patients',path:'/patients',icon:Users},
  {label:'Clinical',path:'/clinical',icon:Stethoscope},
  {label:'Optical',path:'/optical',icon:Glasses},
  {label:'Inbox',path:'/inbox',icon:Inbox},
  {label:'Phone',path:'/phone',icon:Phone},
  {label:'Team Chat',path:'/team-chat',icon:MessageSquareText},
  {label:'Timeclock',path:'/timeclock',icon:Timer},
  {label:'Billing',path:'/billing',icon:CircleDollarSign},
  {label:'Reports',path:'/reports',icon:BarChart3},
  {label:'Manual',path:'/manual',icon:BookOpen},
  {label:'Support',path:'/support',icon:TicketCheck},
]

function Brand(){
  return <div className="brand-lockup"><span className="brand-mark"><i/><i/><i/><i/></span><strong>OCULIVO</strong></div>
}

function Login(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const navigate=useNavigate()

  async function signIn(e:React.FormEvent){
    e.preventDefault(); setError(''); setLoading(true)
    const {error}=await supabase.auth.signInWithPassword({email,password})
    setLoading(false)
    if(error){setError(error.message);return}
    navigate('/')
  }

  async function reset(){
    if(!email){setError('Enter your email address first.');return}
    setError('')
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:'https://app.oculivo.com/reset-password'})
    setError(error ? error.message : 'Password reset email sent.')
  }

  return <main className="auth-page">
    <section className="auth-brand"><div className="auth-brand-inner"><Brand/><span className="eyebrow">RomyLabs Core Connect</span><h1>Modern eye care operations, connected.</h1><p>Scheduling, patients, clinical workflows, optical, billing, communications, documents, and staff operations in one workspace.</p></div></section>
    <section className="auth-form-wrap"><form className="auth-card" onSubmit={signIn}><div className="brand-mobile"><Brand/></div><h2>Welcome back</h2><p>Sign in to your Oculivo workspace.</p><label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="auth-note">{error}</div>}<button className="primary-button" disabled={loading}>{loading?'Signing in…':'Sign in'}</button><button className="link-button" type="button" onClick={reset}>Forgot password?</button></form></section>
  </main>
}

function ResetPassword(){
  const [password,setPassword]=useState('')
  const [message,setMessage]=useState('')
  async function submit(e:React.FormEvent){
    e.preventDefault()
    const {error}=await supabase.auth.updateUser({password})
    setMessage(error?error.message:'Password updated. You can return to Oculivo.')
  }
  return <main className="center-page"><form className="auth-card" onSubmit={submit}><h2>Set new password</h2><label>New password<input type="password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} required/></label>{message&&<div className="auth-note">{message}</div>}<button className="primary-button">Update password</button></form></main>
}

const moduleCopy:Record<string,[string,string]> = {
  '/schedule':['Schedule','Appointments, provider schedules, booking, availability, and practice coordination.'],
  '/patients':['Patients','Patient profiles, contact information, intake, history, and practice relationships.'],
  '/clinical':['Clinical','Clinical records and provider workflows with tenant-secured access.'],
  '/optical':['Optical','Inventory, optical orders, frames, lenses, and fulfillment workflows.'],
  '/inbox':['Inbox','Unified email, SMS, phone and patient portal conversations.'],
  '/phone':['Phone','Calls, voicemails, call history and patient communication workflows.'],
  '/team-chat':['Team Chat','Internal channels, private conversations and staff coordination.'],
  '/timeclock':['Timeclock','Employee clock-in, clock-out, time entries and workforce operations.'],
  '/billing':['Billing','Insurance, invoices, payments, balances and revenue-cycle workflows.'],
  '/reports':['Reports','Practice operations, patient flow, revenue and team reporting.'],
  '/manual':['Manual','Oculivo help center, product manual and workflow guidance.'],
  '/support':['Support','Support tickets routed into the RomyLabs Admin Portal.'],
}

function ModulePage({title,description}:{title:string;description:string}){
  return <section className="page"><div className="page-head"><div><span className="date-kicker">OCULIVO WORKSPACE</span><h1>{title}</h1><p>{description}</p></div></div><div className="panel large-panel"><h2>{title}</h2><p>This route is connected to the production shell and ready for the recovered Oculivo module implementation.</p></div></section>
}

function Overview(){
  return <section className="page overview-page">
    <div className="page-head overview-head"><div><span className="date-kicker">MONDAY, AUGUST 29</span><h1>Overview</h1><p>Good morning. Here’s what’s happening across your practice.</p></div><button className="location-button"><span className="status-dot"/>All locations<ChevronDown size={14}/></button></div>
    <div className="metric-grid">
      <article className="metric-card"><div><span>Today’s appointments</span><CalendarDays size={17}/></div><strong>0</strong><p>No activity yet</p></article>
      <article className="metric-card"><div><span>New patient requests</span><Users size={17}/></div><strong>0</strong><p>No activity yet</p></article>
      <article className="metric-card"><div><span>Open conversations</span><MessageSquareText size={17}/></div><strong>0</strong><p>No messages yet</p></article>
      <article className="metric-card"><div><span>Unfilled chair time</span><Clock3 size={17}/></div><strong>—</strong><p>No matches yet</p></article>
    </div>
    <div className="overview-grid">
      <section className="panel schedule-panel"><div className="panel-title-row"><div><h2>Today’s patient flow</h2><p>No appointments loaded yet</p></div><a href="/schedule">View full schedule</a></div><div className="table-head"><span>TIME</span><span>PATIENT & VISIT</span><span>PROVIDER</span><span>STATUS</span></div><div className="empty-row"><span>—</span><div className="patient-empty"><i/><div><strong>No appointments yet</strong><p>Add your first appointment to begin</p></div></div><span>—</span><span className="ready-pill">Ready</span></div></section>
      <section className="panel inbox-panel"><div className="panel-title-row"><div><h2>Unified inbox</h2><p>Email, SMS, phone & portal</p></div><span className="tiny-count">0 open</span></div><div className="inbox-empty"><MessageSquareText size={28}/><strong>No conversations yet</strong><p>Connect a channel or start a conversation to see activity here.</p></div></section>
    </div>
  </section>
}

function AiWidget(){
  return <div className="ai-widget"><div className="ai-head"><span className="ai-icon"><Sparkles size={15}/></span><div><strong>Ask Oculivo</strong><span>Practice intelligence</span></div><button>×</button></div><div className="ai-card">Three schedule gaps can be filled today. Want me to draft outreach messages for approval?</div><div className="ai-actions"><button>Show matches</button><button>Not now</button></div><div className="ai-input"><span>Ask about your practice...</span><b>↑</b></div><small>AI suggestions require your approval.</small></div>
}

function Shell({session}:{session:Session}){
  const [open,setOpen]=useState(false)
  const location=useLocation()
  useEffect(()=>setOpen(false),[location.pathname])
  const name=useMemo(()=>session.user.email?.split('@')[0]||'User',[session])

  return <div className="app-shell">
    <aside className={open?'sidebar open':'sidebar'}>
      <div className="sidebar-top"><Brand/><button className="icon-btn mobile-only" onClick={()=>setOpen(false)}><X size={22}/></button></div>
      <div className="practice-switch"><div className="practice-icon">O</div><div><span>PRACTICE</span><strong>Your practice</strong></div><ChevronDown size={14}/></div>
      <nav>{nav.map(({label,path,icon:Icon})=><NavLink key={path} to={path} end={path==='/' } className={({isActive})=>isActive?'nav-item active':'nav-item'}><Icon size={17}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-spacer"/>
      <div className="help-card"><span>?</span><div><strong>Need help?</strong><small>Contact RomyLabs support</small></div></div>
      <div className="sidebar-foot"><div className="user-chip"><div className="avatar">{name.slice(0,1).toUpperCase()}</div><div><strong>Practice owner</strong><span>Practice owner</span></div></div><Settings size={17}/></div>
    </aside>
    <div className="app-main">
      <header className="topbar"><button className="icon-btn mobile-only" onClick={()=>setOpen(true)}><Menu size={22}/></button><div className="searchbox"><Search size={18}/><span>Search patients, calls, orders, messages...</span></div><button className="kbd">⌘<small>K</small></button><div className="top-actions"><div className="lang-toggle"><button className="active">EN</button><button>ES</button></div><button className="secondary-action"><Phone size={16}/>Call</button><button className="icon-action"><Bell size={17}/><i/></button><button className="new-patient"><Plus size={17}/>New patient</button></div></header>
      <Routes><Route path="/" element={<Overview/>}/>{Object.entries(moduleCopy).map(([path,[title,description]])=><Route key={path} path={path} element={<ModulePage title={title} description={description}/>}/>) }<Route path="*" element={<Navigate to="/" replace/>}/></Routes>
    </div>
    <AiWidget/>
    <button className="ai-fab"><Sparkles size={19}/></button>
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
  if(session===undefined)return <main className="center-page"><div className="loader">Loading Oculivo…</div></main>
  return <Routes><Route path="/login" element={session?<Navigate to="/" replace/>:<Login/>}/><Route path="/reset-password" element={<ResetPassword/>}/><Route path="/*" element={session?<Shell session={session}/>:<Navigate to="/login" replace/>}/></Routes>
}
