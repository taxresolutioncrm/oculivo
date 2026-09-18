import fs from 'node:fs'
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
const fail=(m)=>{console.error('FAIL:',m);process.exitCode=1}
const pass=(m)=>console.log('PASS:',m)
const check=(ok,m)=>ok?pass(m):fail(m)

const app=read('src/App.tsx')
const comms=read('src/components/CommunicationsModules.tsx')
const live=read('src/components/LiveModules.tsx')
const esign=read('src/pages/ESignaturesPage.tsx')
const publicSign=read('src/pages/PublicSignPage.tsx')
const config=read('supabase/config.toml')
const esignFn=read('supabase/functions/universal-esign/index.ts')
const phoneFn=read('supabase/functions/phone-session/index.ts')
const faxFn=read('supabase/functions/send-fax/index.ts')
const emailFn=read('supabase/functions/send-email/index.ts')
const smsFn=read('supabase/functions/send-sms/index.ts')
const supportFn=read('supabase/functions/oculivo-support-api/index.ts')
const aiFn=read('supabase/functions/oculivo-ai/index.ts')
const ops=read('src/components/OperationalModules.tsx')
const css=read('src/index.css')
const pkg=JSON.parse(read('package.json'))
const requiredRoutes=['/schedule','/patients','/clinical','/optical','/inbox','/phone','/team-chat','/timeclock','/billing','/documents','/esign','/reports','/manual','/support']
const requiredFunctions=['oculivo-ai','oculivo-support-api','phone-session','send-email','send-sms','send-fax','universal-esign']
const allSource=[app,comms,live,esign,publicSign].join('\n')

