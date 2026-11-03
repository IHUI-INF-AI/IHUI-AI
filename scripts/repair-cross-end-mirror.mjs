#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出预演/落地结论 */

// 跨端镜像「台账 → 代码」对账修复器(默认只读预演,`--apply` 才写盘)。
//
// 治的是哪一族病:登记表 scripts/data/cross-end-screen-registry.json 说"共享屏 X 已被小程序页
// Y 镜像",但代码侧**标记行没了**或**路由没了** ⇒ 门 128 R1 当场判红(9 处)。
// 2026-10-25 实测的成因:一笔并发会话的批量提交(9fdbc207ba2e)在别的文件上顺手带走了 5 处
// 标记行 + 1 条 app.config 路由行 —— 登记表那一侧没动,代码那一侧被削了。
// 于是"声明链"从中间断开:台账说有、尺子读不到 ⇒ 门红,而**没有任何器物负责把它接回去**。
// 本器物就是那个接缝:读台账 ⇒ 逐条核三件事(路由在册 / 页面文件在 / 标记在)⇒ 缺哪补哪。
//
// 为什么不让登记器顺手修:登记器(auto-register-cross-end.mjs)是"**新增**声明"的入口,
// 它的候选集来自启发式或子代理提案;而"台账已有、代码掉了"是**回归**,两者的判定权与
// 失败方向不同。混在一起 ⇒ 回归会被当成"没登记过"而重新登记一次(掩盖了谁削掉的)。
// 回归要有自己的器物,才能留痕"这是回归、不是新增"。
//
// 判据零复算(§0.6):镜像标记识别、共享屏/RN/小程序页枚举 import 门 128 的 __test__;
// 标记行形态与插入点 import scripts/lib/cross-end-mirror-write.mjs;
// app.config 接缝(路由插行)import scripts/gen-miniapp-mirror.mjs 的 insertConfigPage。
//
// 取材面(§0.4):默认 HEAD blob;--worktree 仅人工逃生舱;取不到面 ⇒ exit 2「未判定」。
// 写盘纪律:底稿取 HEAD blob;**工作树副本有行不在 HEAD ⇒ 拒**(那是他席在飞,替人提交就是串席)。
//
// 退出码:0 = 无需修 / 已修完;1 = 判定成立但未修完(预演模式,或有条目被拒);2 = 未判定。
//
// Usage:
//   node scripts/repair-cross-end-mirror.mjs                 # 预演(打印将修的条目)
//   node scripts/repair-cross-end-mirror.mjs --apply         # 写盘(工作树,提交走仓规)
//   node scripts/repair-cross-end-mirror.mjs --json          # 机器可读
//   node scripts/repair-cross-end-mirror.mjs --self-test     # 判据自测
//   node scripts/repair-cross-end-mirror.mjs --register-landing --root=<dir> --paths=a,b   # 账本申报(测试/应急,不跑主流程)
//   node scripts/repair-cross-end-mirror.mjs --landing-skips  --root=<dir> --paths=a,b     # 已登记待收编查询(同上)

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { hasMirrorMarker, insertMirrorMarker } from './lib/cross-end-mirror-write.mjs'
import { insertConfigPage, parseMiniappRoutes } from './gen-miniapp-mirror.mjs'
// 判定台账(单源 lib):本器物顺带把「已造页但台账仍写缺页」这一族对平(§0.6 路径与口径单源)。
import { readVerdicts, writeVerdictRows, VERDICTS_PATH } from './lib/cross-end-verdicts.mjs'
// 写盘申报账本(2026-11-03 立):落点判据/幂等/形状校验全在库内,本文件只调它(§0.6)。
import { appendLanding, isRowComplete, readLanding } from './lib/cross-end-landing-ledger.mjs'
// 取 oid 与 collectiblePaths 同尺:库内 worktree 面用 gitRaw(['hash-object','--',p], root),
// 这里必须问同一把尺(自拼裸 git 或换 hash-object 参数 = 两侧算法不一致 ⇒ 永远 contested)。
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const R = (...p) => join(ROOT, ...p)
const REGISTRY_PATH = 'scripts/data/cross-end-screen-registry.json'
const MP_CONFIG = 'apps/miniapp-taro/src/app.config.ts'
const MP_SRC = 'apps/miniapp-taro/src'

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const applyMode = argv.includes('--apply')
const selfTestMode = argv.includes('--self-test')
const worktreeMode = argv.includes('--worktree')
const FACE = worktreeMode ? 'worktree' : 'head'
const TODAY = new Date().toISOString().slice(0, 10)

