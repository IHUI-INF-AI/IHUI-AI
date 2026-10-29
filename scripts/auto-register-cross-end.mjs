// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出预演/落地清单 */
// 跨端登记自动器(web→RN 功能映射 / RN→小程序镜像声明)——默认只读预演,`--apply` 才写盘。
//
// 为什么要有这件器物:两条链的判据都已是"登记表说了算",但人工逐条登记追不上屏的增长
// (2026-10-25 现读:web 886 路由 / RN 291 屏 / 共享屏 218 / 小程序页 173,显式镜像仅 84)。
// 本工具只做**已有证据的机械登记**,不做任何 UI 翻译:
//   ① web→RN:`scripts/data/web-rn-screen-map.jsonl` 追加 aligned / excluded / gap 三档行。
//      aligned 的自动证据 = web 页端点与该共享屏 RN 壳端点交集(jac ≥ 0.5 或 common ≥ 2)**且**
//      路由名 token 与屏名 token 同源。单靠端点会把 `console-table` 这种通用屏登记到任意 edu 子页,
//      故名称同源是硬门槛。`gap` 档(子代理判定)只写"判过零承载 + 证据",不写 rn。证据 = web 页端点与
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
import { execFileSync } from 'node:child_process'

import { __test__ as parity } from './check-web-rn-screen-parity.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
// 判定台账的路径与读写口径归单源 lib(§0.6):本文件只调它,不自己写一遍路径/解析/归并。
import { writeVerdictRows } from './lib/cross-end-verdicts.mjs'
// 镜像标记的形态与插入点归单源 lib(§0.6):本文件不自己拼这行字。
import { hasMirrorMarker, insertMirrorMarker } from './lib/cross-end-mirror-write.mjs'
// 剥注释的遮罩实现全仓只许一份(§0.6):形状锁要"数代码里的用量"就问它,不自己写正则剥注释。
import { maskComments } from './lib/code-mask.mjs'

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
// 门户维收敛档(2026-10-27 立):把台账里与 web-portal.ts 互斥的在册判定改写成 portal 行。
// 为什么必须存在:registeredGap/registeredExcluded 是自动登记链的**跳过集** —— 假判定不摘,
// 那 28 条路由就被永久跳过,机器再也不会重判,只能等人翻代码推翻(与机主"最大化减少开发"正面冲突)。
const convergePortal = argv.includes('--converge-portal')
// 渲染复判档(与 --converge-portal 同族):台账写「RN 零承载」而对账尺量到「同名共享屏确被 RN 渲染」
// 是两句互斥的话。本档不按名称翻案(门头注的反例挡住所有按名字并档的做法),而是用 ① 主判据同一条
// 端点阈值裁:过闸才改判,不过闸留着 gap 并把实测 jac/交集数写进出队清单。
const convergeRender = argv.includes('--converge-render')
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

/**
 * 端点重叠强度 —— ① web→RN 主判据与 ①b 渲染复判**共用这一条阈值**(§0.6)。
 * 阈值两处各写一遍的话,日后收紧一处就会造出"主判据不收、复判却收"的假翻案。
 */
export const epOverlapStrong = (jac, n) => jac >= 0.5 || n >= 2

/**
 * 渲染推翻候选的语义打分(纯函数)。为什么必须再过这一道:对账尺写明了反例 ——
 * edu/edu-management/study-plan(教职侧)与 RN 渲染的 StudyPlanScreen(学生侧数据)**同名不同物**,
 * 按名称翻案会把两条语义并成一条,那比留着当缺口更坏。
 * 名称/渲染只证明"这屏确被 RN 接线",端点交集才证明"两边取的是同一批数据"。
 */
export function scoreRenderCandidate(webEps, screenEps) {
  const jac = jaccard(webEps, screenEps)
  const list = common(webEps, screenEps)
  return { jac, n: list.length, strong: epOverlapStrong(jac, list.length), sample: list.slice(0, 3) }
}

