import { readdirSync, statSync, readFileSync } from 'fs'
import { join } from 'path'
import { gzipSync } from 'zlib'

const DIST = join(process.cwd(), 'dist', 'web')

function gzippedKb(buf) {
  if (!buf.length) return 0
  return gzipSync(buf).length / 1024
}

function walkJs(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walkJs(p, files)
    else if (name.endsWith('.js') && !name.endsWith('.js.map')) {
      files.push({ name, path: p, size: s.size })
    }
  }
  return files
}

const files = walkJs(join(DIST, 'assets', 'js'))
const list = files
  .map(f => ({ ...f, gz: gzippedKb(readFileSync(f.path)) }))
  .sort((a, b) => b.gz - a.gz)
  .slice(0, 20)

console.log('=== Top 20 gzipped JS files ===')
let total = 0
for (const f of list) {
  total += f.gz
  console.log(`  ${f.gz.toFixed(1).padStart(8)} KB  ${f.name}`)
}
console.log(`  ...`)
console.log(`  TOTAL ${files.length} files`)