/**
 * 本腿在 git-guardian 的自称名,逐字取用,不自立新名:
 * 守护 healCrossEndMirror 派发体以 crossEndUndetFile('mirror-heal') /
 * settleCrossEndLeg('mirror-heal') 点名,且 'mirror-heal' 在册于 CROSS_END_LEGS。
 * 对照证据由 scripts/tests/cross-end-landing-legs.test.mjs 钉(名字必须逐字出现在守护源里)。
 */
export const CROSS_END_LEG = 'mirror-heal'

// ─── 写盘申报账本层(2026-11-03 立)─────────────────────────────────────────
// 立因:本腿每 30 分钟真写工作树,注释承诺「落库交给 auto-commit-quiet」,但收编侧此前
// 只认白名单不收业务件 ⇒ 写盘件永久悬挂。正解 = 写完盘自己往 cross-end-landing-ledger
// 追写申报行;收编侧只认「账本在册 ∧ 工作树 blob 逐字节等于登记 oid ∧ 超静默期 ∧ 非 ignored」。
// 失效方向:账本读不到 ⇒ 照旧全量尝试 + ledger=unjudged(多要一次,不少做一次,§0.3)。
/** 与 collectiblePaths(worktree 面)同一把尺取当前 blob oid;取不到 ⇒ null(点名不猜)。 */
export function worktreeBlobOid(rel, root = ROOT) {
  try {
    return String(gitRaw(['hash-object', '--', rel], root)).trim().toLowerCase()
  } catch {
    return null
  }
}

/** 本 leg 在册且行完整的 path→oid 映射;账本取不到 ⇒ {ok:false, reason}(不冒充空集)。 */
export function landedOidMap({ root = ROOT, leg = CROSS_END_LEG } = {}) {
  const rd = readLanding({ root })
  if (!rd.ok) return { ok: false, reason: rd.reason, map: new Map() }
  const map = new Map()
  for (const row of rd.lines) {
    if (String(row?.leg ?? '') !== leg || !isRowComplete(row)) continue
    map.set(String(row.path), String(row.blobOid).trim().toLowerCase())
  }
  return { ok: true, reason: null, map }
}

/** 「本 leg 已登记 ∧ 工作树 blob 仍等于登记 oid」的路径 ⇒ 本轮视为已完成。 */
export function landedSkips(paths, { root = ROOT, leg = CROSS_END_LEG } = {}) {
  const rd = landedOidMap({ root, leg })
  if (!rd.ok) return { skip: [], ledger: 'unjudged', reason: rd.reason }
  const skip = []
  for (const p of paths || []) {
    const oid = rd.map.get(p)
    if (oid && worktreeBlobOid(p, root) === oid) skip.push(p)
  }
  return { skip, ledger: null, reason: null }
}

/** 批末申报:逐路径实测 oid → appendLanding。写了盘没登记上 ⇒ landingError 点名,不冒成功。 */
export function registerLandings(paths, { root = ROOT, leg = CROSS_END_LEG, at = new Date().toISOString() } = {}) {
  const list = [...new Set(paths || [])]
  if (list.length === 0) return { landing: 0, appended: 0, deduped: 0, rejected: [] }
  const entries = []
  const unhashable = []
  for (const p of list) {
    const oid = worktreeBlobOid(p, root)
    if (!oid) {
      unhashable.push(p)
      continue
    }
    entries.push({ at, leg, path: p, blobOid: oid })
  }
  try {
    const ap = appendLanding(entries, { root })
    const out = {
      landing: ap.appended + ap.deduped,
      appended: ap.appended,
      deduped: ap.deduped,
      rejected: ap.rejected,
    }
    const errs = []
    if (ap.rejected.length)
      errs.push(`账本拒收:${ap.rejected.map((r) => `${r.path}(${r.reason})`).join(' ')}`)
    if (unhashable.length) errs.push(`落点 blob 取不到:${unhashable.join(' ')}`)
    if (errs.length) out.landingError = errs.join(' | ')
    return out
  } catch (e) {
    return {
      landing: 0,
      appended: 0,
      deduped: 0,
      rejected: [],
      landingError: `账本写盘失败:${String(e?.message ?? e).split('\n')[0]}`,
    }
  }
}

/** 读工作树副本;取不到 = null(该面没有这份件)。 */
function safeRead(rel) {
  try {
    return readFileSync(R(rel), 'utf8')
  } catch {
    return null
  }
}

