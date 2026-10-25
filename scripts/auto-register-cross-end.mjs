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
//   node scripts/auto-register-cross-end.mjs --proposals=<文件或目录> [--apply]
//     读子代理判定件(数组,元素含 shared/rn/miniapp/verdict/evidence/confidence 或 web/verdict/note|reason),
//     过结构校验闸后才落地;declare 之外档(missing/not-applicable)不写代码,只在 --record-verdicts 时进判定台账。
//   node scripts/auto-register-cross-end.mjs --proposals=<目录> --apply --record-verdicts
//     ⇒ 一并把"这一格已验过"的结论写进 scripts/data/miniapp-mirror-verdicts.jsonl(缺口账本生成器消费它)。
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as parity } from './check-web-rn-screen-parity.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
// 判定台账的路径与读写口径归单源 lib(§0.6):本文件只调它,不自己写一遍路径/解析。
import { VERDICTS_PATH, mergeVerdictRows, readVerdicts, serializeVerdicts } from './lib/cross-end-verdicts.mjs'
// 镜像标记的形态与插入点归单源 lib(§0.6):本文件不自己拼这行字。
import { hasMirrorMarker, insertMirrorMarker } from './lib/cross-end-mirror-write.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const R = (...p) => join(ROOT, ...p)
const MAP_PATH = 'scripts/data/web-rn-screen-map.jsonl'
const REGISTRY_PATH = 'scripts/data/cross-end-screen-registry.json'
const INDEX_PATH = 'packages/app/src/index.ts'
// 判定台账(缺口账本的可持久侧车):键 = 共享屏 spec,一行一屏。
// 路径与读写口径的单源在 scripts/lib/cross-end-verdicts.mjs(§0.6),此处不再复制。

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const applyMode = argv.includes('--apply')
const worktreeMode = argv.includes('--worktree')
const onlyArg = argv.find((a) => a.startsWith('--only='))
const recordVerdicts = argv.includes('--record-verdicts')
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

function safeRead(rel) {
  try {
    return readFileSync(R(rel), 'utf8')
  } catch {
    return null
  }
}