check(requiredRoutes.every(r=>app.includes(r)),'All required CRM routes are wired')
check(app.includes('getSession()')&&app.includes('onAuthStateChange')&&app.includes('signInWithPassword'),'Auth/session lifecycle is wired')
check(app.includes('resetPasswordForEmail')&&app.includes('updateUser({password})'),'Password reset lifecycle is wired')
check(app.includes('organization_memberships')&&app.includes('oculivo-org-change')&&app.includes('chooseOrg'),'Practice switching is organization-scoped')
check([
  ["'/patients'",'<PatientsOps'],
  ["'/schedule'",'<ScheduleOps'],
  ["'/clinical'",'<ClinicalOps'],
  ["'/optical'",'<OpticalOps'],
  ["'/timeclock'",'<TimeclockOps'],
  ["'/billing'",'<BillingOps'],
  ["'/documents'",'<DocumentsOps'],
  ["'/inbox'",'<InboxComms'],
  ["'/phone'",'<PhoneOps'],
  ["'/support'",'<SupportOps'],
  ["'/team-chat'",'<TeamChat'],
  ["'/manual'",'<ManualPage'],
  ["'/reports'",'<ReportsPage']
].every(([route,component])=>live.includes(`path === ${route}`)&&live.includes(component)),'All primary CRM routes resolve to their intended modules instead of generic fallback')
check(ops.includes('export function ScheduleOps')&&ops.includes("from('appointments')"),'Schedule module is live-data wired')
check(ops.includes('export function PatientsOps')&&ops.includes("from('patients')"),'Patients module is live-data wired')
check(ops.includes('export function ClinicalOps')&&ops.includes('clinical_records'),'Clinical module is live-data wired')
check(ops.includes('export function OpticalOps')&&ops.includes('optical_orders')&&ops.includes('optical_inventory'),'Optical module is live-data wired')
check(comms.includes('export function InboxComms')&&comms.includes('communication_threads')&&comms.includes('communication_messages'),'Inbox module is live-data wired')
check(comms.includes('export function PhoneOps')&&comms.includes("functions.invoke('phone-session'")&&comms.includes('client.dial('),'Phone module is browser-call wired')
check(comms.includes("functions.invoke('send-fax'")&&comms.includes('oculivo-documents'),'Fax module is private-document wired')
check(live.includes('function TeamChat')&&live.includes('team_channels')&&live.includes('team_messages'),'Team Chat module is live-data wired')
check(ops.includes('export function TimeclockOps')&&ops.includes('time_entries'),'Timeclock module is live-data wired')
check(ops.includes('export function BillingOps')&&ops.includes('invoices')&&ops.includes('insurance_claims')&&ops.includes('payments'),'Billing module covers invoices, claims, and payments')
check(ops.includes('export function DocumentsOps')&&ops.includes('oculivo-documents'),'Documents module is private-storage wired')
check(app.includes('<ESignaturesPage')&&esign.includes('universal-esign')&&esign.includes('resend_invite'),'Internal e-signature module is wired')
check(app.includes('/office-sign/:token')&&publicSign.includes('universal-esign')&&publicSign.includes('consent'),'Public signer route and consent flow are wired')
check(live.includes('ReportsPage')&&live.includes('clinical_records')&&live.includes('communication_messages'),'Reports module is live-data wired')
check(live.includes('function ManualPage')&&live.includes('Getting started'),'Manual module is present')
check(live.includes('<SupportOps')&&ops.includes('oculivo-support-api')&&ops.includes('support_tickets'),'Support module routes to RomyLabs and local audit')
check(app.includes("onClick={()=>{setOpen(false);navigate(path)}}"),'Left sidebar navigation stays inside React Router')
check(!app.includes("window.location.assign('/support')")&&!app.includes("window.location.assign('/phone')")&&!app.includes("window.location.assign('/inbox')"),'Internal CRM navigation does not force full-page reloads')
check(!/(?:^|[^\p{L}\p{N}_])(?:TODO|FIXME|HACK|XXX)(?=$|[^\p{L}\p{N}_])|not implemented|coming soon|mock data|demo data/iu.test(allSource),'No incomplete implementation markers remain in primary UI source')
check(esign.includes('Firmas electrónicas')&&esign.includes('E-Signatures'),'Internal e-signature workflow is bilingual')
check(esign.includes("action:'resend_invite'")&&esign.includes("'Reenviar':'Resend'"),'E-signature resend workflow is wired in EN/ES')
check(publicSign.includes('Firma electrónica de Oculivo')&&publicSign.includes('Oculivo E-Signature'),'Public signer workflow is bilingual')
check(comms.includes("functions.invoke('send-fax'"),'Outbound fax is wired into communications')
check(comms.includes("from('documents').insert"),'Outbound fax document is retained in private Documents audit trail')
check(comms.includes("next==='failed'")&&comms.includes("next==='destroyed'")&&comms.includes("next==='connecting'"),'Browser dialer handles SignalWire connecting, failed, and destroyed call states')
check(comms.includes('client.ready$.subscribe')&&comms.includes('await waitForReady(client)')&&comms.indexOf('await waitForReady(client)')<comms.indexOf('client.dial('),'Browser dialer waits for SignalWire readiness before dialing')
check(comms.includes("receiveAudio:true")&&comms.includes("receiveVideo:false"),'Browser dialer explicitly receives audio and disables video for voice-only calls')
check(pkg.dependencies?.['@signalwire/js']==='4.0.0-rc.2'&&pkg.dependencies?.rxjs==='7.8.2','SignalWire browser SDK and RxJS peer dependency are pinned for the dialer build')
check(requiredFunctions.every(fn=>fs.existsSync(new URL('../supabase/functions/'+fn+'/index.ts',import.meta.url))),'All required Edge Function source files exist')
check(['oculivo-ai','oculivo-support-api','phone-session','send-email','send-sms'].every(fn=>config.includes(`[functions.${fn}]\nverify_jwt = true`)),'Authenticated Edge Functions explicitly require gateway JWT verification')
check(config.includes('[functions.send-fax]\nverify_jwt = false'),'Fax callback function explicitly allows provider callback traffic with custom authentication')
check(config.includes('[functions.universal-esign]\nverify_jwt = false'),'Public signer function explicitly allows token-scoped signer traffic with custom authentication')
check(esignFn.includes("action==='resend_invite'")&&esignFn.includes('Uploaded file must be a valid PDF'),'E-sign backend supports secure resend and PDF signature validation')
check(esignFn.includes("createBucket(BUCKET,{public:false")&&esignFn.includes("allowedMimeTypes:['application/pdf','application/json']"),'E-sign storage self-provisions as a private PDF/JSON bucket when absent')
check(esignFn.includes('source_sha256')&&esignFn.includes('signed_sha256')&&esignFn.includes('certificate_sha256'),'E-sign completion preserves source, signed PDF, and certificate hashes')
check(fs.existsSync(new URL('../supabase/migrations/20260917112500_universal_esign_bucket_hardening.sql',import.meta.url)),'E-sign bucket hardening migration is present for existing bucket state')
check(phoneFn.includes('req.method!=="POST"')&&phoneFn.includes('Method not allowed'),'Phone function rejects non-POST requests after CORS preflight')
check(phoneFn.includes('Invalid call status action')&&phoneFn.includes('Outbound browser call · '),'Phone call lifecycle is validated and persisted in CRM history')
check(faxFn.includes('OCULIVO_FAX_CALLBACK_SECRET')&&faxFn.includes('Invalid callback signature')&&faxFn.includes('await hmac(secret'),'Fax provider callbacks are HMAC authenticated')
check(faxFn.includes('storage_path')&&faxFn.includes('outside this practice')&&faxFn.includes('organization_memberships'),'Fax sends enforce practice-scoped storage and active membership')
check(emailFn.includes('req.method!=="POST"')&&emailFn.includes('organization_memberships')&&emailFn.includes('Communication permission required'),'Email send requires POST, authenticated user, and active communication role')
check(emailFn.includes('BREVO_API_KEY')&&emailFn.includes('OCULIVO_FROM_EMAIL')&&emailFn.includes('communication_messages'),'Email provider configuration and CRM audit logging are present')
check(smsFn.includes('req.method!=="POST"')&&smsFn.includes('organization_memberships')&&smsFn.includes('Communication permission required'),'SMS send requires POST, authenticated user, and active communication role')
check(smsFn.includes('OCULIVO_SMS_FROM_NUMBER')&&smsFn.includes('SIGNALWIRE_AUTH_TOKEN')&&smsFn.includes('communication_messages'),'SMS provider configuration and CRM audit logging are present')
check(supportFn.includes('OCULIVO_SUPPORT_SECRET')&&supportFn.includes('x-romylabs-signature')&&supportFn.includes('Active practice membership required'),'Support bridge signs outbound requests and requires active practice membership')
check(aiFn.includes('organization_memberships')&&aiFn.includes('Not authorized for this practice')&&aiFn.includes('Never expose data from another organization'),'AI assistant is scoped to an authenticated active practice membership')
check(!/voicemail|patient portal conversations/i.test(app),'CRM copy does not claim unsupported voicemail or patient portal workflows')
check(app.includes("function canAccessPath(")&&app.includes("path==='/clinical'")&&app.includes("path==='/inbox'||path==='/phone'||path==='/esign'")&&app.includes("canAccessPath('/esign',selectedOrg?.role||'')?<ESignaturesPage"),'Clinical, communications, and e-sign routes are role-gated')
check(fs.existsSync(new URL('../supabase/migrations/20260913113500_clinical_read_least_privilege.sql',import.meta.url)),'Clinical read least-privilege migration is present')
check(fs.existsSync(new URL('../supabase/migrations/20260913114000_communication_read_least_privilege.sql',import.meta.url)),'Communication read least-privilege migration is present')
check(app.includes("role={selectedOrg?.role||''}"),'Global search receives the active role for sensitive-result filtering')
check(app.includes('canSearchCommunications')&&app.includes("Promise.resolve({data:[],error:null})"),'Global search skips restricted communications queries instead of relying on post-query filtering')
check(ops.includes('canReadClinical=clinician(org.role)')&&ops.includes("Promise.resolve({data:[],error:null})"),'Patient profile skips restricted clinical queries for non-clinical roles')
check(live.includes("table==='clinical_records'")&&live.includes("table==='communication_messages'")&&live.includes('org?.role'),'Reports respect role-scoped clinical and communication access')
check(live.includes('canReadCommunications')&&live.includes("Promise.resolve({count:0,error:null})"),'Overview skips restricted communication counts for roles without access')
check(css.includes('Hide sidebar scrollbar while preserving scroll')&&css.includes('scrollbar-width:none!important')&&css.includes('.sidebar-nav-scroll::-webkit-scrollbar'),'Sidebar scrollbar is hidden while scroll remains enabled')
if(process.exitCode)process.exit(process.exitCode)