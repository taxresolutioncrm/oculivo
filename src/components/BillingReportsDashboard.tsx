import { useMemo, useState } from 'react'
import { ArrowUpRight, CalendarDays, CheckCircle2, CircleDollarSign, ReceiptText, ShieldCheck, Wallet } from 'lucide-react'

type RecordRow = Record<string, any>
type BillingView = 'overview' | 'invoices' | 'claims' | 'payments' | 'reports'
type Props = {
 lang:'en'|'es'
 tab:BillingView
 onTabChange:(tab:BillingView)=>void
 invoices:RecordRow[]
 claims:RecordRow[]
 payments:RecordRow[]
 patientName:(id:any)=>string
 loading:boolean
}
const amount=(v:any)=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0
const money=(v:number)=>v.toLocaleString('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2})
const number=(v:number)=>v.toLocaleString('en-US')
const validDate=(v:any)=>{const d=new Date(v);return !Number.isNaN(d.getTime())?d:null}
const timestamp=(r:RecordRow)=>validDate(r.created_at||r.paid_at||r.updated_at)
const sum=(rows:RecordRow[],get:(r:RecordRow)=>number)=>rows.reduce((t,r)=>t+get(r),0)
const outstanding=(r:RecordRow)=>Math.max(0,amount(r.subtotal||r.patient_amount)-amount(r.amount_paid))
const barLabel=(v:string)=>v.length>16?v.slice(0,15)+'…':v
function label(lang:Props['lang'],en:string,es:string){return lang==='es'?es:en}
export function BillingReportsDashboard({lang,tab,onTabChange,invoices,claims,payments,patientName,loading}:Props){
 const [period,setPeriod]=useState('6')
 const [showAll,setShowAll]=useState(false)
 const today=new Date()
 const start=useMemo(()=>{const d=new Date();if(period==='30')d.setDate(d.getDate()-30);else d.setMonth(d.getMonth()-Number(period));return d},[period])
 const within=(r:RecordRow)=>{const d=timestamp(r);return d!==null&&d>=start}
 const scopedInv=invoices.filter(within),scopedClaims=claims.filter(within),scopedPayments=payments.filter(within)
 const totalBilled=sum(scopedInv,r=>amount(r.subtotal||r.patient_amount))
 const collected=sum(scopedPayments,r=>amount(r.amount))
 const totalClaims=sum(scopedClaims,r=>amount(r.billed_amount))
 const allDue=invoices.reduce((n,r)=>n+outstanding(r),0)
 const paidClaims=scopedClaims.filter(r=>['paid','approved','accepted','completed'].includes(String(r.status||'').toLowerCase()))
 const pendingClaims=scopedClaims.filter(r=>['pending','submitted','processing','in_review','open'].includes(String(r.status||'').toLowerCase()))
 const deniedClaims=scopedClaims.filter(r=>['denied','rejected','failed'].includes(String(r.status||'').toLowerCase()))
 const dateFmt=(r:RecordRow)=>{const d=timestamp(r);return d?d.toLocaleDateString(lang==='es'?'es-US':'en-US',{month:'short',day:'numeric',year:'numeric'}):'—'}
 const aging=[0,0,0,0]
 invoices.forEach(r=>{
  const balance=outstanding(r);if(balance<=0)return
  const due=validDate(r.due_date||r.created_at);if(!due){aging[0]+=balance;return}
  const days=Math.max(0,Math.floor((today.getTime()-due.getTime())/86400000))
  aging[days<=30?0:days<=60?1:days<=90?2:3]+=balance
 })
 const months=Array.from({length:6},(_,i)=>{const d=new Date(today.getFullYear(),today.getMonth()-(5-i),1);return {year:d.getFullYear(),month:d.getMonth(),label:d.toLocaleDateString(lang==='es'?'es-US':'en-US',{month:'short'})}})
 const revenue=months.map(m=>sum(scopedInv.filter(r=>{const d=timestamp(r);return !!d&&d.getFullYear()===m.year&&d.getMonth()===m.month}),r=>amount(r.subtotal||r.patient_amount)))
 const received=months.map(m=>sum(scopedPayments.filter(r=>{const d=timestamp(r);return !!d&&d.getFullYear()===m.year&&d.getMonth()===m.month}),r=>amount(r.amount)))
 const top=Math.max(1,...revenue,...received)*1.12
 const y=(v:number)=>174-(v/top)*146
 const points=(vals:number[])=>vals.map((v,i)=>(44+i*120)+','+y(v)).join(' ')
 const providers=Object.entries(scopedClaims.reduce<Record<string,{billed:number;count:number;paid:number}>>((acc,r)=>{
   const key=String(r.payer_name||label(lang,'Unspecified payer','Aseguradora sin especificar'))
   if(!acc[key])acc[key]={billed:0,count:0,paid:0}
   acc[key].billed+=amount(r.billed_amount);acc[key].count++
   if(['paid','approved','completed'].includes(String(r.status||'').toLowerCase()))acc[key].paid++
   return acc
 },{})).map(([name,value])=>({name,...value})).sort((a,b)=>b.billed-a.billed).slice(0,5)
 const recent=[...scopedPayments].sort((a,b)=>(timestamp(b)?.getTime()||0)-(timestamp(a)?.getTime()||0)).slice(0,showAll?30:5)
 const tabs:[BillingView,string,string][]=[['overview','Overview','Resumen'],['invoices','Billing','Facturación'],['claims','Claims','Reclamaciones'],['payments','Collections','Cobros'],['reports','Reports','Informes']]
 const chartVisible=tab==='overview'||tab==='reports'
 return <section className="obr-root" aria-label={label(lang,'Billing and reports','Facturación e informes')}>
  <div className="obr-heading"><div><h1>{label(lang,'Billing & Reports','Facturación e informes')}</h1><p>{label(lang,'Billing performance, collections, and operational analytics for your practice.','Rendimiento de facturación, cobros y análisis operativos de su consultorio.')}</p></div>
   <label className="obr-date"><CalendarDays size={16}/><span className="obr-visually-hidden">{label(lang,'Report period','Período del informe')}</span><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="30">{label(lang,'Last 30 Days','Últimos 30 días')}</option><option value="6">{label(lang,'Last 6 Months','Últimos 6 meses')}</option><option value="12">{label(lang,'Last 12 Months','Últimos 12 meses')}</option></select></label>
  </div>
  <nav className="obr-tabs" aria-label={label(lang,'Billing report sections','Secciones de informes')} >{tabs.map(([id,en,es])=><button type="button" key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>onTabChange(id)}>{label(lang,en,es)}</button>)}</nav>
  {chartVisible&&<>
   <div className="obr-kpis" aria-busy={loading}>
    <article className="obr-kpi"><div className="obr-kpi-top"><span className="obr-kpi-icon purple"><ReceiptText size={18}/></span><span className="obr-kpi-label">{label(lang,'Total Billed','Total facturado')}</span></div><strong>{money(totalBilled)}</strong><small>{label(lang,'In selected period','En el período seleccionado')}</small></article>
    <article className="obr-kpi"><div className="obr-kpi-top"><span className="obr-kpi-icon teal"><ShieldCheck size={18}/></span><span className="obr-kpi-label">{label(lang,'Claims Submitted','Reclamaciones enviadas')}</span></div><strong>{money(totalClaims)}</strong><small>{number(scopedClaims.length)} {label(lang,'claims in period','reclamaciones del período')}</small></article>
    <article className="obr-kpi"><div className="obr-kpi-top"><span className="obr-kpi-icon purple"><CircleDollarSign size={18}/></span><span className="obr-kpi-label">{label(lang,'Collections','Cobros')}</span></div><strong>{money(collected)}</strong><small>{number(scopedPayments.length)} {label(lang,'payments recorded','pagos registrados')}</small></article>
    <article className="obr-kpi"><div className="obr-kpi-top"><span className="obr-kpi-icon green"><Wallet size={18}/></span><span className="obr-kpi-label">{label(lang,'AR Balance','Saldo por cobrar')}</span></div><strong>{money(allDue)}</strong><small>{label(lang,'Outstanding across all invoices','Pendiente de todas las facturas')}</small></article>
   </div>
   <div className="obr-charts">
    <article className="obr-panel obr-revenue"><div className="obr-panel-head"><div><h2>{label(lang,'Revenue Trend','Tendencia de ingresos')}</h2><p>{label(lang,'Billed vs. Collected','Facturado vs. cobrado')}</p></div><div className="obr-legends"><span><i className="obr-dot billed"/>{label(lang,'Billed','Facturado')}</span><span><i className="obr-dot collected"/>{label(lang,'Collected','Cobrado')}</span></div></div>
      <svg className="obr-trend" viewBox="0 0 680 218" role="img" aria-label={label(lang,'Six-month billed and collected revenue trend','Tendencia de facturación y cobros durante seis meses')}>
      {[0,1,2,3,4].map(i=><g key={i}><line x1="44" y1={28+i*36.5} x2="660" y2={28+i*36.5} stroke="#e9eaf5" strokeWidth="1"/><text x="38" y={33+i*36.5} textAnchor="end" fontSize="12" fill="#7d8497">{'$'+Math.round((top*(4-i)/4)/1000)+'k'}</text></g>)}
      <polygon points={'44,174 '+points(revenue)+' 644,174'} fill="#9064f3" opacity=".12"/>
      <polyline points={points(revenue)} fill="none" stroke="#7745e4" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
      <polyline points={points(received)} fill="none" stroke="#22b8b2" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {revenue.map((v,i)=><circle key={i} cx={44+i*120} cy={y(v)} r="4.5" fill="#7745e4" stroke="white" strokeWidth="2"/>)}
      {months.map((m,i)=><text key={i} x={44+i*120} y="204" textAnchor="middle" fontSize="13" fill="#7d8497">{m.label}</text>)}
      </svg>
    </article>
    <article className="obr-panel obr-aging"><div className="obr-panel-head"><div><h2>{label(lang,'Aging Balances (A/R)','Antigüedad de saldos (C/C)')}</h2><p>{label(lang,'Outstanding receivables by age','Saldos pendientes por antigüedad')}</p></div></div>
     <div className="obr-aging-main"><div className="obr-donut" style={{background:'conic-gradient('+(['#7d4be4','#a681f3','#23aeb3','#f4b150'].map((color,i)=>{const begin=allDue?aging.slice(0,i).reduce((a,b)=>a+b,0)/allDue*100:0;const end=allDue?aging.slice(0,i+1).reduce((a,b)=>a+b,0)/allDue*100:0;return color+' '+begin+'% '+end+'%'}).join(', '))+')'}}><div className="obr-donut-hole"><strong>{money(allDue)}</strong><small>{label(lang,'Total A/R','Total C/C')}</small></div></div>
      <div className="obr-aging-legend">{aging.map((v,i)=><div key={i}><span><i className={'obr-age-dot age-'+i}/>{['0–30','31–60','61–90','90+'][i]} {label(lang,'days','días')}</span><strong>{money(v)}</strong><small>{allDue?Math.round(v/allDue*100):0}%</small></div>)}</div>
     </div>
    </article>
   </div>
   <div className="obr-breakdown">
    <article className="obr-panel obr-claims"><div className="obr-panel-head"><div><h2>{label(lang,'Claims Summary','Resumen de reclamaciones')}</h2><p>{label(lang,'Selected reporting period','Período seleccionado')}</p></div></div>
     {[[label(lang,'Claims Submitted','Reclamaciones enviadas'),scopedClaims.length,'#8060e9'],[label(lang,'Claims Accepted','Reclamaciones aceptadas'),paidClaims.length,'#22b4a9'],[label(lang,'Claims Denied','Reclamaciones denegadas'),deniedClaims.length,'#e86b71'],[label(lang,'Claims Pending','Reclamaciones pendientes'),pendingClaims.length,'#efb951']].map(([name,value,color])=><div className="obr-summary-line" key={String(name)}><span className="obr-summary-left"><i style={{background:String(color)}}/>{name}</span><strong>{number(Number(value))}</strong></div>)}
    </article>
    <article className="obr-panel obr-collections"><div className="obr-panel-head"><div><h2>{label(lang,'Collections','Cobros')}</h2><p>{label(lang,'Actual payments recorded','Pagos realmente registrados')}</p></div><span className="obr-kpi-icon purple"><CircleDollarSign size={18}/></span></div>
     <div className="obr-big-total">{money(collected)}</div><div className="obr-collection-metrics"><div><span>{label(lang,'Insurance / linked invoice payments','Pagos con factura vinculada')}</span><strong>{money(sum(scopedPayments.filter(r=>r.invoice_id),r=>amount(r.amount)))}</strong></div><div><span>{label(lang,'Other payments','Otros pagos')}</span><strong>{money(sum(scopedPayments.filter(r=>!r.invoice_id),r=>amount(r.amount)))}</strong></div></div>
    </article>
    <article className="obr-panel obr-provider"><div className="obr-panel-head"><div><h2>{label(lang,'Payer Performance','Rendimiento por aseguradora')}</h2><p>{label(lang,'Insurance claims in selected period','Reclamaciones de seguros del período')}</p></div></div>
     <div className="obr-table-scroll"><table><thead><tr><th>{label(lang,'Payer','Aseguradora')}</th><th>{label(lang,'Billed','Facturado')}</th><th>{label(lang,'Claims','Reclamaciones')}</th><th>{label(lang,'Accepted','Aceptadas')}</th></tr></thead><tbody>{providers.map(x=><tr key={x.name}><td title={x.name}>{barLabel(x.name)}</td><td>{money(x.billed)}</td><td>{number(x.count)}</td><td><span className="obr-meter"><i style={{width:(x.count?x.paid/x.count*100:0)+'%'}}/></span>{x.count?Math.round(x.paid/x.count*100):0}%</td></tr>)}{!providers.length&&<tr><td colSpan={4} className="obr-no-data">{label(lang,'No claims in this period','No hay reclamaciones en este período')}</td></tr>}</tbody></table></div>
    </article>
   </div>
   <article className="obr-panel obr-transactions"><div className="obr-panel-head"><div><h2>{label(lang,'Recent Transactions','Transacciones recientes')}</h2></div><button type="button" className="obr-view-all" onClick={()=>setShowAll(v=>!v)}>{showAll?label(lang,'Show fewer','Ver menos'):label(lang,'View all transactions','Ver todas las transacciones')} <ArrowUpRight size={14}/></button></div>
    <div className="obr-table-scroll"><table><thead><tr><th>{label(lang,'Date','Fecha')}</th><th>{label(lang,'Patient','Paciente')}</th><th>{label(lang,'Type','Tipo')}</th><th>{label(lang,'Payer / Method','Pagador / Método')}</th><th>{label(lang,'Amount','Monto')}</th><th>{label(lang,'Status','Estado')}</th></tr></thead><tbody>{recent.map(r=><tr key={String(r.id)}><td>{dateFmt(r)}</td><td>{patientName(r.patient_id)}</td><td>{label(lang,'Payment','Pago')}</td><td>{String(r.payment_method||'—').toUpperCase()}</td><td className="obr-amount">{money(amount(r.amount))}</td><td><span className="obr-status"><CheckCircle2 size={12}/>{label(lang,'Recorded','Registrado')}</span></td></tr>)}{!recent.length&&<tr><td colSpan={6} className="obr-no-data">{label(lang,'No payments in this period','No hay pagos en este período')}</td></tr>}</tbody></table></div>
   </article>
  </>}
 </section>
}
