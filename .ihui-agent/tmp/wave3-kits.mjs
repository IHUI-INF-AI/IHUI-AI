// Wave3 kit 生成器:把席位会烧光轮次的取证动作离线做完,每包产一份小 kit。
// kit = 页面族清单 + 端点候选证据(带 文件:行) + 该页实际引用 i18n 键的五语取值表。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const LANGS = ['zh-CN', 'en', 'zh-TW', 'ja', 'ko']
const triage = JSON.parse(fs.readFileSync(path.join(ROOT, '.ihui-agent/tmp/wave3-triage.json'), 'utf8'))
const byWeb = new Map(triage.map((r) => [r.web, r]))

const webMsg = {}
for (const l of LANGS) {
  webMsg[l] = JSON.parse(fs.readFileSync(path.join(ROOT, `packages/i18n/messages/web/${l}.json`), 'utf8'))
}

// 后端路由面一次性扫全(席位不必各自 grep apps/api)
const ROUTES = path.join(ROOT, 'apps/api/src/routes')
const routeFiles = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (p.endsWith('.ts')) routeFiles.push(p)
  }
})(ROUTES)
const routeSrc = routeFiles.map((p) => ({
  rel: path.relative(ROOT, p).replace(/\\/g, '/'),
  text: fs.readFileSync(p, 'utf8'),
  lines: fs.readFileSync(p, 'utf8').split('\n'),
}))
console.log('后端路由件', routeSrc.length)

function apiEvidence(api) {
  const tail = api.replace(/^\/api/, '').split('/').filter((s) => s && !s.startsWith('${')).pop()
  if (!tail) return []
  const hits = []
  for (const f of routeSrc) {
    for (let i = 0; i < f.lines.length; i++) {
      if (new RegExp(`['"\`][^'"\`]*\\b${tail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^'"\`]*['"\`]`).test(f.lines[i])) {
        hits.push(`${f.rel}:${i + 1}`)
        break
      }
    }
    if (hits.length >= 4) break
  }
  return hits
}

function pageStrings(dir) {
  const files = []
  ;(function walk(d, depth) {
    if (depth > 2) return
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        if (!e.name.startsWith('.') && e.name !== 'node_modules') walk(p, depth + 1)
      } else if (/\.(tsx|ts)$/.test(e.name)) files.push(p)
    }
  })(dir, 0)
  return files
}

function collect(route) {
  const r = byWeb.get(route)
  if (!r || !r.dir) return [`## ${route}\n  ⚠️ 无 web 目录,自行定位\n`]
  const dir = path.join(ROOT, r.dir)
  const out = [`## ${route}`, `  web 目录: ${r.dir}`]
  const files = pageStrings(dir)
  out.push(`  页面族(${files.length} 件,只读这些,别去全仓 grep):`)
  const apis = new Set()
  const nsSet = new Set()
  const usedKeys = new Set()
  for (const f of files) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/')
    const s = fs.readFileSync(f, 'utf8')
    const nlines = s.split('\n').length
    out.push(`    - ${rel} (${nlines} 行)`)
    for (const m of s.matchAll(/useTranslations\(\s*['"]([^'"]+)['"]/g)) nsSet.add(m[1])
    for (const m of s.matchAll(/\b(?:t|tc|ct)\(\s*['"]([A-Za-z0-9_.]+)['"]/g)) usedKeys.add(m[1])
    for (const m of s.matchAll(/['"`](\/api\/[A-Za-z0-9/_-]+)/g)) apis.add(m[1])
  }
  if (apis.size) {
    out.push('  端点面(web 页实际调用 + 后端注册候选):')
    for (const a of [...apis].sort()) {
      const ev = apiEvidence(a)
      out.push(`    - ${a}${ev.length ? '  ← ' + ev.join(', ') : '  ← 后端未命中(可能不存在或前缀拆分注册,需自证)'}`)
    }
  } else {
    out.push('  端点面:页面未直出 /api 字面量 —— 数据来源必须读代码确认(本地 store / SSE / 静态数据 / 未实现)')
  }
  // i18n 五语取值表(按命名空间逐个导,键取 web 页实际引用到的)
  const nsList = [...nsSet]
  for (const ns of nsList) {
    const parts = ns.split('.')
    const pick = (lang) => parts.reduce((o, k) => (o ? o[k] : undefined), webMsg[lang])
    const sample = pick('zh-CN')
    if (!sample || typeof sample !== 'object') continue
    const wantedKeys = [...usedKeys].map((k) => k.split('.').pop())
    const keys = Object.keys(sample).filter((k) => typeof sample[k] === 'string')
    const scope = keys.filter((k) => wantedKeys.includes(k))
    const use = scope.length >= 3 ? scope : keys
    out.push(`  i18n 命名空间 ${ns}(共 ${keys.length} 键,本 kit 附 ${use.length} 键五语值):`)
    for (const k of use) {
      out.push(
        `    ${k} | zh-CN=${JSON.stringify(pick('zh-CN')?.[k])} | en=${JSON.stringify(pick('en')?.[k])} | zh-TW=${JSON.stringify(pick('zh-TW')?.[k])} | ja=${JSON.stringify(pick('ja')?.[k])} | ko=${JSON.stringify(pick('ko')?.[k])}`,
      )
    }
  }
  out.push('')
  return out
}

const PACKS = JSON.parse(fs.readFileSync(path.join(ROOT, '.ihui-agent/tmp/wave3-packs.json'), 'utf8'))
for (const [id, routes] of Object.entries(PACKS)) {
  const lines = [`# Wave3 kit ${id.toUpperCase()} —— 证据已预消化,席位直接照此写码`, '']
  for (const r of routes) lines.push(...collect(r))
  const p = path.join(ROOT, `.ihui-agent/wave3/${id}.kit.md`)
  fs.writeFileSync(p, lines.join('\n'))
  console.log(id, routes.length + '条', (lines.join('\n').length / 1024).toFixed(1) + 'KB')
}