/** 工作树副本里有几行不在 HEAD(他席在飞 ⇒ 本次不动这个文件)。 */
function divergingLines(headText, workText) {
  if (workText === null) return 0
  const headLines = new Set((headText || '').split('\n'))
  return workText.split('\n').filter((l) => l.trim() !== '' && !headLines.has(l)).length
}

/**
 * 找出这条路由该落在哪个分包 root 下。
 * app.config 的分包 root 形如 'pkg-about' 与 'pages/member' **并存**(主包页被迁进同路径 root
 * 的子包,URL 逐字不变),所以不能按首段猜 —— 取**最长匹配**的 root,再把余下段当 page。
 */
function locateRoot(blocks, route) {
  let best = null
  for (const m of blocks) {
    const root = m[1]
    if (!route.startsWith(`${root}/`)) continue
    if (!best || root.length > best.root.length) best = { root, page: route.slice(root.length + 1) }
  }
  return best
}

/** 主包 pages 数组的闭合方括号位置;找不到 = null。 */
function mainPackageCloseIndex(text) {
  const headStart = text.indexOf('pages: [')
  const subStart = text.indexOf('subPackages')
  if (headStart < 0 || subStart < 0 || subStart < headStart) return null
  const seg = text.slice(headStart, subStart)
  const rel = seg.indexOf(']')
  return rel < 0 ? null : headStart + rel
}

/** 往主包 pages 数组末尾插一行(缩进 = 闭括号行缩进 + 2,与分包同形)。 */
function insertMainPackagePage(text, page) {
  const close = mainPackageCloseIndex(text)
  if (close === null) return { ok: false, why: 'app.config.ts 主包 pages 数组形态异常(找不到 pages: [ 或 subPackages)' }
  let lineStart = close
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--
  const gap = text.slice(lineStart, close)
  if (gap.trim() !== '') return { ok: false, why: '主包 pages 数组闭括号行形态异常(同行有别的内容)' }
  const indent = `${gap}  `
  const inserted = `${indent}'${page}',\n`
  return { ok: true, text: text.slice(0, lineStart) + inserted + text.slice(lineStart), insertedLine: `${indent}'${page}',` }
}

