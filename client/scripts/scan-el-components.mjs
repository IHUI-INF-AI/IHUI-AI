import { execSync } from 'child_process'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, extname } from 'path'

const SRC = join(process.cwd(), 'src')
const EXT = new Set(['.vue', '.ts', '.tsx', '.js'])

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) {
      if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue
      walk(p, files)
    } else if (EXT.has(extname(name))) {
      files.push(p)
    }
  }
  return files
}

const all = walk(SRC)
const fromEp = new Set()
const comp = new Set()
const re = /\bEl[A-Z][A-Za-z0-9]+\b/g
const importRe = /from\s+['"]element-plus['"]/i

for (const f of all) {
  const txt = readFileSync(f, 'utf8')
  if (!importRe.test(txt)) continue
  fromEp.add(f)
  let m
  while ((m = re.exec(txt)) !== null) {
    comp.add(m[0])
  }
}

console.log('Files importing from "element-plus":', fromEp.size)
console.log('Unique El* components referenced:', comp.size)
console.log()
console.log('Component list:')
void [...comp].sort().forEach(c => console.log('  ' + c))
