// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出预演/落地清单 */
// 跨端登记自动器(web→RN 功能映射 / RN→小程序镜像声明)——默认只读预演,`--apply` 才写盘。
//
// 为什么要有这件器物:两条链的判据都已是"登记表说了算",但人工逐条登记追不上屏的增长
// (2026-10-25 现读:web 886 路由 / RN 291 屏 / 共享屏 218 / 小程序页 173,显式镜像仅 84)。
// 本工具只做**已有证据的机械登记**,不做任何 UI 翻译:
//   ① web→RN:`scripts/data/web-rn-screen-map.jsonl` 追加 aligned 行。证据 = web 页端点与
//      该共享屏 RN 壳端点交集(jac ≥ 0.5 或 common ≥ 2)**且**路由名 token 与屏名 token 同源。
//      单靠端点会把 `console-table` 这种通用屏登记到任意 edu 子页,故名称同源是硬门槛。
//   ② RN→小程序:给已存在且证据强的小程序页补「镜像」标记 + registry 条目。
//      证据 = 专有 i18n 命名空间命中且专有键重合 ≥ 2(排除 common.* 通用键),或端点 jac ≥ 0.4。
//      页面已带任何镜像标记 ⇒ 跳过(不猜、不覆盖他人声明)。
//
// 判据零复算:路由/屏枚举与 token 化 import check-web-rn-screen-parity 的 __test__;
// 共享屏/RN 屏/小程序页枚举与镜像标记识别 import check-cross-end-screen-coverage 的 __test__(§0.6)。
// 取材面 §0.4:默认 HEAD blob;`--worktree` 仅人工逃生舱;取不到面 ⇒ exit 2「未判定」。
//
// Usage:
//   node scripts/auto-register-cross-end.mjs                 # 预演(打印将登记条目)
//   node scripts/auto-register-cross-end.mjs --apply         # 写盘(工作树,提交走仓规)
//   node scripts/auto-register-cross-end.mjs --json          # 机器可读
//   node scripts/auto-register-cross-end.mjs --only=web-rn|miniapp
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as parity } from './check-web-rn-screen-parity.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const R = (...p) => join(ROOT, ...p)
const MAP_PATH = 'scripts/data/web-rn-screen-map.jsonl'
const REGISTRY_PATH = 'scripts/data/cross-end-screen-registry.json'
const INDEX_PATH = 'packages/app/src/index.ts'

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const applyMode = argv.includes('--apply')
const worktreeMode = argv.includes('--worktree')
const onlyArg = argv.find((a) => a.startsWith('--only='))
const only = onlyArg ? onlyArg.slice('--only='.length) : null
const FACE = worktreeMode ? 'worktree' : 'head'
const TODAY = new Date().toISOString().slice(0, 10)

const EP_RE = /['"`](\/api\/[A-Za-z0-9_./${}-]*)/g
const KEY_RE = /\b(?:t|tt)\(\s*'([A-Za-z0-9_.-]+)'/g
const GENERIC_NS = new Set(['common', 'app', 'nav', 'button', 'action', 'state', 'error', 'tip', 'toast'])

const normEp = (u) => u.replace(/\$\{[^}]*\}/g, ':x').replace(/\/+$/, '')
const endpointsOf = (text) => {
  const s = new Set()
  if (!text) return s
  for (const m of text.matchAll(EP_RE)) {
    const u = normEp(m[1])
    if (u.length > 5) s.add(u)
  }
  return s
}
const keysOf = (text) => {
  const s = new Set()
  if (!text) return s
  for (const m of text.matchAll(KEY_RE)) s.add(m[1])
  return s
}
const nsOf = (k) => k.split('.')[0]
const common = (a, b) => [...a].filter((x) => b.has(x))
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0
  const i = common(a, b).length
  return i / (a.size + b.size - i)
}
/** 复数/单数归一:只处理跨端命名最常见的 -s/-es 分歧 */
const stem = (t) => t.replace(/(?:ies)$/, 'y').replace(/(?:ses|xes|ches|shes)$/, 's').replace(/s$/, '')

const IMP_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
function namedImports(text, moduleName) {
  const out = []
  for (const m of (text || '').matchAll(IMP_RE)) {
    if (m[2] !== moduleName) continue
    for (const raw of m[1].split(',')) {
      const n = raw
        .replace(/\/\/.*$/gm, '')
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim()
      if (/^[A-Za-z0-9_]+$/.test(n)) out.push(n)
    }
  }
  return out
}