function selfTest() {
  const cases = []
  const spec = 'packages/app/src/features/coupon/CouponScreen.tsx'
  // T1 幂等:已有该标记 ⇒ 不重复插
  const already = `// banner\n// 镜像 ${spec}\n\nimport x from 'y'\n`
  cases.push(['T1 已有标记不重复插', insertMirrorMarker(already, spec).done === false])
  // T2 横幅后插标记
  const fresh = `// banner\n// banner2\n\nimport x from 'y'\n`
  const ins = insertMirrorMarker(fresh, spec)
  cases.push(['T2 标记插在空行之后', ins.done && ins.text.split('\n')[3] === `// 镜像 ${spec}`])
  // T3 不覆盖别席声明
  const other = `// 镜像 packages/app/src/features/help/HelpScreen.tsx\n`
  cases.push(['T3 别屏声明不被覆盖', insertMirrorMarker(other, spec).done === false])
  // T4 非法 spec 拒
  cases.push(['T4 非法 spec 拒收', insertMirrorMarker(fresh, 'not/a/spec').done === false])
  // T5 路由定位:最长 root 优先(pages/member 胜过 pages)
  const cfg = `pages: [\n  'pages/index/index',\n],\nsubPackages: [\n  {\n    root: 'pages',\n    pages: [\n      'x/index',\n    ]\n  },\n  {\n    root: 'pages/member',\n    pages: [\n      'coupon',\n    ]\n  },\n]`
  const { blocks } = parseMiniappRoutes(cfg)
  const loc = locateRoot(blocks, 'pages/member/coupon')
  cases.push(['T5 最长 root 优先', loc && loc.root === 'pages/member' && loc.page === 'coupon'])
  // T6 分包路由插行
  const r = insertConfigPage(cfg, 'pages/member', 'integral')
  cases.push(['T6 分包路由插行成功', r.ok && r.text.includes("'integral',")])
  // T7 主包路由插行
  const m = insertMainPackagePage(cfg, 'pages/index/index2')
  cases.push(['T7 主包路由插行成功', m.ok && m.text.includes("'pages/index/index2',")])
  let failed = 0
  for (const [name, ok] of cases) {
    if (!ok) failed++
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n自测 ${cases.length - failed}/${cases.length} 通过`)
  return failed === 0 ? 0 : 1
}

if (selfTestMode) process.exit(selfTest())

// 账本层的机器读出口(2026-11-03 立,排在一切重活之前):本文件是顶层流程型 CLI,
// import 它 = 跑整条对账链,所以镜像测试用这两个子进程档直调生产登记/跳过判据。
// 不执行主流程、不改任何仓内文件;--root 仅为夹具(临时 git 仓)开放,生产调用不带它。
if (argv.includes('--register-landing') || argv.includes('--landing-skips')) {
  const rootArg = argv.find((a) => a.startsWith('--root='))
  const root = rootArg ? rootArg.slice('--root='.length) : ROOT
  const paths = (argv.find((a) => a.startsWith('--paths=')) ?? '')
    .slice('--paths='.length)
    .split(',')
    .filter(Boolean)
  const out = argv.includes('--register-landing')
    ? registerLandings(paths, { root })
    : landedSkips(paths, { root })
  console.log(JSON.stringify(out))
  process.exit(out.landingError ? 1 : 0)
}

// ---------- 读面 ----------
const regText = cov.faceRead(FACE, REGISTRY_PATH)
if (regText === null) {
  console.error(`❌ 未判定:取不到被审面的 ${REGISTRY_PATH}(FACE=${FACE})`)
  process.exit(2)
}
let registry
try {
  registry = JSON.parse(regText)
} catch (e) {
  console.error(`❌ 未判定:${REGISTRY_PATH} 解析失败:${e.message}`)
  process.exit(2)
}
const entries = Array.isArray(registry.entries) ? registry.entries : []

const shared = cov.collectShared(FACE)
const rn = cov.collectRn(FACE)
const mp = cov.collectMiniapp(FACE)
if (shared.length === 0 || mp.length === 0) {
  console.error(`❌ 未判定:取不到被审面(共享屏 ${shared.length} / 小程序页 ${mp.length})`)
  process.exit(2)
}
const mpByRoute = new Map(mp.map((p) => [p.route, p]))
const sharedSpecs = new Set(shared.map((s) => s.spec))
const rnFiles = new Set(rn.map((r) => r.file))

// 「已镜像」的集合(门 128 同一把尺子)—— 判定台账的 missing→generated 改档靠它。
const mirroredSpecs = new Set()
for (const p of mp) for (const s of cov.mirroredSpecs(p)) mirroredSpecs.add(s)

const cfgText = cov.faceRead(FACE, MP_CONFIG)
if (cfgText === null) {
  console.error(`❌ 未判定:取不到被审面的 ${MP_CONFIG}`)
  process.exit(2)
}
const { blocks } = parseMiniappRoutes(cfgText)

/** 小程序页文件候选(与门 128 的 collectMiniapp 同形)。 */
function pageFileFor(route) {
  const cands = [`${MP_SRC}/${route}.tsx`, `${MP_SRC}/${route}/index.tsx`, `${MP_SRC}/${route}/index.jsx`]
  for (const c of cands) if (existsSync(R(c))) return c
  return null
}

// ---------- 逐条核 ----------
const findings = []
for (const e of entries) {
  const sharedSpec = e.shared
  const route = e.miniapp
  if (!sharedSpec || !route) {
    findings.push({ kind: 'malformed-entry', shared: sharedSpec, route, why: '登记项缺 shared 或 miniapp 键' })
    continue
  }
  if (!sharedSpecs.has(sharedSpec)) {
    findings.push({ kind: 'shared-missing', shared: sharedSpec, route, why: '登记项指向的共享屏在 HEAD 不存在(登记腐烂,需人工裁行)' })
    continue
  }
  if (e.rn && !rnFiles.has(e.rn)) {
    findings.push({ kind: 'rn-missing', shared: sharedSpec, route, rn: e.rn, why: '登记项指向的 RN 壳在 HEAD 不存在(登记腐烂,需人工裁行)' })
    continue
  }
  const mpEntry = mpByRoute.get(route)
  const file = mpEntry && mpEntry.file ? mpEntry.file : pageFileFor(route)
  if (!file) {
    findings.push({
      kind: 'page-missing',
      shared: sharedSpec,
      route,
      why: '小程序页文件不在(造页是 gen-miniapp-mirror.mjs 的射程,本器物不造页)',
    })
    continue
  }
  if (mpEntry && cov.mirroredSpecs(mpEntry).has(sharedSpec)) continue // 已完整

  const pageHead = cov.faceRead(FACE, file)
  if (pageHead === null) {
    findings.push({ kind: 'page-unreadable', shared: sharedSpec, route, file, why: 'HEAD 面取不到该页' })
    continue
  }
  // 该页已被**别**屏声明 ⇒ 不覆盖
  if (hasMirrorMarker(pageHead)) {
    findings.push({
      kind: 'other-mirror',
      shared: sharedSpec,
      route,
      file,
      why: '该页已声明别的共享屏,不覆盖别席处置权',
    })
    continue
  }
  if (!mpEntry) {
    // 文件在,但路由不在 app.config ⇒ 补路由行
    const loc = locateRoot(blocks, route)
    if (!loc) {
      findings.push({
        kind: 'root-unknown',
        shared: sharedSpec,
        route,
        file,
        why: 'app.config 里找不到能承载该路由的分包 root(未判定,需人工指定归属)',
      })
      continue
    }
    findings.push({ kind: 'route-missing', shared: sharedSpec, route, file, root: loc.root, page: loc.page })
    continue
  }
  findings.push({ kind: 'marker-missing', shared: sharedSpec, route, file })
}

// ---------- 台账改档:missing → generated ----------
// 为什么归本器物管:它是**台账 → 代码**的对账器,而这一族正是"台账说该造页、代码里页已经在了"
// (页被生成器造出、但台账没跟上)。不在这儿改,就没人改 —— 台账会一直说"缺页",
// 缺口账本会把已造页继续列成待造(重复派单),而且**覆盖率会替功能缺口背书**。
// 判据:该屏在当前面已被小程序页显式镜像(门 128 同一把尺子 cov.mirroredSpecs)。
const ledgerRows = readVerdicts(FACE, ROOT)
const verdictPatches = []
for (const row of ledgerRows.rows) {
  if (row.verdict !== 'missing') continue
  if (!mirroredSpecs.has(row.shared)) continue
  verdictPatches.push({
    shared: row.shared,
    verdict: 'generated',
    evidence: `已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补`,
    at: TODAY,
    source: 'repair-cross-end-mirror',
  })
}

// ---------- 落地 ----------
const applied = []
const refused = []
// 本腿自己上一轮登记在账、工作树 blob 至今未动的路径 ⇒ 本轮视为已完成(既不重写,
// 也不冒充「他席在飞」拒落 —— 那其实是本腿自己的产出在等收编)。
const landedRead = landedOidMap()
const stillLanded = (rel) => {
  const oid = landedRead.map.get(rel)
  return Boolean(oid) && worktreeBlobOid(rel) === oid
}
const writtenPaths = new Set()
const skipLanded = []
let landingInfo = { landing: 0 }
if (applyMode) {
  // app.config 的修复先做(多条目可能共用同一个 app.config,只写一次)
  const routeFixes = findings.filter((f) => f.kind === 'route-missing')
  if (routeFixes.length > 0) {
    const cfgWork = safeRead(MP_CONFIG)
    const diverged = divergingLines(cfgText, cfgWork) > 0
    const ownPending = diverged && stillLanded(MP_CONFIG)
    if (diverged && !ownPending) {
      for (const f of routeFixes)
        refused.push({ ...f, why: `工作树 ${MP_CONFIG} 有行不在 HEAD(他席在飞),不替人提交` })
    } else {
      let cur = cfgText
      let ok = true
      const fixed = []
      for (const f of routeFixes) {
        const isMain = f.root === 'pages' || !blocks.some((b) => b[1] === f.root)
        const r = isMain ? insertMainPackagePage(cur, f.page) : insertConfigPage(cur, f.root, f.page)
        if (!r.ok) {
          refused.push({ ...f, why: `路由插行失败:${r.why}` })
          ok = false
          continue
        }
        cur = r.text
        fixed.push({ ...f, how: `app.config 插路由行 ${r.insertedLine}` })
      }
      if (ownPending && ok && cur === cfgWork) {
        // 待收编副本与本批判定的目标正文逐字节相同 ⇒ 本轮无需重写,报 skipLanded
        for (const f of routeFixes)
          skipLanded.push({ ...f, why: `${MP_CONFIG} 是本腿已登记待收编的产出(工作树 blob 未动)⇒ 本轮跳过` })
      } else {
        for (const a of fixed) applied.push(a)
        if (ok && cur !== cfgText) {
          writeFileSync(R(MP_CONFIG), cur)
          writtenPaths.add(MP_CONFIG)
        }
      }
    }
  }
  for (const f of findings.filter((x) => x.kind === 'marker-missing')) {
    const pageHead = cov.faceRead(FACE, f.file)
    if (pageHead === null) {
      refused.push({ ...f, why: 'HEAD 面取不到该页' })
      continue
    }
    const work = safeRead(f.file)
    const ownPending = divergingLines(pageHead, work) > 0 && stillLanded(f.file)
    if (divergingLines(pageHead, work) > 0 && !ownPending) {
      refused.push({ ...f, why: `工作树副本有行不在 HEAD(他席在飞),不替人提交` })
      continue
    }
    const r = insertMirrorMarker(pageHead, f.shared)
    if (!r.done) {
      refused.push({ ...f, why: r.why })
      continue
    }
    if (ownPending && r.text === work) {
      skipLanded.push({ ...f, why: `${f.file} 是本腿已登记待收编的产出(工作树 blob 未动)⇒ 本轮跳过` })
      continue
    }
    writeFileSync(R(f.file), r.text)
    writtenPaths.add(f.file)
    applied.push({ ...f, how: `插入标记行 ${r.line}` })
  }
  // 台账改档(missing → generated):判据=该屏在当前面已被小程序页显式镜像。
  // 写盘归单源 lib writeVerdictRows(§0.6);写不进去不冒充成功(结论行点名)。
  if (verdictPatches.length > 0) {
    try {
      const wr = writeVerdictRows(ROOT, verdictPatches)
      writtenPaths.add(VERDICTS_PATH)
      applied.push({ kind: 'verdict-patch', shared: `${verdictPatches.length} 条台账行`, how: `missing → generated(台账改档,total=${wr.total},added=${wr.added})` })
    } catch (e) {
      refused.push({ kind: 'verdict-patch', shared: `${verdictPatches.length} 条台账行`, why: `台账写盘失败:${e && e.message ? e.message : e}` })
    }
  }
  // 批末申报:写了盘的文件逐枚实测 oid 进账本(落库交给「账本在册 ∧ blob 相符 ∧ 超静默期」的收编侧)。
  if (writtenPaths.size > 0) landingInfo = registerLandings([...writtenPaths])
}

const summary = {
  face: FACE,
  registryEntries: entries.length,
  findings: findings.length,
  byKind: findings.reduce((acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] || 0) + 1 }), {}),
  applied: applied.length,
  refused: refused.length,
  verdictPatches: verdictPatches.length,
  landing: landingInfo.landing,
  skipLanded: skipLanded.length,
}
if (landingInfo.landingError) summary.landingError = landingInfo.landingError
if (!landedRead.ok) summary.ledger = 'unjudged'
if (jsonMode) {
  console.log(JSON.stringify({ summary, findings, applied, refused, skipLanded }, null, 1))
  process.exit(refused.length > 0 || landingInfo.landingError ? 1 : 0)
}

console.log(`\n台账→代码 对账(判定面 ${FACE === 'head' ? 'HEAD blob' : '工作树(人工)'})`)
console.log(`登记表条目 ${summary.registryEntries} / 需处理 ${summary.findings} / 台账改档候选 ${summary.verdictPatches}`)
for (const [k, v] of Object.entries(summary.byKind)) console.log(`  ${k}: ${v}`)
if (findings.length === 0) console.log('\n✅ 台账与代码完全对齐,无需修复')
else {
  for (const f of findings) console.log(`  [${f.kind}] ${f.shared} → ${f.route}  ${f.why || ''}`)
}
if (applyMode) {
  console.log(`\n✅ 已落地 ${applied.length} 条 / 拒落 ${refused.length} 条 landing=${landingInfo.landing} skipLanded=${skipLanded.length}${landingInfo.landingError ? ` landingError=${landingInfo.landingError}` : ''}${landedRead.ok ? '' : ' ledger=unjudged'}`)
  for (const a of applied) console.log(`  [落] ${a.shared} → ${a.route}  ${a.how}`)
  for (const r of refused) console.log(`  [拒] ${r.shared} → ${r.route}  ${r.why}`)
  for (const s of skipLanded) console.log(`  [挂账] ${s.shared} → ${s.route}  ${s.why}`)
  console.log('\n(写盘件落库 = 账本在册且 blob 相符后由收编侧处理;本器物只写工作树+申报)')
} else {
  console.log('\n(预演模式,未写盘,账本零登记;加 --apply 落地)')
}
process.exit(refused.length > 0 || landingInfo.landingError ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
