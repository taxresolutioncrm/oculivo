import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8')
const check=(pass,label)=>{
 console.log((pass?'PASS':'FAIL')+': '+label)
 if(!pass)process.exitCode=1
}
const app=read('src/App.tsx')
const main=read('src/main.tsx')
const css=read('src/full-ui-polish.css')
const email=read('src/pages/EmailBlastPage.tsx')
const esign=read('src/pages/ESignaturesPage.tsx')
const comms=read('src/components/CommunicationsModules.tsx')
const live=read('src/components/LiveModules.tsx')
const ops=read('src/components/OperationalModules.tsx')
const requiredRoutes=[
 '/', '/schedule','/patients','/clinical','/optical','/inbox',
 '/email-blast','/phone','/team-chat','/timeclock','/billing','/documents',
 '/esign','/reports','/manual','/support'
]
const modules=[
 ['Overview','oc-workspace-section',live],
 ['Scheduling','oc-schedule',ops],
 ['Patients','patient-card',ops],
 ['Clinical','clinical-mini',ops],
 ['Optical','invoice-line',css],
 ['Inbox','oc-inbox-page',comms],
 ['Email Blast','oc-email-page',email],
 ['Phone and fax','oc-phone-page',comms],
 ['Team Chat','chat-layout',live],
 ['Timeclock','timeclock-hero',ops],
 ['Billing','invoice-lines',css],
 ['Documents','wf-form',ops],
 ['E-Signatures','oc-esign-page',esign],
 ['Reports','oc-report-summary',live],
 ['Manual','manual-grid',live],
 ['Support','wf-head',ops],
]
check(main.includes("import './index.css'")&&main.includes("import './full-ui-polish.css'")&&main.indexOf("import './full-ui-polish.css'")>main.indexOf("import './index.css'"),'Shared visual system is loaded last')
check(requiredRoutes.every(path=>app.includes("path:'"+path+"'")||app.includes('path="'+path+'"')||app.includes("'"+path+"'")),'Every primary CRM navigation route exists')
for(const [label,marker,file] of modules){
 check(file.includes(marker),'UI coverage marker present: '+label)
}
const requiredSelectors=[
 '.oc-email-workspace','.oc-email-recipient','.oc-email-actions',
 '.oc-esign-grid','.oc-esign-field-controls','.oc-esign-envelope',
 '.oc-inbox-page','.oc-phone-page','.chat-layout','.chat-message',
 '.patient-card','.patient-profile-modal','.oc-report-item','.oc-schedule',
 '.timeclock-hero','.invoice-lines','.wf-field','.wf-empty',
 '.oc-workspace-section','.manual-card'
]
check(requiredSelectors.every(selector=>css.includes(selector)||read('src/index.css').includes(selector)),'All shared primary modules have authored styles')
check(css.includes('@media(max-width:860px)')&&css.includes('@media(max-width:600px)'),'Responsive layouts support tablet and mobile')
check(css.includes(':focus-visible'),'Accessible keyboard focus states are provided')
check(email.includes('aria-label=')&&esign.includes('aria-label='),'Email and e-sign composition controls retain accessible labels')
check(!/https?:\/\//.test(css),'Polish stylesheet has no third-party visual dependencies')
const old=read('src/index.css')
const start=old.indexOf('.wf-head h2{font-size:22px')
const stop=old.indexOf('/* bottom nav must never be covered',start)
check(start>=0&&stop>start&&!/font-size:[^;}]+!important/.test(old.slice(start,stop)),
  'Legacy small-font locks no longer override the new visual system')
check(live.includes('oc-chat-channel-header'),'Team Chat identifies the selected channel in its conversation header')