/**
 * 文案证据(第二型):端点这一证据类型对某些屏**结构性不存在** —— EP_RE 只认字面 '/api/…' 字符串,
 * 而共享屏大多经 api-client 抽象、不写死字面路径(2026-10-28 实测:10 条渲染推翻候选里 7 条两侧至少一侧
 * 端点为空)。这时按「专有 i18n 命名空间命中 ∧ 专有键重合 ≥2」裁,通用键(common/app/nav/…)整批排除。
 * 阈值与小程序那一维同源(§0.6):两处各写一遍必然漂移,故那一维也改调本函数。
 */
export function keyEvidence(screenKeys, pageKeys) {
  const isGeneric = (k) => GENERIC_NS.has(nsOf(k))
  const sns = new Set([...screenKeys].map(nsOf).filter((n) => !GENERIC_NS.has(n)))
  const pns = new Set([...pageKeys].map(nsOf).filter((n) => !GENERIC_NS.has(n)))
  const nsHit = [...sns].filter((n) => pns.has(n))
  const keyCommon = common(screenKeys, pageKeys).filter((k) => !isGeneric(k))
  return { nsHit, keyCommonN: keyCommon.length, strong: nsHit.length > 0 && keyCommon.length >= 2, sample: keyCommon.slice(0, 4) }
}

/**
 * 纯函数取证档(§22c 的落地形态:本文件是顶层流程型 CLI,没有 isDirectRun 保护,
 * import 它 = 跑整条登记链 ⇒ 判据自证只能走自带 --self-test,派发形状另由镜像件锁)。
 * 刻意排在重活之前:这一档不读台账、不跑对账尺,秒级返回。
 */
