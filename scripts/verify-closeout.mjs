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
const requiredRoutes=['/schedule','/patients','/clinical','/optical','/inbox','/phone','/team-chat','/timeclock','/billing','/documents','/esign','/reports','/manual','/support']
const requiredFunctions=['oculivo-ai','oculivo-support-api','phone-session','send-email','send-sms','send-fax','universal-esign']
const allSource=[app,comms,live,esign,publicSign].join('\n')

check(requiredRoutes.every(r=>app.includes(r)),'All required CRM routes are wired')
check(!/\b(TODO|FIXME|HACK|XXX)\b|not implemented|coming soon|mock data|demo data/i.test(allSource),'No incomplete implementation markers remain in primary UI source')
check(esign.includes('Firmas electrónicas')&&esign.includes('E-Signatures'),'Internal e-signature workflow is bilingual')
check(publicSign.includes('Firma electrónica de Oculivo')&&publicSign.includes('Oculivo E-Signature'),'Public signer workflow is bilingual')
check(comms.includes("functions.invoke('send-fax'"),'Outbound fax is wired into communications')
check(comms.includes("from('documents').insert"),'Outbound fax document is retained in private Documents audit trail')
check(requiredFunctions.every(fn=>fs.existsSync(new URL('../supabase/functions/'+fn+'/index.ts',import.meta.url))),'All required Edge Function source files exist')
check(config.includes('[functions.send-fax]')&&config.includes('verify_jwt = false'),'Fax callback function is configured for signed provider callbacks')
check(!/voicemail|patient portal conversations/i.test(app),'CRM copy does not claim unsupported voicemail or patient portal workflows')
if(process.exitCode)process.exit(process.exitCode)