const shared = cov.collectShared(FACE)
const rn = cov.collectRn(FACE)
const mp = cov.collectMiniapp(FACE)
const routes = parity.collectWebRoutes(FACE)
if (shared.length === 0 || mp.length === 0 || routes.length === 0) {
  console.error(
    `❌ 未判定:取不到被审面(共享屏 ${shared.length} / 小程序页 ${mp.length} / web 路由 ${routes.length})`,
  )
  process.exit(2)
}

// symbol -> RN 壳文件(决定 registry 的 rn 腿)
const symbolOwners = new Map()
for (const r of rn) {
  for (const name of namedImports(r.text, '@ihui/rn-app')) {
    if (!symbolOwners.has(name)) symbolOwners.set(name, [])
    symbolOwners.get(name).push(r.file)
  }
}
const indexText = cov.faceRead(FACE, INDEX_PATH) || ''
const isExported = (name) => new RegExp(`export\\s*(?:\\{[^}]*\\b${name}\\b|\\*\\s*from)`).test(indexText)

// ---------- ① web → RN ----------
const mapRows = parity.loadMap(FACE)
const registeredWeb = new Set(
  mapRows.filter((r) => r.status === 'aligned' && r.web).map((r) => r.web),
)
const webCandidates = []
if (!only || only === 'web-rn') {
  const screenEp = new Map()
  for (const s of shared) {
    const ep = new Set()
    for (const f of symbolOwners.get(s.name) || []) for (const e of endpointsOf(cov.faceRead(FACE, f) || '')) ep.add(e)
    screenEp.set(s.spec, ep)
  }
  const screenTokens = new Map(shared.map((s) => [s.spec, parity.screenTokens(s.name).map(stem)]))
  const setEq = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
  const subset = (a, b) => a.length > 0 && a.every((x) => b.includes(x))
  for (const { route, rel } of routes) {
    if (registeredWeb.has(route)) continue
    if (route === '(root)' || route.startsWith('api/') || route.startsWith('_')) continue
    const pageText = cov.faceRead(FACE, rel) || ''
    const eps = endpointsOf(pageText)
    if (eps.size === 0) continue
    const rTokens = parity.routeTokens(route).map(stem)
    const tailTokens = (route.split('/').pop() || '').split('-').map(stem).filter(Boolean)
    let best = null
    for (const s of shared) {
      const sep = screenEp.get(s.spec)
      if (!sep || sep.size === 0) continue
      const jac = jaccard(eps, sep)
      const n = common(eps, sep).length
      const strong = jac >= 0.5 || n >= 2
      if (!strong) continue
      const st = screenTokens.get(s.spec)
      // 名称同源硬门槛(宁漏不误):整路由或末段 token 集与屏名集完全相等;
      // 或屏名集是路由集子集且端点交集 ≥2(单端点 + 子集会把 CourseResource 认成 /user/resource)。
      const exact = setEq(st, rTokens) || setEq(st, tailTokens)
      // 子集档只收多词屏名:单词屏名(point⊂point/sign/in)会把「签到页」认成「积分屏」,
      // 而共享屏只渲染了今日签到卡、不承载签到历史 —— 这种半覆盖不能记成 aligned。
      const subStrong = st.length >= 2 && subset(st, rTokens) && n >= 2
      if (!exact && !subStrong) continue
      const score = jac + (exact ? 0.5 : 0)
      if (!best || score > best.score) {
        best = { score, shared: s.spec, nameHit: st.filter((t) => rTokens.includes(t)), jac, n, commonEps: common(eps, sep) }
      }
    }
    if (best) webCandidates.push({ web: route, ...best })
  }
}

