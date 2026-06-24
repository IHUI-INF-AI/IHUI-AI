import { readdirSync, statSync, readFileSync } from 'fs'
import { join, basename } from 'path'

const DIST = join(process.cwd(), 'dist', 'web', 'assets')

function walk(dir, exts, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, exts, files)
    else if (exts.some(e => name.endsWith(e))) files.push({ name, size: s.size, path: p })
  }
  return files
}

const jsFiles = walk(join(DIST, 'js'), ['.js'])
const cssFiles = walk(join(DIST, 'css'), ['.css'])

// Modulepreload referenced in index.html
const html = readFileSync(join(DIST, '..', 'index.html'), 'utf8')
const preloadRe = /modulepreload.*?href="\/assets\/(js|css)\/([^"]+)"/g
const preloaded = new Set()
let m
while ((m = preloadRe.exec(html)) !== null) preloaded.add(m[2])

// CSS via index-*.js entry: read the entry chunk to find its CSS imports
const entryRe = /src="\/assets\/(js|css)\/([^"]+)"/g
const entryLoaded = new Set()
while ((m = entryRe.exec(html)) !== null) entryLoaded.add(m[2])
// Add index-*.css to first-paint since it's referenced by entry chunk
for (const f of cssFiles) {
  if (f.name.startsWith('index-')) entryLoaded.add(f.name)
}

console.log('=== 首屏资源 (modulepreload + 入口 index-*.css) ===')
const preloadList = []
for (const f of [...jsFiles, ...cssFiles]) {
  if (preloaded.has(f.name) || entryLoaded.has(f.name)) preloadList.push(f)
}
preloadList.sort((a, b) => b.size - a.size)
let totalJs = 0, totalCss = 0
for (const f of preloadList) {
  const kb = (f.size / 1024).toFixed(1)
  console.log(`  ${kb.padStart(8)} KB  ${f.name}`)
  if (f.name.endsWith('.js')) totalJs += f.size
  else totalCss += f.size
}
console.log(`  ----------`)
console.log(`  ${(totalJs / 1024).toFixed(1).padStart(8)} KB  TOTAL JS`)
console.log(`  ${(totalCss / 1024).toFixed(1).padStart(8)} KB  TOTAL CSS`)
console.log(`  ${((totalJs + totalCss) / 1024).toFixed(1).padStart(8)} KB  TOTAL`)
console.log()
console.log('=== echarts 相关 chunk (动态加载) ===')
for (const f of jsFiles) {
  if (f.name.includes('echarts')) {
    console.log(`  ${(f.size / 1024).toFixed(1).padStart(8)} KB  ${f.name}  (lazy, 用户进入管理后台才下载)`)
  }
}
