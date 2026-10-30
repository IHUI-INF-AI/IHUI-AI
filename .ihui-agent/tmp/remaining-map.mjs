// 剩余 gap 的数据源分类:逐条列 web 页打的 /api 面 + 后端注册证据(命中给 文件:行)。
// 注意:这是启发式筛查,输出只作"候选",不当判据 —— 前缀注册 + 相对路径('GET /')那一型必须人工复核
// (user/sign-up 就是例子:routes/sign-ups.ts 注册的是 server.get('/'),靠 index.ts:868 的 prefix 才拼成 /api/sign-ups)。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const gaps = fs
  .readFileSync(path.join(ROOT, 'scripts/data/web-rn-screen-map.jsonl'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => r.status === 'gap')

const ROUTES = path.join(ROOT, 'apps/api/src/routes')
const routeFiles = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (p.endsWith('.ts')) routeFiles.push(p)
  }
})(ROUTES)
const src = routeFiles.map((p) => ({
  rel: path.relative(ROOT, p).replace(/\\/g, '/'),
  lines: fs.readFileSync(p, 'utf8').split('\n'),
}))

function registered(api) {
  const bare = api.replace(/^\/api/, '').replace(/\$\{.*$/, '').replace(/\/$/, '') || '/'
  const segs = bare.split('/').filter(Boolean)
  const head = segs[0]
  const hits = []
  for (const f of src) {
    for (let i = 0; i < f.lines.length; i++) {
      const l = f.lines[i]
      // 形态一:prefix 注册到该域根
      const pm = /prefix:\s*['"`]\/api\/([a-z0-9-]+)/i.exec(l)
      if (pm && pm[1] === head) {
        hits.push(`${f.rel}:${i + 1} prefix=/api/${pm[1]}`)
        break
      }
      // 形态二:字面量路径含该尾段
      if (segs.length && l.includes(`/${segs[segs.length - 1]}`) && /server\.(get|post|put|patch|delete)\(|\.(get|post|put|patch|delete)\(/.test(l)) {
        hits.push(`${f.rel}:${i + 1}`)
        break
      }
    }
    if (hits.length >= 2) break
  }
  return hits
}

function pageApis(dir) {
  const apis = new Set()
  if (!dir) return []
  const walk2 = (d, depth) => {
    if (depth > 2 || !fs.existsSync(d)) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        if (!e.name.startsWith('.') && e.name !== 'node_modules') walk2(p, depth + 1)
      } else if (/\.(tsx|ts)$/.test(e.name)) {
        const s = fs.readFileSync(p, 'utf8')
        for (const m of s.matchAll(/['"`](\/api\/[a-zA-Z0-9/_-]+)/g)) apis.add(m[1])
      }
    }
  }
  walk2(dir, 0)
  return [...apis]
}

const triage = new Map(
  JSON.parse(fs.readFileSync(path.join(ROOT, '.ihui-agent/tmp/wave3-triage.json'), 'utf8')).map((r) => [r.web, r]),
)

const buckets = { screenable: [], suspectNoBackend: [], noApiLiteral: [] }
for (const g of gaps) {
  const t = triage.get(g.web)
  const apis = t ? pageApis(path.join(ROOT, t.dir)) : []
  if (!apis.length) {
    buckets.noApiLiteral.push(g.web)
    continue
  }
  const evidence = apis.map((a) => ({ a, hits: registered(a) }))
  const dead = evidence.filter((e) => !e.hits.length)
  if (dead.length === evidence.length) buckets.suspectNoBackend.push({ web: g.web, apis: dead.map((d) => d.a) })
  else buckets.screenable.push({ web: g.web, apis: evidence.map((e) => `${e.a}${e.hits.length ? '' : ' [无注册证据]'}`).join(' ') })
}

console.log(`剩余 gap ${gaps.length} 条分类:`)
console.log(`  A 有可注册端点(可补屏)        : ${buckets.screenable.length}`)
console.log(`  B 所打端点全查无注册证据(疑死页): ${buckets.suspectNoBackend.length}`)
console.log(`  C 页面无 /api 字面量(需读源)   : ${buckets.noApiLiteral.length}`)
console.log('\n--- B 桶(逐条列它打了哪些面)---')
for (const b of buckets.suspectNoBackend) console.log(`  ${b.web}  →  ${b.apis.join(', ')}`)
console.log('\n--- C 桶 ---')
console.log('  ' + buckets.noApiLiteral.join(', '))
fs.writeFileSync(
  path.join(ROOT, '.ihui-agent/tmp/wave3-remaining-map.json'),
  JSON.stringify({ at: new Date().toISOString(), buckets }, null, 2),
)
