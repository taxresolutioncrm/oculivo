import fs from 'node:fs'
const read = path => fs.readFileSync(new URL('../'+path, import.meta.url), 'utf8')
const fail = message => { console.error('FAIL:', message); process.exitCode = 1 }
const assert = (ok,message) => ok ? console.log('PASS:',message) : fail(message)
const pkg=JSON.parse(read('package.json'))
const manifest=read('src/release.ts')
const app=read('src/App.tsx')
const modal=read('src/components/ReleaseHistory.tsx')
const css=read('src/index.css')
const version=manifest.match(/version:\s*'([^']+)'/)?.[1]
assert(/^\d+\.\d+\.\d+$/.test(version||''),'Manifest is valid semantic versioning')
assert(pkg.version===version,'Package and release manifest versions match')
assert(/product:\s*'Oculivo'/.test(manifest),'Manifest belongs to Oculivo')
assert(!/Tax Case Review|Nashville Tax Solutions|Centurion Firm|TCR CRM/i.test(manifest),'Manifest contains no other CRM branding')
assert(/ReleaseHistory/.test(app)&&/release\.version/.test(app),'Sidebar displays the manifest version and release dialog')
assert(/createPortal\(/.test(modal)&&/document\.body/.test(modal),'Release dialog renders through a document.body portal')
assert(/position:\s*fixed/.test(css)&&/oculivo-release-overlay/.test(css),'Release overlay uses fixed viewport positioning')
assert(/aria-modal="true"/.test(modal)&&/role="dialog"/.test(modal),'Release dialog has accessible modal semantics')
assert(/event\.key === 'Escape'/.test(modal)&&/event\.target === event\.currentTarget/.test(modal),'Escape and outside click close dialog')
assert(/style\.overflow = 'hidden'/.test(modal)&&/style\.overflow = originalOverflow/.test(modal),'Body scroll is locked and restored')
const allowed=new Set([
  'Formal semantic versioning begins with this release baseline',
  'Production release history is now tracked inside Oculivo',
  'Release notes dialog added with body-level portal layering'
])
const notes=Array.from(manifest.matchAll(/^    '([^']+)'[,]?$/gm),m=>m[1])
assert(notes.length===allowed.size&&notes.every(note=>allowed.has(note)),'Baseline changelog contains only approved release metadata changes')
