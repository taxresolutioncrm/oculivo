import { useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, CalendarDays, CircleDollarSign, ClipboardList, FileText, Glasses,
  HeartPulse, Inbox, LayoutDashboard, LogOut, Menu, MessageSquareText, PackageSearch,
  Settings, ShieldCheck, Stethoscope, TicketCheck, Timer, Users, WandSparkles, X
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type NavItem = { label:string; path:string; icon:React.ComponentType<{size?:number}> }

const nav:NavItem[] = [
  {label:'Dashboard',path:'/',icon:LayoutDashboard},
  {label:'Calendar',path:'/calendar',icon:CalendarDays},
  {label:'Patients',path:'/patients',icon:Users},
  {label:'Clinical',path:'/clinical',icon:Stethoscope},
  {label:'Optical',path:'/optical',icon:Glasses},
  {label:'Insurance',path:'/insurance',icon:ShieldCheck},
  {label:'Billing',path:'/billing',icon:CircleDollarSign},
  {label:'Communications',path:'/communications',icon:Inbox},
  {label:'Documents',path:'/documents',icon:FileText},
  {label:'Team Chat',path:'/team-chat',icon:MessageSquareText},
  {label:'Time Clock',path:'/time-clock',icon:Timer},
  {label:'Support',path:'/support',icon:TicketCheck},
  {label:'AI Assistant',path:'/ai',icon:WandSparkles},
  {label:'Settings',path:'/settings',icon:Settings},
]

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

  return <main className="auth-page"><section className="auth-brand"><div className="auth-brand-inner"><span className="eyebrow">RomyLabs Core Connect</span><h1>Ocul<span>ivo</span></h1><p>Eye care practice management for scheduling, patients, clinical workflows, optical, claims, billing, communications, documents, and staff operations.</p></div></section><section className="auth-form-wrap"><form className="auth-card" onSubmit={signIn}><div className="brand-mobile">Ocul<span>ivo</span></div><h2>Welcome back</h2><p>Sign in to your Oculivo workspace.</p><label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="auth-note">{error}</div>}<button className="primary-button" disabled={loading}>{loading?'Signing in…':'Sign in'}</button><button className="link-button" type="button" onClick={reset}>Forgot password?</button></form></section></main>
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

function ModulePage({title,description}:{title:string;description:string}){
  return <section className="page"><div className="page-head"><div><span className="eyebrow">Oculivo</span><h1>{title}</h1><p>{description}</p></div></div><div className="empty-card"><Activity size={28}/><h2>{title} workspace</h2><p>This route is wired into the production shell. The recovered Oculivo module implementation will be connected here without changing the navigation contract.</p></div></section>
}

const moduleCopy:Record<string,[string,string]> = {
  '/calendar':['Calendar','Appointments, provider schedules, booking, availability, and practice coordination.'],
  '/patients':['Patients','Patient profiles, contact information, intake, history, and practice relationships.'],
  '/clinical':['Clinical','Clinical records and provider workflows with tenant-secured access.'],
  '/optical':['Optical','Inventory, optical orders, frames, lenses, and fulfillment workflows.'],
  '/insurance':['Insurance','Claims, payer workflows, status tracking, and billing coordination.'],
  '/billing':['Billing','Invoices, payments, balances, and financial workflows.'],
  '/communications':['Communications','Unified email, SMS, phone, fax, patient threads, and staff follow-up.'],
  '/documents':['Documents','Private patient and office documents backed by Oculivo secure storage.'],
  '/team-chat':['Team Chat','Slack-style internal channels, private conversations, huddles, and staff coordination.'],
  '/time-clock':['Time Clock','Employee time entries, clock-in/clock-out, and workforce operations.'],
  '/support':['Support','Oculivo support tickets routed into the RomyLabs Admin Portal.'],
  '/ai':['AI Assistant','Oculivo assistant with role-aware actions and protected administrative boundaries.'],
  '/settings':['Settings','Practice, locations, providers, staff, permissions, integrations, and preferences.'],
}

function Dashboard(){
  return <section className="page"><div className="page-head"><div><span className="eyebrow">Practice command center</span><h1>Dashboard</h1><p>Connected operational view for the eye-care practice.</p></div></div><div className="dashboard-grid"><article><CalendarDays/><span>Scheduling</span><strong>Appointments & availability</strong></article><article><HeartPulse/><span>Patient care</span><strong>Clinical workflows</strong></article><article><PackageSearch/><span>Optical</span><strong>Inventory & orders</strong></article><article><ClipboardList/><span>Revenue cycle</span><strong>Claims & billing</strong></article></div></section>
}

function Shell({session}:{session:Session}){
  const [open,setOpen]=useState(false)
  const location=useLocation()
  useEffect(()=>setOpen(false),[location.pathname])
  const name=useMemo(()=>session.user.email?.split('@')[0]||'User',[session])

  return <div className="app-shell"><aside className={open?'sidebar open':'sidebar'}><div className="sidebar-top"><div className="logo">Ocul<span>ivo</span></div><button className="icon-btn mobile-only" onClick={()=>setOpen(false)}><X size={22}/></button></div><nav>{nav.map(({label,path,icon:Icon})=><NavLink key={path} to={path} end={path==='/' } className={({isActive})=>isActive?'nav-item active':'nav-item'}><Icon size={19}/><span>{label}</span></NavLink>)}</nav><div className="sidebar-foot"><div className="user-chip"><div className="avatar">{name.slice(0,1).toUpperCase()}</div><div><strong>{name}</strong><span>{session.user.email}</span></div></div><button className="signout" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Sign out</button></div></aside><div className="app-main"><header className="topbar"><button className="icon-btn mobile-only" onClick={()=>setOpen(true)}><Menu size={22}/></button><div><strong>Oculivo</strong><span>Core Connect</span></div></header><Routes><Route path="/" element={<Dashboard/>}/>{Object.entries(moduleCopy).map(([path,[title,description]])=><Route key={path} path={path} element={<ModulePage title={title} description={description}/>}/>) }<Route path="*" element={<Navigate to="/" replace/>}/></Routes></div>{open&&<div className="overlay" onClick={()=>setOpen(false)}/>}</div>
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