function selfTestRender() {
  const S = (a) => new Set(a)
  const cases = []
  const P = (name, pass, got = '') => cases.push({ name, pass: !!pass, got: String(got).slice(0, 120) })
  P('R1 同集 ⇒ 过闸(jac=1)', scoreRenderCandidate(S(['/a/b', '/c/d']), S(['/a/b', '/c/d'])).strong === true, '')
  P(
    'R2 完全不相交 ⇒ 不过闸(门头注那型同名异义,不许按名字并档)',
    (() => {
      const r = scoreRenderCandidate(S(['/teacher/plan/list']), S(['/student/plan/homework']))
      return r.strong === false && r.n === 0
    })(),
    '',
  )
  P(
    'R3 jac<0.5 但交集 ≥2 ⇒ 过闸(与 ① 主判据同式)',
    (() => {
      const r = scoreRenderCandidate(S(['/x/a', '/x/b', '/x/c', '/x/d', '/x/e']), S(['/x/a', '/x/b', '/y/1', '/y/2', '/y/3', '/y/4']))
      return r.strong === true && r.jac < 0.5
    })(),
    '',
  )
  P('R4 一侧空集 ⇒ 不过闸(取不到证据不能读成"证据支持")', scoreRenderCandidate(S(['/a']), new Set()).strong === false, '')
  P('R5 交集样本 ≤3 条(出账可读,不灌整集)', scoreRenderCandidate(S(['/a', '/b', '/c', '/d']), S(['/a', '/b', '/c', '/d'])).sample.length === 3, '')
  // 文案证据这一型:通用键(common.*/nav.*)整批排除,否则任意两页都会因"确定/取消"被判成同物。
  P(
    'R8 文案证据:专有 ns 命中 ∧ 专有键 ≥2 ⇒ 过闸;只有通用键 ⇒ 不过闸',
    keyEvidence(S(['favorites.title', 'favorites.empty', 'common.ok']), S(['favorites.title', 'favorites.empty', 'common.cancel'])).strong === true &&
      keyEvidence(S(['common.ok', 'common.cancel']), S(['common.ok', 'common.no'])).strong === false,
    '',
  )
  P(
    'R9 文案证据:ns 命中但专有键只 1 条 ⇒ 不过闸(单键共名会把两页并成一条)',
    keyEvidence(S(['settings.a', 'settings.b']), S(['settings.a', 'profile.c'])).strong === false,
    '',
  )
  // 形状锁:阈值字面量全文件只许出现在 epOverlapStrong 那一处。**必须先剥注释**再数 ——
  // 本文件头注与上面的理由注释里就写着这条阈值,不剥会把散文算成用量(实测就是这样误判过一次)。
  const srcText = maskComments(readFileSync(new URL(import.meta.url), 'utf8')).replace(/\s+/g, ' ')
  const litCount = (srcText.match(/jac >= 0\.5 \|\| n >= 2/g) || []).length + (srcText.match(/jac >= 0\.5 \|\| list\.length >= 2/g) || []).length
  P('R6 端点阈值全文件只一处实现(§0.6 单一真相源)', litCount === 1, `实测 ${litCount} 处`)
  P('R7 渲染复判的改判行必须显式点名取代旧 gap 行(不顺手扩大 aligned 覆盖面)', /dropStatus: 'gap'/.test(srcText), '')
  for (const c of cases) console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.pass ? '' : ` —— ${c.got}`}`)
  const bad = cases.filter((c) => !c.pass).length
  console.log(bad === 0 ? `渲染复判自检 ${cases.length}/${cases.length} 通过` : `渲染复判自检 ${cases.length - bad}/${cases.length} 通过`)
  process.exit(bad === 0 ? 0 : 1)
}
if (argv.includes('--self-test')) selfTestRender()

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
/** 某共享屏的端点集 = 其符号归属文件的端点并集(① 主判据与 ①b 渲染复判同一份,§0.6) */
function screenEpsOf(s) {
  const ep = new Set()
  for (const f of symbolOwners.get(s.name) || []) for (const e of endpointsOf(cov.faceRead(FACE, f) || '')) ep.add(e)
  return ep
}
/**
 * ①b 用的共享屏文案键 = 屏源文件 ∪ 其 RN 壳文件(与小程序那一维同口径,不另写一份)。
 * 为什么复判需要这一型:EP_RE 只认字面 '/api/…',而共享屏经 api-client 抽象 ⇒ 端点对它们结构性为空
 * (实测 10 条推翻候选里 7 条如此),只剩文案可比。
 */
function screenKeysOf(s) {
  const sk = keysOf(cov.faceRead(FACE, s.spec))
  for (const f of symbolOwners.get(s.name) || []) for (const k of keysOf(cov.faceRead(FACE, f) || '')) sk.add(k)
  return sk
}

const mapRows = parity.loadMap(FACE)
// 门户承载集:判据取对账尺那一份实现,本文件零复算(§0.6)。表取不到 ⇒ set=null ⇒ 整维未判定:
// 既不放宽跳过集,也不改写任何在册行(§0.3 —— 取不到不能读成"没有门户承载")。
const portalCarried = parity.collectPortalRoutes(FACE).set
const registeredWeb = new Set(
  mapRows.filter((r) => r.status === 'aligned' && r.web).map((r) => r.web),
)
const webCandidates = []
if (!only || only === 'web-rn') {
  const screenEp = new Map()
  for (const s of shared) screenEp.set(s.spec, screenEpsOf(s))
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
      const strong = epOverlapStrong(jac, n)
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

// ---------- ①b 渲染推翻候选的语义复判(2026-10-27 立,旗 = --converge-render) ----------
// 对账尺算出「在册 gap 行的同名共享屏确被 RN 以 JSX 渲染」这组互斥陈述,但刻意只点名不翻案,
// 理由写在门体头注:同名 ≠ 同物(现读反例 edu/edu-management/study-plan 是教职侧页面,而 RN 渲染的
// StudyPlanScreen 走学生侧数据)。那道防线是对的;被它挡住的是"整条队列只能等人逐屏翻代码"。
// 本格把它变成机器裁决,判据不新造:端点重叠用 ① 同一条阈值(epOverlapStrong)、屏端点用同一份聚合
// (screenEpsOf)、候选清单取对账尺自己的 --json 出口(§0.6 —— 判据在门那一侧,本器只消费结论)。
//   · 过闸 ⇒ 追加 aligned 行(旧 gap 行由下面的显式 supersede 消掉);
//   · 不过闸 ⇒ 原行留着,并把实测 jac/n 写进出队清单(下一个人不必重新量);
//   · 门结论取不到 ⇒ 整维未判定,一条都不改(§0.3)。
const renderRowsToLand = []
const renderRefused = []
// 两侧任一端点集为空 ⇒ 这道闸**没判**(jaccard 在空集上也返回 0,把"量不到"报成"量出不同"
// 就是本仓记过的失效型:坏的是尺子,不是结论)。单独成桶,与"实测不重叠"分开出账。
const renderUndetermined = []
let renderUnjudged = ''
if (convergeRender) {
  let cands = null
  try {
    const out = execFileSync(process.execPath, [R('scripts/check-web-rn-screen-parity.mjs'), '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    cands = JSON.parse(out).renderContradicted ?? null
  } catch (e) {
    renderUnjudged = `对账尺 --json 跑不通:${String(e?.message ?? e).slice(0, 150)}`
  }
  if (cands === null && renderUnjudged === '') renderUnjudged = '对账尺没产出 renderContradicted 键 ⇒ 本维不判定'
  if (cands !== null) {
    const routeRel = new Map(routes.map((r) => [r.route, r.rel]))
    const gapRows = new Map(mapRows.filter((r) => r.status === 'gap' && r.web).map((r) => [r.web, r]))
    for (const c of cands) {
      if (!gapRows.has(c.web)) continue
      const rel = routeRel.get(c.web)
      const raw = String((c.renderers || [])[0] || '')
      const spec = raw.slice(raw.lastIndexOf('(') + 1, raw.lastIndexOf(')'))
      const s = shared.find((x) => x.spec === spec)
      const webEps = endpointsOf(rel ? cov.faceRead(FACE, rel) || '' : '')
      if (!s) {
        renderRefused.push({ web: c.web, why: `渲染证据里的屏不在共享屏枚举面:${spec || '(解不出 renderer)'} ⇒ 不翻案` })
        continue
      }
      const sep = screenEpsOf(s)
      const sc = scoreRenderCandidate(webEps, sep)
      const sk = screenKeysOf(s)
      const pk = keysOf(rel ? cov.faceRead(FACE, rel) || '' : '')
      const kev = keyEvidence(sk, pk)
      // 两型证据都必须"量到了"才算结论:一型结构性缺失(两侧都取不到字面端点 / 都没有专有键)时,
      // 说"不重叠"就是坏尺子而不是发现(§0.3)。
      const epMeasurable = webEps.size > 0 && sep.size > 0
      const keyMeasurable = sk.size > 0 && pk.size > 0
      if (sc.strong || kev.strong) {
        const ev = sc.strong
          ? `端点交集 ${sc.n} 条(jac ${sc.jac.toFixed(2)};样本 ${(sc.sample || []).join(',').slice(0, 60)})`
          : `专有命名空间 ${kev.nsHit.join('/')} 专有键重合 ${kev.keyCommonN} 条(样本 ${kev.sample.join(',').slice(0, 60)})`
        renderRowsToLand.push({
          web: c.web,
          rn: s.spec,
          status: 'aligned',
          note: `渲染+${sc.strong ? '端点' : '文案'}复判@${TODAY}:RN 已渲染 ${s.name} ∧ ${ev};原在册 gap 由本行取代`,
          at: TODAY,
        })
        continue
      }
      if (!epMeasurable && !keyMeasurable) {
        renderUndetermined.push({
          web: c.web,
          rn: s.spec,
          why: `两型证据都量不到(端点 web ${webEps.size}/RN ${sep.size};键 屏 ${sk.size}/页 ${pk.size})⇒ 本维未判定,不读成"语义不同"`,
        })
        continue
      }
      renderRefused.push({
        web: c.web,
        rn: s.spec,
        why: `同名确被渲染,但${epMeasurable ? `端点不重叠(web ${webEps.size}/RN ${sep.size},jac ${sc.jac.toFixed(2)},交集 ${sc.n})` : '端点这一型取不到'};${keyMeasurable ? `专有键也不重合(屏 ${sk.size}/页 ${pk.size},命中 ${kev.keyCommonN} 条,ns ${kev.nsHit.join('/') || '无'})` : '文案这一型取不到'} ⇒ 留 gap`,
      })
    }
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
      const kev = keyEvidence(sk, pk)
      const nsHit = kev.nsHit
      const keyCommon = common(sk, pk).filter((k) => !GENERIC_NS.has(nsOf(k)))
      const pep = endpointsOf(p.text)
      const epJac = jaccard(sep, pep)
      const epCommon = common(sep, pep)
      const keyStrong = kev.strong
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
  // 跳过集不认门户推翻的在册判定:台账说「不承载/零承载」而 web-portal.ts 说承载 ⇒ 那句已过期,
  // 留着它 = 这条路由被自动登记链永久跳过,再也不会被重判(假判定的危害不是数字,是它锁死了重判)。
  const notPortalCarried = (r) => !(portalCarried?.has(r.web) && (r.status === 'gap' || r.status === 'excluded'))
  const registeredExcluded = new Set(
    mapRows.filter((r) => r.status === 'excluded' && notPortalCarried(r)).map((r) => r.web),
  )
  // gap = 判过「RN 零承载」。不落盘的话,54 条已判缺口会退回 unmapped(判过≡没判)。
  const registeredGap = new Set(
    mapRows.filter((r) => r.status === 'gap' && notPortalCarried(r)).map((r) => r.web),
  )

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
        if (ev.trim().length < 10) {
          refuse('note/reason 少于 10 字,拒')
          continue
        }
        if (it.verdict === 'gap') {
          if (!webRouteSet.has(it.web)) {
            refuse(`web 键不在路由集:${String(it.web)}`)
            continue
          }
          if (registeredWeb.has(it.web) || registeredExcluded.has(it.web) || registeredGap.has(it.web)) {
            refuse('该路由已有判定登记(aligned/excluded/gap)')
            continue
          }
          proposals.web.push({ web: it.web, status: 'gap', note: `子代理判定@${TODAY}: ${ev}`, at: TODAY })
          continue
        }
        if (it.verdict === 'aligned') {
          if (!webRouteSet.has(it.web)) {
            refuse(`web 键不在路由集:${String(it.web)}`)
            continue
          }
          if (registeredWeb.has(it.web) || registeredExcluded.has(it.web) || registeredGap.has(it.web)) {
            refuse('该路由已有判定登记(aligned/excluded/gap)')
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
          if (registeredExcluded.has(it.web) || registeredWeb.has(it.web) || registeredGap.has(it.web)) {
            refuse('该路由/段已有判定登记(aligned/excluded/gap)')
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

function appendMapRows(rows, opt = {}) {
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
  // portal 行按 web 键**取代**同一路由的其它判定行(承载权已由门户表行使,旧判定留着就是第二把尺子)。
  const supersedeWebs = new Set(rows.filter((r) => r.status === 'portal').map((r) => r.web))
  // ①b 的改判行只取代调用方**显式点名的 (web,status) 对**:不顺手把 aligned 当成万能覆盖档,
  // 否则一次复判会洗掉别席在同一枚路由上的在册判定。
  const dropPairs = new Set((opt.supersede || []).map((s) => `${s.web}::${s.dropStatus}`))
  const keep = (r) => {
    try {
      const o = JSON.parse(r.raw)
      return !(supersedeWebs.has(o.web) && o.status !== 'portal') && !dropPairs.has(`${o.web}::${o.status}`)
    } catch {
      return true
    }
  }
  const seen = new Set(headRows.filter(keep).map((r) => r.key))
  const merged = [...headRows.filter(keep).map((r) => r.raw)]
  for (const r of workRows.filter(keep)) {
    if (!seen.has(r.key)) {
      seen.add(r.key)
      merged.push(r.raw)
    }
  }
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
 * 归并与写盘口径归 scripts/lib/cross-end-verdicts.mjs 的 writeVerdictRows(§0.6 单源)——
 * 本函数只决定"落什么",不自己拼一遍归并。
 */
function writeVerdicts(items) {
  if (items.length === 0) return { total: 0, added: 0, unreadable: 0 }
  return writeVerdictRows(ROOT, items)
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

// 门户收敛清单:判据与对账尺的 contradicted 同一把(门户表在册 ∧ 台账写「不承载/零承载」)。
// 表取不到 ⇒ 一条都不改,并显式未判定(§0.3:取不到不能读成"没有门户承载")。
const portalRowsToLand =
  convergePortal && portalCarried
    ? mapRows
        .filter((r) => (r.status === 'gap' || r.status === 'excluded') && portalCarried.has(r.web))
        .map((r) => ({
          web: r.web,
          status: 'portal',
          reason: `门户承载(web-portal.ts 推导@${TODAY}):原在册 ${r.status}`,
          at: TODAY,
        }))
    : []
if (convergePortal && portalCarried === null)
  console.error(`❌ 未判定:门户表取不到 ⇒ 台账一条不改(${parity.WEB_PORTAL_REL})`)
summary.portalConverge = { candidates: portalRowsToLand.length, webs: portalRowsToLand.map((r) => r.web) }
// 渲染复判出账:candidates = 改判几条 / refused = 留在 gap 的实测理由(带 jac 与交集数)/
// unjudged = 门结论取不到 ⇒ 本维一条没改(§0.3)。
summary.renderConverge = {
  enabled: convergeRender,
  candidates: renderRowsToLand.length,
  webs: renderRowsToLand.map((r) => r.web),
  refused: renderRefused,
  undetermined: renderUndetermined,
  unjudged: renderUnjudged,
}
let appliedPortalCount = 0

if (applyMode) {
  const mapRowsToAdd = summary.webRn.map((c) => ({
    web: c.web,
    rn: c.rn,
    status: 'aligned',
    note: `自动登记@${TODAY}: 端点交集 ${c.commonEps} 条(${(c.sample || []).join(', ')}) + 名称 token ${c.nameHit.join('+')}`,
    at: TODAY,
  }))
  for (const r of proposals.web) mapRowsToAdd.push(r)
  for (const r of portalRowsToLand) mapRowsToAdd.push(r)
  for (const r of renderRowsToLand) mapRowsToAdd.push(r)
  appliedPortalCount = portalRowsToLand.length
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
  const addedMap = appendMapRows(mapRowsToAdd, {
    supersede: renderRowsToLand.map((r) => ({ web: r.web, dropStatus: 'gap' })),
  })
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

// 结论行 = 派发腿唯一解析面(形状由镜像测试钉住,不手抄)。三态必须互斥:
// 取不到表 ⇒ undetermined(不得读成 clean);给了旗但没 --apply ⇒ planned(不得读成已收敛)。
console.log(
  `AUTO-REGISTER-PORTAL face=${FACE} state=${
    convergePortal
      ? portalCarried === null
        ? 'undetermined'
        : applyMode
          ? appliedPortalCount > 0
            ? 'converged'
            : 'clean'
          : 'planned'
      : 'off'
  } candidates=${portalRowsToLand.length} applied=${appliedPortalCount}`,
)
// 渲染复判出账(与上一条同族):改判 / 留 gap(实测不重叠,附两侧条数)/ 未判定(一侧取不到,
// 不许读成"语义不同")三态分开 —— 把"没量到"并进"量出不同"是本仓记过的失效型,坏的是尺子不是结论。
console.log(
  `AUTO-REGISTER-RENDER face=${FACE} state=${
    convergeRender
      ? renderUnjudged
        ? 'undetermined'
        : applyMode
          ? renderRowsToLand.length > 0
            ? 'converged'
            : renderRefused.length === 0 && renderUndetermined.length > 0
              ? 'undetermined'
              : 'clean'
          : 'planned'
      : 'off'
  } 改判=${renderRowsToLand.length} 留gap=${renderRefused.length} 未判=${renderUndetermined.length}${renderUnjudged ? ` | ${renderUnjudged}` : ''}`,
)
for (const r of renderRefused) console.log(`   · 留 gap:${r.web} —— ${r.why}`)
for (const r of renderUndetermined) console.log(`   · 未判定:${r.web} —— ${r.why}`)

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