// ---------- ③ 子代理提案通道(判定权在证据,校验与写盘在中心) ----------
// `--proposals=<文件或目录>`:读子代理产出的判定 JSON,逐条过结构校验闸,合格才落地。
// 小程序档 verdict=declare 需 6 条同时成立:shared 在 HEAD 存在 ∧ 符号在 packages/app/src/index.ts 有导出
//   ∧ rn 壳在 HEAD 存在且 import 了该符号 ∧ miniapp 路由在 app.config 在册且有页面文件
//   ∧ 该页(HEAD 面与工作树面)都不含任何镜像标记 ∧ 该配对不在 registry(HEAD∪工作树)。
// 不合格逐条点名拒收原因(§0.3 取不到/不成立不冒充通过);confidence≠high 的 declare 一律拒。
const proposalsArg = argv.find((a) => a.startsWith('--proposals='))
const proposals = { miniapp: [], web: [], refused: [], filesRead: [], verdicts: [] }
if (proposalsArg) {
  const target = resolve(ROOT, proposalsArg.slice('--proposals='.length))
  const files = existsSync(target) && statSync(target).isDirectory()
    ? readdirSync(target).filter((f) => f.endsWith('.json')).map((f) => join(target, f))
    : [target]
  const headMirrored = new Set()
  for (const p of mp) for (const s of cov.mirroredSpecs(p)) headMirrored.add(s)
  const regPairs = new Set(registry.entries.map((e) => `${e.shared}::${e.miniapp}`))
  const mpByRoute = new Map(mp.filter((p) => p.file).map((p) => [p.route, p]))
  const sharedBySpec = new Map(shared.map((s) => [s.spec, s]))
  const rnByRel = new Map(rn.map((r) => [r.file, r]))
  const webRouteSet = new Set(routes.map((r) => r.route))
  const registeredExcluded = new Set(mapRows.filter((r) => r.status === 'excluded').map((r) => r.web))

  for (const f of files) {
    let list
    try {
      list = JSON.parse(readFileSync(f, 'utf8'))
    } catch (e) {
      proposals.refused.push({ file: basename(f), why: `提案文件解析失败: ${e.message}` })
      continue
    }
    if (!Array.isArray(list)) {
      proposals.refused.push({ file: basename(f), why: '提案文件不是数组' })
      continue
    }
    proposals.filesRead.push({ file: basename(f), items: list.length })
    for (const it of list) {
      const ev = String(it.evidence || it.note || it.reason || '')
      const refuse = (why) => proposals.refused.push({ item: it.shared || it.web, why })
      // 判定结论先入账(declare/missing/not-applicable 三档都是"这一格被人验过"的凭据);
      // 不入库的话,子代理跑一遍 127 条取证只活在 gitignored 的临时件里,下轮又从零重判。
      if (it.shared && (it.verdict === 'missing' || it.verdict === 'not-applicable'))
        proposals.verdicts.push({
          shared: it.shared,
          verdict: it.verdict,
          evidence: ev,
          at: it.at || TODAY,
          source: basename(f),
        })
      if (it.shared) {
        // 小程序档
        if (it.verdict !== 'declare') continue // missing / not-applicable 不写盘,由缺口账本继续点名
        const s = sharedBySpec.get(it.shared)
        if (!s) {
          refuse(`shared 不在 HEAD 共享屏集:${String(it.shared)}`)
          continue
        }
        if (it.confidence !== 'high') {
          refuse(`confidence=${String(it.confidence)} ≠ high,拒(证据不足以代判)`)
          continue
        }
        if (ev.trim().length < 10) {
          refuse('evidence 少于 10 字,拒(空口声明不算证据)')
          continue
        }
        if (headMirrored.has(s.spec)) {
          refuse('该共享屏已被某小程序页镜像,不重复声明')
          continue
        }
        if (!isExported(s.name)) {
          refuse(`符号 ${s.name} 未在 packages/app/src/index.ts 导出(R1 必红)`)
          continue
        }
        if (!rnByRel.has(it.rn) || !namedImports(cov.faceRead(FACE, it.rn) || '', '@ihui/rn-app').includes(s.name)) {
          refuse(`rn 腿不成立:${String(it.rn)} 不存在或没 import ${s.name}`)
          continue
        }
        const page = mpByRoute.get(it.miniapp)
        if (!page) {
          refuse(`小程序路由不在 app.config 在册或无页面文件:${String(it.miniapp)}`)
          continue
        }
        if (cov.mirroredSpecs(page).size > 0) {
          refuse(`该页(HEAD 面)已镜像别屏 ${[...cov.mirroredSpecs(page)][0]},不覆盖他席声明`)
          continue
        }
        const workText = safeRead(page.file)
        if (workText && /packages\/app\/src\/features\//.test(workText)) {
          refuse(`该页工作树副本已含镜像标记(他席在飞),本枚不动:${page.file}`)
          continue
        }
        if (regPairs.has(`${s.spec}::${page.route}`)) {
          refuse('registry 已有该配对')
          continue
        }
        proposals.miniapp.push({ shared: s.spec, rn: it.rn, miniapp: page.route, file: page.file, evidence: ev })
      } else if (it.web) {
        // web 档
        if (it.verdict === 'gap') continue
        if (ev.trim().length < 10) {
          refuse('note/reason 少于 10 字,拒')
          continue
        }
        if (it.verdict === 'aligned') {
          if (!webRouteSet.has(it.web)) {
            refuse(`web 键不在路由集:${String(it.web)}`)
            continue
          }
          if (registeredWeb.has(it.web)) {
            refuse('该路由已登记 aligned')
            continue
          }
          const ok = sharedBySpec.has(it.rn) || rnByRel.has(it.rn)
          if (!ok) {
            refuse(`aligned 指向的屏不存在:${String(it.rn)}`)
            continue
          }
          proposals.web.push({ web: it.web, rn: it.rn, status: 'aligned', note: `子代理判定@${TODAY}: ${ev}`, at: TODAY })
        } else if (it.verdict === 'excluded') {
          const seg = String(it.web).endsWith('/**')
          if (!seg && !webRouteSet.has(it.web)) {
            refuse(`web 键不在路由集:${String(it.web)}`)
            continue
          }
          if (registeredExcluded.has(it.web)) {
            refuse('该路由/段已登记 excluded')
            continue
          }
          proposals.web.push({ web: it.web, status: 'excluded', reason: `子代理判定@${TODAY}: ${ev}`, at: TODAY })
        }
      } else {
        refuse('条目既无 shared 也无 web 键')
      }
    }
  }
}

// ---------- 落地 ----------
/**
 * 写「镜像」标记:底稿取 **HEAD blob**,不是工作树副本。
 * 两条实测理由(本仓 2026-10-24/25 反复出现过):
 *  ① 工作树副本常年滞后 HEAD(旁路落地只推进 HEAD)——按工作树写会连带把 HEAD 已有行写回旧态;
 *     以 HEAD 为底重写,顺带把这一格的滞后副本治好。
 *  ② 副本里若有用行不在 HEAD 里 ⇒ 那是**他席在飞新增**,本枚一动就会替人提交;当场拒,留待下轮。
 * 拒收必须带原因点名(§0.10 失效方向是"多要一次定向说明",不是静默放过)。
 */