// ---------- ② RN → 小程序 ----------
const mirrored = new Set()
for (const p of mp) for (const s of cov.mirroredSpecs(p)) mirrored.add(s)
const registry = JSON.parse(readFileSync(R(REGISTRY_PATH), 'utf8'))
const existingPairs = new Set(registry.entries.map((e) => `${e.shared}::${e.miniapp}`))
const miniappCandidates = []
if (!only || only === 'miniapp') {
  const gaps = shared.filter((s) => !mirrored.has(s.spec))
  for (const g of gaps) {
    const owners = symbolOwners.get(g.name) || []
    if (owners.length === 0 || !isExported(g.name)) continue
    const sk = keysOf(cov.faceRead(FACE, g.spec))
    for (const f of owners) for (const k of keysOf(cov.faceRead(FACE, f) || '')) sk.add(k)
    const sns = new Set([...sk].map(nsOf).filter((n) => !GENERIC_NS.has(n)))
    const sep = new Set()
    for (const f of owners) for (const e of endpointsOf(cov.faceRead(FACE, f) || '')) sep.add(e)
    // 名称同源(宁漏不误):共享屏 domain/屏名 token 必须在小程序路由段里出现;
    // 否则 `console-table` 会因通用端点/键命中被登记到任意 edu 管理页。
    const gTokens = [...parity.screenTokens(g.name), ...parity.routeTokens(g.domain)].map(stem)
    const cands = []
    for (const p of mp) {
      if (!p.file || !p.text) continue
      if (cov.mirroredSpecs(p).size > 0) continue
      if (existingPairs.has(`${g.spec}::${p.route}`)) continue
      const pTokens = p.route
        .split(/[/-]/)
        .filter((t) => t && !['pkg', 'pages', 'index', 'app'].includes(t))
        .map(stem)
      if (!gTokens.some((t) => pTokens.includes(t))) continue
      const pk = keysOf(p.text)
      const pns = new Set([...pk].map(nsOf).filter((n) => !GENERIC_NS.has(n)))
      const nsHit = [...sns].filter((n) => pns.has(n))
      const keyCommon = common(sk, pk).filter((k) => !GENERIC_NS.has(nsOf(k)))
      const pep = endpointsOf(p.text)
      const epJac = jaccard(sep, pep)
      const epCommon = common(sep, pep)
      const keyStrong = nsHit.length > 0 && keyCommon.length >= 2
      const epStrong = epCommon.length >= 1 && epJac >= 0.4
      if (!keyStrong && !epStrong) continue
      cands.push({
        miniapp: p.route,
        file: p.file,
        keyStrong,
        epStrong,
        nsHit,
        keyCommon: keyCommon.slice(0, 6),
        keyCommonN: keyCommon.length,
        epJac: Number(epJac.toFixed(2)),
        epCommon: epCommon.slice(0, 4),
        score: keyCommon.length * 2 + epCommon.length * 3 + epJac,
      })
    }
    cands.sort((a, b) => b.score - a.score)
    if (cands.length === 0) continue
    miniappCandidates.push({
      shared: g.spec,
      rn: owners[0],
      domain: g.domain,
      name: g.name,
      cand: cands[0],
      alternatives: cands.slice(1, 3).map((c) => c.miniapp),
    })
  }
}

// ---------- 落地 ----------
function insertMarker(rel, spec) {
  const text = readFileSync(R(rel), 'utf8')
  if (text.includes(spec)) return false
  const lines = text.split('\n')
  let at = 0
  while (at < lines.length && (lines[at].startsWith('//') || lines[at].startsWith('#!'))) at++
  lines.splice(at, 0, `// 镜像 ${spec}`)
  writeFileSync(R(rel), lines.join('\n'))
  return true
}

