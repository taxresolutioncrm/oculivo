import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
const assert=(ok,msg)=>{console.log((ok?'PASS: ':'FAIL: ')+msg);if(!ok)process.exitCode=1}
const app=read('src/App.tsx')
const page=read('src/pages/AIIntelligencePage.tsx')
assert(app.includes("path:'/ai-intelligence'"),'AI Intelligence has its own navigation destination')
assert(app.includes("path:'/phone'")&&app.indexOf("path:'/ai-intelligence'")>app.indexOf("path:'/phone'"),'AI Intelligence follows Phone')
assert(app.includes('AIIntelligencePage'),'AI Intelligence page is routed')
assert(page.includes('Optometry Intelligence'),'optometry intelligence profile is visible')
assert(page.includes('External AI processing of PHI remains disabled'),'raw PHI external AI processing is explicitly gated')
assert(page.includes('PHI'),'PHI protection is visible')
assert(!page.includes("functions.invoke('document-intelligence")&&!page.includes("functions.invoke('ai-intelligence-document"),'patient documents are not sent to external AI from this page')
if(process.exitCode)process.exit(process.exitCode)
console.log('Oculivo AI Intelligence compliance checks passed.')