function insertMarker(rel, spec) {
  const head = cov.faceRead('head', rel)
  if (head === null) return { done: false, why: 'HEAD 面取不到该页' }
  const work = safeRead(rel)
  if (work !== null) {
    if (hasMirrorMarker(work)) return { done: false, why: '工作树副本已含镜像标记(他席声明,不覆盖)' }
    const headLines = new Set(head.split('\n'))
    const extra = work.split('\n').filter((l) => l.trim() !== '' && !headLines.has(l))
    if (extra.length > 0)
      return { done: false, why: `工作树副本有 ${extra.length} 行不在 HEAD(他席在飞),不替人提交` }
  }
  // 标记形态与插入点归单源 lib(§0.6):本仓有三处要写这行,抄三份必然分叉。
  const r = insertMirrorMarker(head, spec)
  if (!r.done) return { done: false, why: r.why }
  writeFileSync(R(rel), r.text)
  return { done: true }
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

/**
 * 判定台账落地:HEAD 面为底 ∪ 工作树独有 ∪ 本批(同屏以本批为准),按 shared 键唯一。
 * 归并与序列化口径归 scripts/lib/cross-end-verdicts.mjs(§0.6 单源)——本函数只决定"落什么"。
 * 取不到某一面就少那一面,不拿另一面顶替(§0.4 取材面纪律:回落另一个面 = 把"没落"读成"是空")。
 */
function writeVerdicts(items) {
  if (items.length === 0) return { total: 0, added: 0, unreadable: 0 }
  const head = readVerdicts('head', ROOT)
  const work = readVerdicts('worktree', ROOT)
  const merged = mergeVerdictRows([...head.rows, ...work.rows], items)
  writeFileSync(R(VERDICTS_PATH), serializeVerdicts(merged.rows) + '\n')
  return { total: merged.total, added: merged.added, unreadable: head.bad.length + work.bad.length }
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
  proposals: {
    files: proposals.filesRead,
    miniapp: proposals.miniapp.map((p) => ({ shared: p.shared, rn: p.rn, miniapp: p.miniapp })),
    web: proposals.web.map((w) => ({ web: w.web, status: w.status, rn: w.rn || null })),
    refused: proposals.refused,
  },
}

if (applyMode) {
  const mapRowsToAdd = summary.webRn.map((c) => ({
    web: c.web,
    rn: c.rn,
    status: 'aligned',
    note: `自动登记@${TODAY}: 端点交集 ${c.commonEps} 条(${(c.sample || []).join(', ')}) + 名称 token ${c.nameHit.join('+')}`,
    at: TODAY,
  }))
  for (const r of proposals.web) mapRowsToAdd.push(r)
  const regEntries = []
  const marked = []
  const skipped = []
  const land = (file, shared, rn, miniapp, evidence) => {
    const r = insertMarker(file, shared)
    if (!r.done) {
      // 标记没写成功就绝不能进 registry —— 门 128 R1 判的就是"登记了却没有标记",
      // 只登记不写标 = 当场造红。
      skipped.push({ shared, miniapp, why: r.why })
      return
    }
    marked.push(file)
    regEntries.push({ shared, rn, miniapp, evidence })
  }
  for (const c of miniappCandidates) {
    const ev = []
    if (c.cand.keyStrong)
      ev.push(`i18n 命名空间 ${c.cand.nsHit.join('/')} 专有键 ${c.cand.keyCommonN} 条重合`)
    if (c.cand.epStrong)
      ev.push(`端点交集 ${c.cand.epCommon.join(',')} (jac ${c.cand.epJac})`)
    land(c.cand.file, c.shared, c.rn, c.cand.miniapp, ev.join(' ; '))
  }
  for (const p of proposals.miniapp)
    land(p.file, p.shared, p.rn, p.miniapp, `子代理判定:${p.evidence}`)
  const addedMap = appendMapRows(mapRowsToAdd)
  const addedReg = appendRegistry(regEntries.map(({ shared, rn, miniapp }) => ({ shared, rn, miniapp })))
  summary.applied = {
    mapRows: addedMap,
    markers: marked.length,
    registry: addedReg,
    skipped,
    verdicts: recordVerdicts ? writeVerdicts(proposals.verdicts) : null,
    fromProposals: { miniapp: proposals.miniapp.length, web: proposals.web.length, refused: proposals.refused.length },
  }
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
  if (proposalsArg) {
    console.log(
      `\n③ 子代理提案 ${proposals.filesRead.reduce((n, f) => n + f.items, 0)} 条(读 ${proposals.filesRead.length} 个文件)→ 合格 小程序 ${summary.proposals.miniapp.length} / web ${summary.proposals.web.length} / 拒收 ${summary.proposals.refused.length}`,
    )
    for (const p of summary.proposals.miniapp) console.log(`  [declare] ${p.shared}  →  ${p.miniapp}`)
    for (const w of summary.proposals.web)
      console.log(`  [${w.status}] ${w.web}${w.rn ? '  →  ' + w.rn : ''}`)
    for (const r of summary.proposals.refused.slice(0, 25))
      console.log(`  [拒] ${r.item || r.file}  ${r.why}`)
    if (summary.proposals.refused.length > 25)
      console.log(`  [拒] …其余 ${summary.proposals.refused.length - 25} 条(不静默省略计数)`)
  }
  if (applyMode) {
    console.log(
      `\n✅ 已写盘:map +${summary.applied.mapRows} / 标记 +${summary.applied.markers} / registry +${summary.applied.registry}`,
    )
    for (const s of summary.applied.skipped || [])
      console.log(`  [未落] ${s.shared} → ${s.miniapp}  原因:${s.why}`)
    if ((summary.applied.skipped || []).length > 0)
      console.log(`  ↑ 这 ${summary.applied.skipped.length} 条只报数不进 registry(登记而无标记=门 128 R1 当场造红)`)
  } else {
    console.log('\n(预演模式,未写盘;加 --apply 落地)')
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
