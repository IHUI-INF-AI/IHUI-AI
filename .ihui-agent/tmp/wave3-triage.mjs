// Wave3 分诊:对台账 gap 档 69 条逐条取证 —— web 页面族文件 / API 端点 / 候选共享屏与 RN 屏。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const ledger = fs
  .readFileSync(path.join(ROOT, 'scripts/data/web-rn-screen-map.jsonl'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l))

const gaps = ledger.filter((r) => r.status === 'gap')
const APP_DIRS = [
  path.join(ROOT, 'apps/web/app'),
]
const appDir = APP_DIRS[0]

function findPageDir(route) {
  // route 形如 edu/schedule 或 agents/edit/[id]
  const segs = route.split('/')
  const candidates = []
  // 常见两级:app/(main)/<route> 与 app/<route>
  candidates.push(path.join(appDir, '(main)', ...segs))
  candidates.push(path.join(appDir, ...segs))
  // 有些路由首段是 group,如 (main)/xxx
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  // 退一步:全树按尾段匹配
  const tail = segs.join(path.sep)
  const hits = []
  const walk = (dir, depth) => {
    if (depth > 6) return
    let ents = []
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (p.endsWith(tail)) hits.push(p)
        walk(p, depth + 1)
      }
    }
  }
  walk(appDir, 0)
  return hits[0] || null
}

function collectPageFamily(dir) {
  const out = []
  const walk = (d, depth) => {
    if (depth > 2) return
    let ents = []
    try {
      ents = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue
        walk(p, depth + 1)
      } else if (/\.(tsx|ts)$/.test(e.name)) {
        const st = fs.statSync(p)
        out.push({ file: path.relative(ROOT, p).replace(/\\/g, '/'), bytes: st.size })
      }
    }
  }
  walk(dir, 0)
  return out.sort((a, b) => b.bytes - a.bytes)
}

function extractApis(dir) {
  const apis = new Set()
  const files = collectPageFamily(dir)
  for (const f of files) {
    let s = ''
    try {
      s = fs.readFileSync(path.join(ROOT, f.file), 'utf8')
    } catch {
      continue
    }
    for (const m of s.matchAll(/['"`](\/api\/[a-zA-Z0-9/_:$-]+)['"`]/g)) apis.add(m[1])
    for (const m of s.matchAll(/`(\/api\/[^`$]*)\$\{/g)) apis.add(m[1] + '${…}')
  }
  return [...apis].sort()
}

const features = fs.existsSync(path.join(ROOT, 'packages/app/src/features'))
  ? fs.readdirSync(path.join(ROOT, 'packages/app/src/features'))
  : []
const rnScreens = fs.existsSync(path.join(ROOT, 'apps/mobile-rn/src/screens'))
  ? fs.readdirSync(path.join(ROOT, 'apps/mobile-rn/src/screens'))
  : []
const endpoints = fs.existsSync(path.join(ROOT, 'packages/api-client/src/endpoints'))
  ? fs.readdirSync(path.join(ROOT, 'packages/api-client/src/endpoints'))
  : []

const out = []
for (const g of gaps) {
  const seg = g.web.split('/')[0]
  const dir = findPageDir(g.web)
  const family = dir ? collectPageFamily(dir) : []
  const apis = dir ? extractApis(dir) : []
  // 候选:首段同名 feature 目录 / 端点文件 / RN 屏名包含首段
  const segNorm = seg.replace(/-/g, '')
  const featureHits = features.filter((f) => f.toLowerCase().replace(/-/g, '') === segNorm || f.toLowerCase().includes(segNorm))
  const endpointHits = endpoints.filter((f) => f.toLowerCase().replace(/-/g, '').includes(segNorm))
  const rnHits = rnScreens.filter((f) => f.toLowerCase().replace(/-/g, '').includes(segNorm))
  out.push({
    web: g.web,
    note: g.note,
    dir: dir ? path.relative(ROOT, dir).replace(/\\/g, '/') : null,
    files: family.length,
    lines: family.reduce((a, f) => a + f.bytes, 0),
    apis,
    featureHits,
    endpointHits,
    rnHits,
  })
}

fs.writeFileSync(path.join(ROOT, '.ihui-agent/tmp/wave3-triage.json'), JSON.stringify(out, null, 2))
console.log('gap', out.length)
for (const r of out) {
  console.log(`${r.web}\n  dir=${r.dir} files=${r.files} bytes=${r.lines}\n  apis=${r.apis.slice(0, 6).join(', ') || '—'}\n  feature=${r.featureHits.join(',') || '—'} endpoint=${r.endpointHits.join(',') || '—'} rn=${r.rnHits.slice(0, 4).join(',') || '—'}`)
}
