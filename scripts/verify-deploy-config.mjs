import fs from 'node:fs'
const vite=fs.readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8')
const wrangler=fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8')
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8')
const checks=[
  [wrangler.includes('"directory": "./dist"'),'Cloudflare serves the Vite dist directory'],
  [wrangler.includes('"not_found_handling": "single-page-application"'),'Cloudflare SPA fallback is enabled for client routes'],
  [wrangler.includes('"pattern": "app.oculivo.com"')&&wrangler.includes('"custom_domain": true'),'Cloudflare custom domain remains app.oculivo.com'],
  [vite.includes("outDir: 'dist'")||!vite.includes('outDir:'),'Vite output remains compatible with the Cloudflare dist directory'],
  [html.includes('id="root"')&&html.includes('/src/main.tsx'),'App entry document mounts the React application']
]
let failed=false
for(const [ok,label] of checks){
  if(ok)console.log('PASS:',label)
  else{console.error('FAIL:',label);failed=true}
}
if(failed)process.exit(1)
