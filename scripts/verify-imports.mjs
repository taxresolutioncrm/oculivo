import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'))
const declared=new Set([...Object.keys(pkg.dependencies||{}),...Object.keys(pkg.devDependencies||{})])
const files=[]
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name)
    if(entry.isDirectory())walk(full)
    else if(/\.(?:ts|tsx|js|jsx)$/.test(entry.name))files.push(full)
  }
}
walk(path.join(root,'src'))

const missing=[]
const markers=[]
for(const file of files){
  const src=fs.readFileSync(file,'utf8')
  if(/\b(?:TODO|FIXME|HACK|XXX)\b|not implemented|coming soon|mock data|demo data/i.test(src))markers.push(path.relative(root,file))
  const specs=[]
  for(const m of src.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g))specs.push(m[1])
  for(const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g))specs.push(m[1])
  for(const spec of specs){
    if(spec.startsWith('.')||spec.startsWith('/')||spec.startsWith('node:')||spec.startsWith('http:')||spec.startsWith('https:'))continue
    const name=spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0]
    if(!declared.has(name))missing.push(`${path.relative(root,file)} -> ${name}`)
  }
}

if(markers.length){console.error('FAIL: incomplete markers remain in',markers.join(', '));process.exitCode=1}
else console.log('PASS: no incomplete markers remain anywhere in src')
if(missing.length){console.error('FAIL: undeclared source imports:',[...new Set(missing)].join(', '));process.exitCode=1}
else console.log('PASS: every external source import is declared in package.json')
if(process.exitCode)process.exit(process.exitCode)