function appendMapRows(rows) {
  if (rows.length === 0) return 0
  // 以 HEAD 面为底,并与工作树现有行做并集 —— 工作树常因旁路落地而落后 HEAD(实测少行),
  // 直接 append 到工作树会把 HEAD 已有行写丢。
  const parse = (text) =>
    (text || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          const o = JSON.parse(l)
          return { key: `${o.web}::${o.status}::${o.rn || ''}`, raw: JSON.stringify(o) }
        } catch {
          return null
        }
      })
      .filter(Boolean)
  const headRows = parse(cov.faceRead('head', MAP_PATH))
  const workRows = parse(readFileSync(R(MAP_PATH), 'utf8'))
  const seen = new Set(headRows.map((r) => r.key))
  const merged = [...headRows.map((r) => r.raw)]
  for (const r of workRows) if (!seen.has(r.key)) { seen.add(r.key); merged.push(r.raw) }
  for (const r of rows) {
    const key = `${r.web}::${r.status}::${r.rn || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(JSON.stringify(r))
  }
  writeFileSync(R(MAP_PATH), merged.join('\n') + '\n')
  return merged.length - headRows.length
}

function appendRegistry(entries) {
  if (entries.length === 0) return 0
  // 同上:HEAD 为底 + 工作树独有条目 + 本批新条目,按 shared::miniapp 去重。
  const parse = (text) => {
    try {
      const o = JSON.parse(text || '')
      return Array.isArray(o.entries) ? o : null
    } catch {
      return null
    }
  }
  const head = parse(cov.faceRead('head', REGISTRY_PATH))
  const work = parse(readFileSync(R(REGISTRY_PATH), 'utf8'))
  if (!head) throw new Error('取不到 HEAD 面 registry,拒绝落地(§0.3 未判定)')
  const seen = new Set()
  const merged = []
  for (const e of [...head.entries, ...(work?.entries || [])]) {
    const k = `${e.shared}::${e.miniapp}`
    if (seen.has(k)) continue
    seen.add(k)
    merged.push({ shared: e.shared, rn: e.rn, miniapp: e.miniapp })
  }
  let added = 0
  for (const e of entries) {
    const k = `${e.shared}::${e.miniapp}`
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(e)
    added++
  }
  const out = { ...head, entries: merged }
  writeFileSync(R(REGISTRY_PATH), JSON.stringify(out, null, 2) + '\n')
  return added
}

const summary = {
  face: FACE,
  webRn: webCandidates.map((c) => ({
    web: c.web,
    rn: c.shared,
    jac: Number(c.jac.toFixed(2)),
    commonEps: c.n,
    nameHit: c.nameHit,
    sample: c.commonEps.slice(0, 3),
  })),
  miniapp: miniappCandidates.map((c) => ({
    shared: c.shared,
    rn: c.rn,
    miniapp: c.cand.miniapp,
    file: c.cand.file,
    keyStrong: c.cand.keyStrong,
    epStrong: c.cand.epStrong,
    keyCommonN: c.cand.keyCommonN,
    nsHit: c.cand.nsHit,
    epCommon: c.cand.epCommon,
    epJac: c.cand.epJac,
    alternatives: c.alternatives,
  })),
}

if (applyMode) {
  const mapRowsToAdd = summary.webRn.map((c) => ({
    web: c.web,
    rn: c.rn,
    status: 'aligned',
    note: `自动登记@${TODAY}: 端点交集 ${c.commonEps} 条(${(c.sample || []).join(', ')}) + 名称 token ${c.nameHit.join('+')}`,
    at: TODAY,
  }))
  const regEntries = []
  const marked = []
  for (const c of miniappCandidates) {
    const ev = []
    if (c.cand.keyStrong)
      ev.push(`i18n 命名空间 ${c.cand.nsHit.join('/')} 专有键 ${c.cand.keyCommonN} 条重合`)
    if (c.cand.epStrong)
      ev.push(`端点交集 ${c.cand.epCommon.join(',')} (jac ${c.cand.epJac})`)
    if (insertMarker(c.cand.file, c.shared)) marked.push(c.cand.file)
    regEntries.push({ shared: c.shared, rn: c.rn, miniapp: c.cand.miniapp, evidence: ev.join(' ; ') })
  }
  const addedMap = appendMapRows(mapRowsToAdd)
  const addedReg = appendRegistry(regEntries.map(({ shared, rn, miniapp }) => ({ shared, rn, miniapp })))
  summary.applied = { mapRows: addedMap, markers: marked.length, registry: addedReg }
}

if (jsonMode) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  console.log(`取材面 ${FACE} | web 路由 ${routes.length} / 共享屏 ${shared.length} / 小程序页 ${mp.length}`)
  console.log(`\n① web→RN 可自动登记 ${summary.webRn.length} 条:`)
  for (const c of summary.webRn)
    console.log(`  ${c.web}  →  ${c.rn}  (端点 ${c.commonEps} 条, jac ${c.jac}; 名称 ${c.nameHit.join('+')})`)
  console.log(`\n② RN→小程序 可自动声明 ${summary.miniapp.length} 条:`)
  for (const c of summary.miniapp) {
    const why = []
    if (c.keyStrong) why.push(`键 ${c.keyCommonN}(${c.nsHit.join('/')})`)
    if (c.epStrong) why.push(`端点 ${c.epCommon.join(',')}`)
    console.log(`  ${c.shared}  →  ${c.miniapp}  [${why.join(' | ')}]`)
  }
  if (applyMode) {
    console.log(
      `\n✅ 已写盘:map +${summary.applied.mapRows} / 标记 +${summary.applied.markers} / registry +${summary.applied.registry}`,
    )
  } else {
    console.log('\n(预演模式,未写盘;加 --apply 落地)')
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
