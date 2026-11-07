#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-sweeper-liveness.mjs —— 「派发在动、留痕静默」背离检测守门(2026-10-23 立,机主令"要")。
 *
 * 立因(2026-10-22/23 两度实证,不是推理):
 *   形态一(10-22):`strip-stale-claim-marks.mjs` 护栏③ 判 `git status` 对台账非净 ⇒ 整批让路。
 *     本仓工作树常年不净 ⇒ 45 枚超龄牌从 10-22 07:45 起一枚未摘。表象是"器物在仓、派发点在
 *     (节流台账每 30 分钟更新),就是干不成活"。
 *   形态二(10-23):`strip-stale-closed-rows.mjs` 摘除成功落地却一行留痕都不写 ⇒ 复洁器与
 *     union 同时瞎掉,摘一次回一次。
 *   两型共同点:单看"器物在仓 + 派发点在"永远发现不了。诊断这一族唯一可靠的读数不是派发节流
 *   台账(它只证明"被叫醒过"),而是**留痕台账最后一条的 at**。
 *
 * 判什么(前两族各三读):派发节流台账 attemptAt(派发在不在动) / 摘除留痕台账最后一条 at(干没干成活)/
 * HEAD 面上**可清存量**(该不该有活)。三读齐了才有背离;缺任何一读 ⇒ 未判定(§0.3)。
 * 第三族 dispatch-parity(票 RP-74,2026-11-04):键表(腿→tickFile→intervalMs)从 scripts/git-guardian.mjs
 * 源码现解析,判"自带节流戳的腿却没在 daemon tick 面被实调用、且戳已冻结"—— 2026-11-03 那 27 小时
 * 零派发的守门形态(计划任务档禁用后 main() 一次性链被轮级锁永久让路)。本族不持有任何第二份清单。
 *
 * 为什么不进提交链:本格判的是"守护自己的巡检层空转",与提交内容无关 ⇒ 按 §12e 恒红门禁令,
 * 只作 git-guardian 巡检轮里的只读探针(与 auditPublicPathProbe 同型),不改守护退出码。
 *
 * 存量口径(关键,防误报):存量 = 清扫器"这一轮真正会动手"的那一面,不是原始读数 ——
 *   closed-stock:门 229 跨枚滞留集过 H4 分档后的**可摘集**(仍保护的不算:那一档清扫器每轮自己
 *     大声报 all-held 交人工,本格再报一次就是复读;2026-10-23 实测 4 枚仍保护);
 *   claim-marks:planSweep 的 leases 再过护栏③(被别席就地改写的移出)。
 * 两族都 import 生产脚本的同一份实现(§0.6/§22c),本格零复算。
 *
 * 退出码:0 = 无 stalled(live/idle-clean)/ 1 = 有 stalled / 2 = 有未判定且无 stalled。
 * 机读行(供守护日志分档,不靠中文文案猜):
 *   `LIVENESS-RESULT state=<live|idle-clean|stalled|undetermined> stalled=<n> undetermined=<n> families=<n>`
 * 逐族行:
 *   `LIVENESS-FAMILY id=<id> state=<state> stock=<n> tickAgeMin=<n> ledgerSilentMin=<n>`
 *
 * 用法:
 *   node scripts/check-sweeper-liveness.mjs           # 人读
 *   node scripts/check-sweeper-liveness.mjs --json    # 机读(守护探针走这一支)
 *   node scripts/check-sweeper-liveness.mjs --self-test
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'
// 夹具落点走 §26 唯一出口(scratch-dir),不直接 mkdtempSync(tmpdir())(守门 G-284 的 F1/F2)。
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
// 存量口径一律 import 生产脚本的同一份实现(§0.6/§22c 单一真相源),本格零复算:
//   closed-stock 走 门 229 的滞留判据 + 清扫器的 H4 分档(守门 71 尺子);
//   claim-marks 走 代摘器的 planSweep + 护栏③(planFaceBlockedBy)。
import { __test__ as closedRows } from './strip-stale-closed-rows.mjs'
import { __test__ as claimMarks } from './strip-stale-claim-marks.mjs'
import { staleClosedVerdict } from './check-plan-closed-stock.mjs'
// TTL 与代摘器 run() 同一条解析路(§0.6):不另立阈值,env 覆盖也走同一个口。
import { __test__ as claims } from './check-task-claims.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'
const HOUR_MS = 3600000
const MIN_MS = 60000

/** 派发多新才算"在动":守护每 2 分钟一轮、清扫节拍 5 分钟,30 分钟 = 连丢 6 拍才叫不动。 */
const DISPATCH_FRESH_MIN = 30
/** 留痕静默多久算背离:5 分钟节拍下,干活的清扫器每轮都该落账;2 小时 =  definitely 空转。 */
const SILENT_HOURS = 2

const STATE_DIR = path.join(ROOT, '.ihui-agent', 'state')

const g = (a) => gitRaw(a, ROOT)

/**
 * closed-stock 族存量:门 229 的跨枚滞留集,过清扫器的 H4 分档后取**可摘集**。
 * 仍保护/归因不过一律不算存量 —— 那一档清扫器自己每轮都大声报 all-held 交人工,
 * 本格再报一次"stalled"就是复读别人的 ⚠️,正是"护栏必触发 ⇒ 器物永久空转"那一型误报。
 * @returns {{stock:number, detail:string}|{undetermined:true, why:string}}
 */
function closedStockOf(headText, baseText) {
  const v = staleClosedVerdict(headText, baseText)
  if (v.undetermined) return { undetermined: true, why: '门 229 判据未判定(登记行解析异常)' }
  if (v.stale.length === 0)
    return { stock: 0, detail: `HEAD 面无跨枚滞留(已勾 ${v.faceClosed} 条均为刚翻勾的宽限)` }
  const ruler = closedRows.buildLineLossRuler()
  if (!ruler.ok) return { undetermined: true, why: `H4 尺子取不到:${ruler.why}` }
  const part = closedRows.partitionStaleByProtection(headText, v.stale, ruler.lossesOf)
  if (part.undetermined || !part.ok)
    return { undetermined: true, why: `H4 分档未判定/拒绝:${part.why ?? '分档未通过'}` }
  return {
    stock: part.strippable.length,
    detail: `跨枚滞留 ${v.stale.length} 条,其中可摘 ${part.strippable.length}、仍保护 ${part.held.length}`,
  }
}

/**
 * claim-marks 族存量:与代摘器 `run()` 同一路径 —— TTL 走 `resolveTtlHours` 同源解析、
 * planSweep 取 leases,再过护栏③(被别席就地改写的移出可摘面)。本格不另立阈值。
 * `root` 只为自检夹具可注入(代摘器默认读真实仓库工作树副本);真测量一律 ROOT。
 * @returns {{stock:number, detail:string}|{undetermined:true, why:string}}
 */
function claimStockOf(headText, nowMs, root = ROOT) {
  const ttl = claims.resolveTtlHours(null, process.env[claims.TTL_ENV]).ttlHours
  const sweep = (extra) =>
    claimMarks.planSweep(headText, {
      nowMs,
      ttlHours: ttl,
      seat: 'sweeper-liveness',
      asOf: claimMarks.localDay(nowMs),
      legacyByOwnerRuling: process.env.IHUI_CLAIM_STRIP_LEGACY_RULING ?? undefined,
      ...extra,
    })
  let plan
  try {
    plan = sweep()
  } catch (e) {
    return { undetermined: true, why: `planSweep 抛错:${String(e?.message ?? e).slice(0, 120)}` }
  }
  if (!plan.ok) return { undetermined: true, why: `planSweep 守恒不过:${plan.why}` }
  const raw = plan.leases.length
  // 护栏③(与代摘器同一实现、同一判据):只移出"旧形态行被别席就地改写"的那几枚;
  // 工作树副本读不到时代摘器按放行处理(byWorktree 占位串解析不出行号 ⇒ skipLines 空),
  // 本格逐字镜像该语义,不另立更严的判据(§0.6)。
  const guard = claimMarks.planFaceBlockedBy(plan.leases, { root })
  if (guard.blocked) {
    const touched = new Set(guard.byWorktree.map((x) => Number(x.slice(1))))
    const skipLines = plan.leases.filter((r) => touched.has(r.line)).map((r) => r.line)
    if (skipLines.length > 0) {
      try {
        plan = sweep({ skipLines })
      } catch (e) {
        return { undetermined: true, why: `护栏③ 后重算抛错:${String(e?.message ?? e).slice(0, 120)}` }
      }
      if (!plan.ok) return { undetermined: true, why: `护栏③ 后重算守恒不过:${plan.why}` }
    }
  }
  return {
    stock: plan.leases.length,
    detail:
      plan.leases.length === raw
        ? `待摘 ${raw} 枚(护栏③ 未让路)`
        : `待摘 ${raw} 枚,其中 ${raw - plan.leases.length} 枚被别席就地改写而让路(交人工)`,
  }
}

/** 前两族配置:tick/ledger 文件名与 git-guardian 派发点、清扫器留痕点逐字一致(形状锁见测试);
 *  第三族 dispatch-parity 不走台账文件,键表从 git-guardian.mjs 源码现解析(见 parseDispatchKeyTable)。
 *  stockOf 一律收**一个 ctx 对象**(不按位置传参)—— 两族签名本就不同(closed 要基线面、
 *  claim 要 nowMs/root),按位置统一传参踩过错位(实测把 4.2MB 基线面当成 nowMs 传进
 *  claimStockOf,C3 守恒不过整族报未判定);对象传参让错位在结构上不可能发生。 */
export const FAMILIES = [
  {
    id: 'closed-stock',
    label: '完成即删清扫',
    tick: 'plan-closed-sweep-last.json',
    ledger: 'plan-row-drop.jsonl',
    ledgerKind: 'stale-closed-sweep',
    needsBase: true,
    stockOf: ({ headText, baseText }) => closedStockOf(headText, baseText),
  },
  {
    id: 'claim-marks',
    label: '超龄认领牌代摘',
    tick: 'stale-claim-strip-last.json',
    ledger: 'stale-claim-strip.jsonl',
    ledgerKind: null,
    needsBase: false,
    stockOf: ({ headText, nowMs, root }) => claimStockOf(headText, nowMs, root),
  },
  {
    // 第三族(票 RP-74):tick/ledger 不适用 —— 键表从守护源码现解析,判"有戳腿却没进 tick 面"。
    id: 'dispatch-parity',
    label: '派发面均衡(有戳腿×tick 覆盖面)',
    tick: null,
    ledger: null,
    ledgerKind: null,
    needsBase: false,
    parity: true,
    stockOf: null,
  },
]

/**
 * 派发节流台账读数。形状 `{attemptAt: ISO}`;取不到/不可解析 ⇒ null。
 * §0.3:不把"没量到"读成"最近跑过"—— 那正是本格要防的那一型(节流台账天天更新=被叫醒过)。
 * @returns {number|null} epoch ms
 */
export function readTickAt(file) {
  try {
    const j = JSON.parse(readFileSync(file, 'utf8'))
    const t = Date.parse(String(j?.attemptAt ?? '').trim())
    return Number.isFinite(t) ? t : null
  } catch {
    return null
  }
}

// ── 第三族:dispatch-parity(登记@2026-11-04,票 RP-74)───────────────────────────
/**
 * 判"守护派发面均衡":键表(腿→tickFile→intervalMs)在量那一刻从 `scripts/git-guardian.mjs`
 * 源码现解析(§0.6 单一真相源 —— 本族**不持有任何第二份清单**,新增/删除一条派发腿,本族读数
 * 随之变化,不需要谁记得来改这里)。
 * 失效形态(2026-11-03 已实证 27 小时零派发):daemon 常驻持有轮级锁 ⇒ main() 一次性链每趟让路;
 * 一条自带节流戳的腿若不在 tick 面,它的戳就会冻结 —— 器物在仓、派发点写在 main、永不真跑。
 * 判据(逐腿):
 *   covered(tick 面有非注释实调用) ⇒ 不进真名单;
 *   仅 main 面 ∧ 戳龄 > 宽限窗 ⇒ stalled(宽限窗 = max(3×intervalMs, 2h);intervalMs 静态解析不出 ⇒ 24h);
 *   仅 main 面 ∧ 戳读不到/文件不在 ⇒ undetermined(§0.3,不冒红也不冒绿);
 *   真名单为空 ⇒ idle-clean;整表枚举为 0 条 ⇒ 判死(undetermined,§0.3"枚举到 0 不当绿")。
 * tick/main 体的切片与"非注释实调用"判据是**本文件唯一实现**,fanout 镜像测试 import 同一份
 * (`scripts/tests/git-guardian-daemon-audit-fanout.test.mjs` 不再自带副本,§0.6)。
 */
export const GUARDIAN_REL = path.join('scripts', 'git-guardian.mjs')

/** 取 startDaemon 里 `const tick = () => {` 之后的正文(判不出 ⇒ 空串,由调用方判未判定)。
 *  边界按缩进收口:配平花括号会被模板字符串/注释里的 `{` 带偏;列 0 非空行即视为 startDaemon 结束。
 *  失效方向是"提前收口 ⇒ 判不出 ⇒ 未判定",绝不会把 main() 的调用读成 tick 接线。 */
export function tickBodyOf(source) {
  const i = source.indexOf('function startDaemon')
  if (i < 0) return ''
  const j = source.indexOf('const tick = () => {', i)
  if (j < 0) return ''
  const lines = source.slice(j).split(/\r?\n/)
  const out = []
  for (let k = 1; k < lines.length; k++) {
    const l = lines[k]
    if (l.trim() !== '' && !/^\s/.test(l)) break
    out.push(l)
  }
  return out.join('\n')
}

/** 取 main() 正文:从 `async function main()` 到 `function startDaemon`(两段天然相邻)。 */
export function mainBodyOf(source) {
  const i = source.indexOf('async function main()')
  if (i < 0) return ''
  const j = source.indexOf('function startDaemon', i)
  if (j < 0) return ''
  return source.slice(i, j)
}

/** 非注释行中首次出现 `${name}(` 的字符偏移;找不到 ⇒ -1。注释里出现调用名不算接线。 */
export function liveCallOffset(body, name) {
  const lines = String(body).split(/\r?\n/)
  let off = 0
  for (const raw of lines) {
    const t = raw.trim()
    if (!t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && t.includes(`${name}(`)) {
      return off
    }
    off += raw.length + 1
  }
  return -1
}

/** 只看非注释行的实调用。 */
export function hasLiveCall(body, name) {
  return liveCallOffset(body, name) >= 0
}

/** 从 `=`/`:` 之后取值:按括号深度与引号扫描到整表达式结束(单行与多行 join(...) 同一条路)。 */
function valueAfterAssign(src, idx) {
  let i = idx + 1
  while (i < src.length && /[\s]/.test(src[i])) i++
  const start = i
  let depth = 0
  let inStr = null
  for (; i < src.length; i++) {
    const c = src[i]
    if (inStr) {
      if (c === '\\') i++
      else if (c === inStr) inStr = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c
      continue
    }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      // 深度归零后的第一个收束符 = 外层容器(解构块/参数表)的闭合 ⇒ 值到此为止
      if (depth === 0) return src.slice(start, i)
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    } else if ((c === '\n' || c === ';' || c === ',') && depth === 0) return src.slice(start, i)
  }
  return src.slice(start)
}

/** 顶层 `const ID = ...` 的取值文本(解析器只认列 0 定义)。 */
function constValueOf(src, id) {
  const m = src.match(new RegExp('^const ' + id + '\\s*=', 'm'))
  if (!m) return null
  return valueAfterAssign(src, m.index + m[0].length - 1)
}

/** 取表达式里最后一个字符串/模板段(对 join(WORKTREE,'.ihui-agent','state','x.iso') 即文件名)。 */
function lastPathSegment(expr) {
  const segs = [...String(expr).matchAll(/'([^'\n]+)'|"([^"\n]+)"|`([^`\n]+)`/g)].map((x) => x[1] ?? x[2] ?? x[3])
  return segs.length ? segs[segs.length - 1] : null
}

/** 把 tickFile 表达式解析成 state 目录下的文件名(常量→递归;模板串保留 ${…} 由调用方代换)。 */
function resolveTickFileExpr(src, expr, depth = 0) {
  if (depth > 4 || expr == null) return null
  const id = String(expr).trim().replace(/[,;\s]+$/, '')
  if (/^[A-Z][A-Z0-9_]*$/.test(id)) {
    const t = constValueOf(src, id)
    return t == null ? null : resolveTickFileExpr(src, t, depth + 1)
  }
  return lastPathSegment(id)
}

/** 把 intervalMs 表达式解析成毫秒;解不出 ⇒ null(调用方按 24h 宽限)。 */
function resolveIntervalExpr(src, expr, depth = 0) {
  if (depth > 4 || expr == null) return null
  let s = String(expr).trim().replace(/[,;\s]+$/, '')
  if (/^[A-Z][A-Z0-9_]*$/.test(s)) {
    const t = constValueOf(src, s)
    return t == null ? null : resolveIntervalExpr(src, t, depth + 1)
  }
  s = s.replace(/^Number\(/, '').replace(/\)\s*$/, '')
  if (s.includes('||')) s = s.slice(s.lastIndexOf('||') + 2)
  s = s.replace(/_/g, '').trim()
  if (!/^[\d\s*+\-()/]+$/.test(s)) return null
  try {
    const v = Function(`"use strict";return (${s})`)()
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

/** 顶层函数名→体文本(体=定义起点到下一个列 0 顶层函数;够覆盖解构默认参与调用点)。 */
function topLevelFnBodies(src) {
  const hits = [...src.matchAll(/^(?:export )?(?:async )?function (\w+)\(/gm)]
  const map = new Map()
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index
    const end = i + 1 < hits.length ? hits[i + 1].index : src.length
    map.set(hits[i][1], src.slice(start, end))
  }
  return map
}

/** 键表:从守护源码现解析 腿→tickFile→intervalMs。只收"被真派发(main 或 tick 非注释调用)且带节流戳"的腿。 */
export function parseDispatchKeyTable(src, { tickBody, mainBody } = {}) {
  const tick = tickBody ?? tickBodyOf(src)
  const main = mainBody ?? mainBodyOf(src)
  const bodies = topLevelFnBodies(src)
  // 调用点形态二:legThrottle(join(dirname(LOG), 'X.json'), MS, ...) NAME() —— 戳住在调用点。
  const throttle = new Map()
  for (const m of src.matchAll(/legThrottle\(join\(dirname\(LOG\),\s*'([^']+)'\),\s*([^,]+),[^\n]*?\)\)\s*(\w+)\(\)/g)) {
    throttle.set(m[3], { tickFile: m[1], intervalMs: resolveIntervalExpr(src, m[2]) })
  }
  const dispatched = new Set()
  for (const [name, body] of bodies) {
    if (hasLiveCall(tick, name) || hasLiveCall(main, name)) dispatched.add(name)
  }
  for (const m of String(src).matchAll(/^import \{([^}]+)\} from[^\n]*$/gm)) {
    for (const n of m[1].split(',')) {
      const name = n.trim().split(/\s+as\s+/).pop()
      if (name && (hasLiveCall(tick, name) || hasLiveCall(main, name))) dispatched.add(name)
    }
  }
  const rows = []
  for (const name of [...dispatched].sort()) {
    const body = bodies.get(name)
    let tickFile = null
    let intervalMs = null
    let via = 'legThrottle 调用点'
    if (body) {
      const tfm = body.match(/\b(?:tickFile|defaultTickFile)\s*[:=]/)
      if (tfm) {
        const raw = valueAfterAssign(body, tfm.index + tfm[0].length - 1)
        tickFile = resolveTickFileExpr(src, raw)
        via = '解构默认值'
      }
      const ivm = body.match(/\bintervalMs\s*[:=]/)
      if (ivm) intervalMs = resolveIntervalExpr(src, valueAfterAssign(body, ivm.index + ivm[0].length - 1))
      // 委托形态:return helper('kind', opts) 且 helper 的 tickFile 是 `${kind}` 模板 ⇒ 代换
      if (!tickFile) {
        const del = body.match(/return\s+(\w+)\(\s*'([^']+)'\s*,\s*opts\s*\)/)
        if (del) {
          const helper = bodies.get(del[1])
          if (helper) {
            const htfm = helper.match(/\btickFile\s*[:=]/)
            if (htfm) {
              const seg = resolveTickFileExpr(src, valueAfterAssign(helper, htfm.index + htfm[0].length - 1))
              if (seg && seg.includes('${')) {
                tickFile = seg.replace(/\$\{[^}]*\}/g, del[2])
                via = '委托 helper 模板代换'
              }
            }
            const hivm = helper.match(/\bintervalMs\s*[:=]/)
            if (hivm) intervalMs = resolveIntervalExpr(src, valueAfterAssign(helper, hivm.index + hivm[0].length - 1))
          }
        }
      }
    }
    const ts = throttle.get(name)
    if (ts) {
      tickFile = tickFile ?? ts.tickFile
      intervalMs = intervalMs ?? ts.intervalMs
      if (!body) via = 'legThrottle 调用点(跨模块腿)'
    }
    if (!tickFile) continue
    rows.push({ leg: name, tickFile, intervalMs, via, onTick: hasLiveCall(tick, name), onMain: hasLiveCall(main, name) })
  }
  return rows
}

/** 戳文件读数:.iso/.ts 存裸 ISO,*.json 存 {attemptAt};目录用 mtime。取不到 ⇒ null(不猜)。 */
export function readStampAt(file) {
  try {
    const st = statSyncSafe(file)
    let raw
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      raw = null
    }
    if (raw && typeof raw === 'object' && 'attemptAt' in raw) {
      const t = Date.parse(String(raw.attemptAt ?? '').trim())
      if (Number.isFinite(t)) return t
    }
    try {
      const t = Date.parse(String(readFileSync(file, 'utf8')).trim())
      if (Number.isFinite(t)) return t
    } catch {
      /* 目录或二进制 ⇒ 走 mtime */
    }
    return st === null ? null : st
  } catch {
    return null
  }
}

function statSyncSafe(file) {
  try {
    return statSync(file).mtimeMs
  } catch {
    return null
  }
}

/** 宽限窗:intervalMs 解析得出 ⇒ max(3×interval, 2h);解析不出 ⇒ 24h。 */
export function parityThresholdMs(intervalMs) {
  return Number.isFinite(intervalMs) ? Math.max(3 * intervalMs, 2 * HOUR_MS) : 24 * HOUR_MS
}

/**
 * dispatch-parity 族读数(纯注入,可测)。src/stateDir 由调用方给:真测量读仓内文件,
 * 自检夹具给合成源码与 scratch 目录 —— 判据本体不关心来源。
 * @returns {{state:string, why?:string, detail:string, stock:number|null, rows:object[]}}
 */
export function dispatchParityMeasure({ src, stateDir, nowMs = Date.now() }) {
  if (typeof src !== 'string' || src === '')
    return { state: 'undetermined', stock: null, rows: [], detail: '守护源码取不到 ⇒ 键表无从解析(§0.3,不记绿也不冒红)' }
  const tick = tickBodyOf(src)
  const main = mainBodyOf(src)
  if (!tick || !main)
    return { state: 'undetermined', stock: null, rows: [], detail: 'tick/main 体切片判不出(源码形态变了)⇒ 本族未判定' }
  const rows = parseDispatchKeyTable(src, { tickBody: tick, mainBody: main })
  if (rows.length === 0)
    return { state: 'undetermined', stock: null, rows: [], detail: '键表枚举到 0 条带戳腿 ⇒ 判死(§0.3:枚举 0 个候选不当绿)' }
  const off = rows.filter((r) => !r.onTick)
  for (const r of off) {
    const at = r.onMain ? readStampAt(path.join(stateDir, r.tickFile)) : null
    r.dispatched = r.onMain
    r.stampAt = at
    if (!r.onMain) {
      r.verdict = 'undetermined'
      r.reason = '两面无实调用(定义在、没人派)⇒ 未判定,交人工核'
      continue
    }
    if (at === null) {
      r.verdict = 'undetermined'
      r.reason = `节流戳取不到(${r.tickFile} 不在/不可解析)⇒ 不得读成"从未跑"也不得读成"在跑"`
      continue
    }
    const ageMs = nowMs - at
    const th = parityThresholdMs(r.intervalMs)
    r.ageMin = Math.max(0, Math.round(ageMs / MIN_MS))
    if (ageMs > th) {
      r.verdict = 'stalled'
      r.reason = `戳冻结 ${r.ageMin} 分钟(宽限窗 ${Math.round(th / MIN_MS)} 分钟)且不在 tick 面`
    } else {
      r.verdict = 'live'
      r.reason = '仅 main 面但戳新鲜 ⇒ 任务档还活着,暂不背离'
    }
  }
  const stalled = off.filter((r) => r.verdict === 'stalled')
  const und = off.filter((r) => r.verdict === 'undetermined')
  let state
  if (stalled.length > 0) state = 'stalled'
  else if (und.length > 0) state = 'undetermined'
  else if (off.length === 0) state = 'idle-clean'
  else state = 'live'
  const names = (list) => list.map((r) => `${r.leg}(戳 ${r.tickFile}${r.ageMin === undefined ? '' : ` 已 ${r.ageMin} 分钟未动`})`).join('、')
  const detail =
    state === 'stalled'
      ? `有戳却不在 tick 面且戳冻结:${names(stalled)}` +
        ` —— daemon 常驻持轮级锁,main() 那趟永远让路 ⇒ 这些腿实际零派发(2026-11-03 的 27 小时静默同型)` +
        (und.length ? `;另有 ${und.length} 条未判定:${names(und)}` : '')
      : state === 'undetermined'
        ? `真名单含 ${und.length} 条读不动:${names(und)} —— 派发在不在动无法确认(§0.3)`
        : off.length === 0
          ? `真名单为空:键表 ${rows.length} 条带戳腿全部在 tick 面有非注释实调用`
          : `真名单 ${off.length} 条但戳新鲜(任务档在顶),不背离:${names(off)}`
  return { state, stock: off.length, rows, detail, tableSize: rows.length }
}

/** 真测量入口:源码与 state 目录都从 root 现读。 */
export function dispatchParityFamily({ root = ROOT, nowMs = Date.now() } = {}) {
  let src = null
  try {
    src = readFileSync(path.join(root, GUARDIAN_REL), 'utf8')
  } catch {
    src = null
  }
  return dispatchParityMeasure({ src, stateDir: path.join(root, '.ihui-agent', 'state'), nowMs })
}


/**
 * 摘除留痕台账最后一条的 at(按 kind 过滤;缺 kind 字段的族传 null 即全收)。
 * 文件不在 ⇒ null(= 从未留痕,静默无限久 —— 10-23 形态二正是这一格)。
 * 畸形行跳过;同族多条取最大 at(台账是追加写,但并发下不假设有序)。
 * @returns {number|null} epoch ms
 */
export function readLedgerAt(file, kind = null) {
  if (!existsSync(file)) return null
  let last = null
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const s = line.trim()
    if (s === '') continue
    let e
    try {
      e = JSON.parse(s)
    } catch {
      continue
    }
    if (kind && e?.kind !== kind) continue
    const t = Date.parse(String(e?.at ?? ''))
    if (Number.isFinite(t) && (last === null || t > last)) last = t
  }
  return last
}

/**
 * 背离判定(纯函数,全部读数注入,便于镜像测试钉住每一态)。
 * 三态 + 未判定:
 *   live        tick 新鲜 ∧ (留痕刚写过 ∨ 存量 0 的逆否不成立) ⇒ 健康
 *   idle-clean  存量 0(仍保护/护栏让路不计入)⇒ 留痕无新增属正常,**绝不误报**
 *   stalled     tick 新鲜 ∧ 存量 > 0 ∧ 留痕静默 > SILENT_HOURS ⇒ 点名(含"从未留痕")
 *   undetermined tick 取不到 / tick 陈旧(派发本身不在动,背离前提不成立)/ 存量不可测
 * @param {{tickAt:number|null, ledgerAt:number|null, stock:number, nowMs:number,
 *          freshMin?:number, silentHours?:number}} o
 * @returns {{state:'live'|'idle-clean'|'stalled'|'undetermined', why:string, detail:string}}
 */
export function verdictFor({
  tickAt,
  ledgerAt,
  stock,
  nowMs,
  freshMin = DISPATCH_FRESH_MIN,
  silentHours = SILENT_HOURS,
}) {
  if (!Number.isFinite(tickAt))
    return {
      state: 'undetermined',
      why: 'tick-unavailable',
      detail: '派发节流台账取不到或 attemptAt 不可解析 ⇒ "派发在动"这一前提无法确认(§0.3,不读成"没在动")',
    }
  if (!Number.isFinite(stock))
    return {
      state: 'undetermined',
      why: 'stock-unmeasured',
      detail: '可清存量取不到 ⇒ 不得读成 0(§0.3)',
    }
  if (stock <= 0)
    return {
      state: 'idle-clean',
      why: 'stock-zero',
      detail: '可清存量 0(仍保护/护栏让路的不计入)⇒ 留痕无新增属正常,不是空转',
    }
  const tickAgeMs = nowMs - tickAt
  const tickAgeMin = Math.max(0, Math.round(tickAgeMs / MIN_MS))
  if (tickAgeMs > freshMin * MIN_MS)
    return {
      state: 'undetermined',
      why: 'dispatch-not-moving',
      detail:
        `派发节流 ${tickAgeMin} 分钟未更新 ⇒ 背离前提(派发在动)不成立;` +
        `这是派发层停摆,不是本格捕捉的"在动但不留痕"(§0.3:不把没量到读成量到)`,
    }
  const silentMs = Number.isFinite(ledgerAt) ? nowMs - ledgerAt : Infinity
  if (silentMs > silentHours * HOUR_MS) {
    const shown = Number.isFinite(ledgerAt) ? `${Math.round(silentMs / MIN_MS)} 分钟` : '从未留痕'
    return {
      state: 'stalled',
      why: 'dispatch-live-ledger-silent',
      detail:
        `派发在动(节流 ${tickAgeMin} 分钟前刚更新)但摘除留痕已静默 ${shown},` +
        `而可清存量 ${stock} ⇒ 器物在仓、派发点在,就是干不成活(2026-10-22/23 两度实证的形态)`,
    }
  }
  return {
    state: 'live',
    why: 'ok',
    detail: `派发在动(节流 ${tickAgeMin} 分钟前刚醒)且留痕 ${Number.isFinite(ledgerAt) ? `${Math.round(silentMs / MIN_MS)} 分钟前刚写过` : '…'}`,
  }
}

/**
 * 全量测量:HEAD/HEAD^ 面一次取回(两族共用),逐族读 tick/ledger/存量后过 verdictFor。
 * 面取不到 ⇒ 该族存量 undetermined(§0.4:不回落另一个面),由 verdictFor 折成未判定。
 * @returns {{overall:string, families:Array<object>}}
 */
export function measure({ nowMs = Date.now(), root = ROOT } = {}) {
  let headText = null
  let baseText = null
  try {
    headText = gitRaw(['cat-file', '-p', `HEAD:${FILE}`], root)
  } catch {
    headText = null
  }
  try {
    baseText = gitRaw(['cat-file', '-p', `HEAD^:${FILE}`], root)
  } catch {
    baseText = null
  }
  const stateDir = path.join(root, '.ihui-agent', 'state')
  const par = dispatchParityFamily({ root, nowMs })
  const worstOffAgeMin = par.rows.filter((r) => r.verdict === 'stalled').reduce(
    (a, r) => (r.ageMin === undefined ? a : Math.max(a === null ? r.ageMin : a, r.ageMin)),
    null,
  )
  const families = FAMILIES.map((fam) => {
    if (fam.parity) {
      return {
        id: fam.id,
        label: fam.label,
        parity: true,
        tick: '(源码现解析)',
        ledger: '(源码现解析)',
        tickAt: null,
        ledgerAt: null,
        stock: par.stock === null ? null : par.stock,
        stockNote: `键表 ${par.tableSize ?? 0} 条带戳腿(现解析,非清单)`,
        state: par.state,
        why: par.state === 'stalled' ? 'off-tick-frozen' : par.why ?? (par.state === 'undetermined' ? 'parity-unmeasured' : 'ok'),
        detail: par.detail,
        tickAgeMin: worstOffAgeMin,
        ledgerSilentMin: null,
        rows: par.rows.filter((r) => !r.onTick).map((r) => ({ leg: r.leg, tickFile: r.tickFile, verdict: r.verdict, ageMin: r.ageMin ?? null, reason: r.reason })),
      }
    }
    const tickAt = readTickAt(path.join(stateDir, fam.tick))
    const ledgerAt = readLedgerAt(path.join(stateDir, fam.ledger), fam.ledgerKind)
    let s
    if (typeof headText !== 'string' || headText === '')
      s = { undetermined: true, why: 'HEAD 面台账取不到 ⇒ 存量无从量(§0.4)' }
    else if (fam.needsBase && (typeof baseText !== 'string' || baseText === ''))
      s = { undetermined: true, why: 'HEAD^ 面取不到 ⇒ 滞留判据缺基线(§0.4)' }
    else s = fam.stockOf({ headText, baseText, nowMs, root })
    const stock = s.undetermined ? NaN : s.stock
    const v = verdictFor({ tickAt, ledgerAt, stock, nowMs })
    return {
      id: fam.id,
      label: fam.label,
      tick: fam.tick,
      ledger: fam.ledger,
      tickAt: tickAt === null ? null : new Date(tickAt).toISOString(),
      ledgerAt: ledgerAt === null ? null : new Date(ledgerAt).toISOString(),
      stock: s.undetermined ? null : s.stock,
      stockNote: s.detail ?? s.why ?? '',
      state: v.state,
      why: v.why,
      detail: v.detail,
      tickAgeMin:
        tickAt === null ? null : Math.max(0, Math.round((nowMs - tickAt) / MIN_MS)),
      ledgerSilentMin:
        ledgerAt === null ? null : Math.max(0, Math.round((nowMs - ledgerAt) / MIN_MS)),
    }
  })
  const stalled = families.filter((f) => f.state === 'stalled').length
  const und = families.filter((f) => f.state === 'undetermined').length
  const overall = stalled > 0 ? 'stalled' : und > 0 ? 'undetermined' : families.every((f) => f.state === 'idle-clean') ? 'idle-clean' : 'live'
  return { overall, families }
}

function emitResult(overall, families) {
  const stalled = families.filter((f) => f.state === 'stalled').length
  const und = families.filter((f) => f.state === 'undetermined').length
  const line = `LIVENESS-RESULT state=${overall} stalled=${stalled} undetermined=${und} families=${families.length}`
  console.log(line)
  return line
}

const ICON = { live: '✅', 'idle-clean': '✅', stalled: '⚠️', undetermined: '⚠️' }

function humanReport({ overall, families }) {
  console.log('📡 清扫背离巡检(前两族判据:派发节流在动 ∧ 留痕静默 > 2h ∧ 可清存量 > 0 ⇒ stalled)')
  for (const f of families) {
    if (f.parity) {
      const bits = [
        `state=${f.state}`,
        `真名单=${f.stock ?? '未判定'} 条`,
        f.stockNote,
      ]
      console.log(`  ${ICON[f.state] ?? '·'} ${f.id} ${f.label}: ${bits.join(' · ')}`)
      console.log(`     └ ${f.detail}`)
      for (const r of f.rows ?? []) {
        console.log(`     · ${r.leg} 戳=${r.tickFile} ⇒ ${r.verdict}${r.ageMin === null ? '' : `(${r.ageMin} 分钟)`} — ${r.reason}`)
      }
      continue
    }
    const bits = [
      `state=${f.state}`,
      `存量=${f.stock ?? '未判定'}`,
      f.tickAgeMin === null ? '节流=取不到' : `节流=${f.tickAgeMin} 分钟前刚醒`,
      f.ledgerSilentMin === null ? '留痕=从未写过' : `留痕=${f.ledgerSilentMin} 分钟前刚写`,
    ]
    console.log(`  ${ICON[f.state] ?? '·'} ${f.id} ${f.label}: ${bits.join(' · ')}`)
    console.log(`     └ ${f.detail}${f.stockNote ? ` ｜ ${f.stockNote}` : ''}`)
  }
  emitResult(overall, families)
}

/** 自检:纯函数夹具 + scratch 落点读数(§26 唯一出口),不碰仓库、不落盘。 */
function selfTest() {
  let fails = 0
  let total = 0
  const t = (n, cond, detail = '') => {
    total++
    if (cond) console.log(`✓ ${n}`)
    else {
      fails++
      console.log(`✗ ${n}${detail ? ` —— ${detail}` : ''}`)
    }
  }
  const NOW = Date.parse('2026-10-23T12:00:00Z')
  const min = (m) => m * MIN_MS
  const hr = (h) => h * HOUR_MS

  // ① live:派发新鲜 + 留痕刚写 + 有存量
  t(
    '① 派发在动且留痕刚写 ⇒ live',
    verdictFor({ tickAt: NOW - min(5), ledgerAt: NOW - min(3), stock: 5, nowMs: NOW }).state === 'live',
  )
  // ② idle-clean:存量 0,留痕再旧也不误报(防"护栏必触发"型狼来了)
  t(
    '② 存量 0 ⇒ idle-clean(留痕静默 10 小时也不点名)',
    verdictFor({ tickAt: NOW - min(2), ledgerAt: NOW - hr(10), stock: 0, nowMs: NOW }).state === 'idle-clean',
  )
  // ③ idle-clean:存量 0 时派发停摆也不是本格的事(前提不成立即无背离可判)
  t(
    '③ 存量 0 且节流陈旧 ⇒ 仍 idle-clean(不是 stalled)',
    verdictFor({ tickAt: NOW - hr(3), ledgerAt: null, stock: 0, nowMs: NOW }).state === 'idle-clean',
  )
  // ④ stalled:派发新鲜 + 有存量 + 留痕静默超阈值(10-22 形态一)
  t(
    '④ 派发在动、留痕静默 3h、可清存量 7 ⇒ stalled',
    verdictFor({ tickAt: NOW - min(2), ledgerAt: NOW - hr(3), stock: 7, nowMs: NOW }).state === 'stalled',
  )
  // ⑤ stalled:留痕文件从未存在(ledgerAt=null)= 静默无限久(10-23 形态二)
  t(
    '⑤ 派发在动、有存量、从未留痕 ⇒ stalled',
    verdictFor({ tickAt: NOW - min(1), ledgerAt: null, stock: 4, nowMs: NOW }).state === 'stalled',
  )
  // ⑥ 边界:静默恰好在阈值内侧 ⇒ live,外侧 ⇒ stalled(阈值是严格大于)
  t(
    '⑥a 静默 2h-1min ⇒ live(阈值严格大于)',
    verdictFor({ tickAt: NOW - min(1), ledgerAt: NOW - hr(2) + min(1), stock: 3, nowMs: NOW }).state === 'live',
  )
  t(
    '⑥b 静默 2h+1min ⇒ stalled',
    verdictFor({ tickAt: NOW - min(1), ledgerAt: NOW - hr(2) - min(1), stock: 3, nowMs: NOW }).state === 'stalled',
  )
  // ⑦ tick 取不到 ⇒ 未判定(不读成"派发没在动",也不读成"在动")
  t(
    '⑦ 节流台账取不到 ⇒ undetermined(tick-unavailable)',
    (() => {
      const v = verdictFor({ tickAt: null, ledgerAt: NOW - min(1), stock: 5, nowMs: NOW })
      return v.state === 'undetermined' && v.why === 'tick-unavailable'
    })(),
  )
  // ⑧ tick 陈旧 + 有存量 ⇒ 未判定(派发层停摆是另一族问题,不冒名 stalled)
  t(
    '⑧ 节流 45 分钟未动且有存量 ⇒ undetermined(dispatch-not-moving)',
    (() => {
      const v = verdictFor({ tickAt: NOW - min(45), ledgerAt: NOW - hr(5), stock: 5, nowMs: NOW })
      return v.state === 'undetermined' && v.why === 'dispatch-not-moving'
    })(),
  )
  // ⑨ 存量不可测 ⇒ 未判定(绝不折成 0 放行)
  t(
    '⑨ 存量取不到 ⇒ undetermined(stock-unmeasured)',
    verdictFor({ tickAt: NOW - min(1), ledgerAt: NOW - min(1), stock: NaN, nowMs: NOW }).state === 'undetermined',
  )
  // ⑩ 节流戳在未来 10 分钟(时钟偏差)⇒ tickAge 为负仍判"新鲜",走正常判路不误入
  //    dispatch-not-moving;留痕静默 3h + 有存量 ⇒ 结论仍是 stalled(不是不判)。
  t(
    '⑩ 节流戳在未来 10 分钟 ⇒ 仍按新鲜走正常判路(stalled,不误入 dispatch-not-moving)',
    verdictFor({ tickAt: NOW + min(10), ledgerAt: NOW - hr(3), stock: 5, nowMs: NOW }).state === 'stalled',
  )

  // 读数器:scratch 夹具(§26 落点,不碰仓外真台账)
  const dir = mkScratch('sweeper-liveness-')
  try {
    const tickFile = path.join(dir, 'tick.json')
    writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(NOW - min(4)).toISOString() }), 'utf8')
    t('⑪ readTickAt 解析 attemptAt', readTickAt(tickFile) === NOW - min(4))
    writeFileSync(path.join(dir, 'bad.json'), '{oops', 'utf8')
    t('⑫ readTickAt 畸形 JSON ⇒ null(不猜)', readTickAt(path.join(dir, 'bad.json')) === null)
    t('⑬ readTickAt 文件不在 ⇒ null', readTickAt(path.join(dir, 'nope.json')) === null)

    const led = path.join(dir, 'led.jsonl')
    writeFileSync(
      led,
      [
        JSON.stringify({ at: new Date(NOW - hr(5)).toISOString(), kind: 'stale-closed-sweep', rowBefore: 'x' }),
        '{畸形行',
        JSON.stringify({ at: new Date(NOW - min(9)).toISOString(), kind: 'other-kind', rowBefore: 'y' }),
        JSON.stringify({ at: new Date(NOW - hr(1)).toISOString(), kind: 'stale-closed-sweep', rowBefore: 'z' }),
      ].join('\n') + '\n',
      'utf8',
    )
    t('⑭ readLedgerAt 按 kind 过滤并取最大 at', readLedgerAt(led, 'stale-closed-sweep') === NOW - hr(1))
    t('⑮ readLedgerAt 不收别族 kind', readLedgerAt(led, 'other-kind') === NOW - min(9))
    t('⑯ readLedgerAt 文件不在 ⇒ null(从未留痕)', readLedgerAt(path.join(dir, 'nope.jsonl'), null) === null)

    // claim 存量: synthetic HEAD 面 + synthetic 工作树副本(护栏③ 两态 + 一态改写)
    const planText = [
      '- [ ]（进行中@2026-10-01/甲席） G-1 超龄租约,必须摘',
      '- [ ]（进行中@2026-10-22/乙席） G-2 新鲜租约,不许碰',
      '- [ ] G-3 普通待办',
    ].join('\n')
    const rootDir = path.join(dir, 'repo')
    mkdirSync(rootDir, { recursive: true })
    // 工作树副本逐字等于 HEAD 面 ⇒ 纯滞后,护栏③ 不让路
    writeFileSync(path.join(rootDir, FILE), planText, 'utf8')
    t('⑰ claim 存量:一枚超龄(G-2 未超龄)⇒ 可清 1', claimStockOf(planText, NOW, rootDir).stock === 1)
    t(
      '⑱a claim 护栏③:工作树逐字还在(纯滞后)⇒ 不让路,存量仍 1',
      claimStockOf(planText, NOW, rootDir).stock === 1,
    )
    // 别席就地改写了 L1 ⇒ 护栏③ 只让路这一枚,可摘面随之归 0(逐字镜像代摘器 run())
    writeFileSync(
      path.join(rootDir, FILE),
      planText.replace('必须摘', '必须摘(别席就地改写)'),
      'utf8',
    )
    const rewritten = claimStockOf(planText, NOW, rootDir)
    t(
      '⑱b claim 护栏③:旧形态行被别席就地改写 ⇒ 移出可摘面,存量 0',
      rewritten.stock === 0 && /让路/.test(rewritten.detail),
    )
    // ㉑ 接线锁(先把工作树副本还原成逐字滞后态):measure() 走的是 FAMILIES.stockOf(ctx)
    // 这条路,不是直接调函数 —— 2026-10-23 实测过一次按位置传参的错位(4.2MB 基线面被当成
    // nowMs 传进 claimStockOf,C3 守恒不过 ⇒ 整族报未判定),本条钉住 ctx 对象传参本身。
    writeFileSync(path.join(rootDir, FILE), planText, 'utf8')
    t(
      '㉑a 接线锁:claim 族走 FAMILIES.stockOf(ctx) ⇒ 存量 1(不因传参错位翻车)',
      FAMILIES[1].stockOf({ headText: planText, baseText: null, nowMs: NOW, root: rootDir }).stock === 1,
    )
    t(
      '㉑b 接线锁:closed 族合成面(无登记行)走 ctx ⇒ 存量 0',
      FAMILIES[0].stockOf({ headText: planText, baseText: planText, nowMs: NOW, root: ROOT }).stock === 0,
    )
  } finally {
    // 清理失败不得改写自检结论(rmScratch 的 bestEffort 出口,2026-10-04 立)
    rmScratch(dir, { bestEffort: true })
  }

  // 形状锁:前两族配置与守护派发点/清扫器留痕点同款(防别席删掉一格);第三族只许是 parity 族
  t(
    '⑲ FAMILIES 恰有三族:前两族文件名与生产端一致,第三族 dispatch-parity 走源码解析',
    FAMILIES.length === 3 &&
      FAMILIES[0].tick === 'plan-closed-sweep-last.json' &&
      FAMILIES[0].ledger === 'plan-row-drop.jsonl' &&
      FAMILIES[0].ledgerKind === 'stale-closed-sweep' &&
      FAMILIES[1].tick === 'stale-claim-strip-last.json' &&
      FAMILIES[1].ledger === 'stale-claim-strip.jsonl' &&
      FAMILIES[2].id === 'dispatch-parity' &&
      FAMILIES[2].parity === true &&
      FAMILIES[2].tick === null &&
      FAMILIES[2].ledger === null,
  )
  const src = readFileSync(path.join(ROOT, 'scripts', 'check-sweeper-liveness.mjs'), 'utf8')
  t(
    '⑳ 存量口径 import 生产实现(closedRows/claimMarks 都在用)',
    /closedRows\.buildLineLossRuler\(\)/.test(src) &&
      /closedRows\.partitionStaleByProtection\(/.test(src) &&
      /claimMarks\.planSweep\(/.test(src) &&
      /claimMarks\.planFaceBlockedBy\(/.test(src),
  )
  t(
    '⑳b 第三族零清单:键表只能来自源码现解析,文件里不得内嵌任何腿名清单(§0.6)',
    /parseDispatchKeyTable\(/.test(src) &&
      !/const\s+(PARITY_LEGS|DISPATCH_LEGS|LEG_LIST)\s*=/.test(src) &&
      !/'audit[A-Za-z]+',\s*'audit/.test(src.replace(/\/\/[^\n]*/g, '')),
  )

  // ── 第三族 dispatch-parity:合成源码夹具逐态钉住 ──
  const FIX = [
    'const AASA_TICK = join(',
    "  WORKTREE, '.ihui-agent', 'state',",
    "  'aasa-health-tick.ts',",
    ')',
    'async function main() {',
    '  coveredLeg()',
    '  frozenLeg()',
    '  freshLeg()',
    '  missingLeg()',
    '  throttledLeg()',
    '  constThrottleLeg()',
    '  delegLeg()',
    '}',
    'function startDaemon() {',
    '  const tick = () => {',
    '    coveredLeg()',
    "    log('daemon:提交窗口期')",
    '    if (legThrottle(join(dirname(LOG),',
    "      'throttled-dispatch-last.json'), 30 * 60 * 1000, Date.now(), log)) throttledLeg()",
    '  }',
    '}',
    'function coveredLeg(opts = {}) {',
    '  const { now = Date.now(), intervalMs = 30 * 60 * 1000, tickFile = join(WORKTREE, \'.ihui-agent\', \'state\', \'covered-last.json\') } = opts',
    '}',
    'function frozenLeg(opts = {}) {',
    '  const { intervalMs = 30 * 60 * 1000, tickFile = join(WORKTREE, \'.ihui-agent\', \'state\', \'frozen-last.json\') } = opts',
    '}',
    'function freshLeg(opts = {}) {',
    '  const { intervalMs = 30 * 60 * 1000, tickFile = join(WORKTREE, \'.ihui-agent\', \'state\', \'fresh-last.json\') } = opts',
    '}',
    'function missingLeg(opts = {}) {',
    '  const { intervalMs = 30 * 60 * 1000, tickFile = join(WORKTREE, \'.ihui-agent\', \'state\', \'missing-last.json\') } = opts',
    '}',
    'function throttledLeg(opts = {}) {}',
    'function constThrottleLeg(opts = {}) {',
    '  const { intervalMs = AASA_INTERVAL_MS, tickFile = AASA_TICK } = opts',
    '}',
    'const AASA_INTERVAL_MS = Number(process.env.IHUI_AASA_INTERVAL_MS || 6 * 60 * 60 * 1000)',
    "function clientProbe(kind, opts = {}) { const { tickFile = join(WORKTREE, '.ihui-agent', 'state', `${kind}-sync-task-tick.iso`) } = opts }",
    'function delegLeg(opts = {}) {',
    "  return clientProbe('qoder', opts)",
    '}',
  ].join('\n')
  const parDir = path.join(dir, 'state')
  mkdirSync(parDir, { recursive: true })
  const iso = (msAgo) => new Date(NOW - msAgo).toISOString()
  writeFileSync(path.join(parDir, 'frozen-last.json'), JSON.stringify({ attemptAt: iso(10 * 24 * HOUR_MS) }), 'utf8')
  writeFileSync(path.join(parDir, 'fresh-last.json'), JSON.stringify({ attemptAt: iso(5 * MIN_MS) }), 'utf8')
  writeFileSync(path.join(parDir, 'aasa-health-tick.ts'), iso(30 * 60 * 1000), 'utf8')
  writeFileSync(path.join(parDir, 'qoder-sync-task-tick.iso'), iso(10 * 24 * HOUR_MS), 'utf8')
  const par = dispatchParityMeasure({ src: FIX, stateDir: parDir, nowMs: NOW })
  t(
    '㉒a 键表解析:解构/常量/legThrottle/委托模板四形态都进表',
    ['coveredLeg', 'frozenLeg', 'constThrottleLeg', 'throttledLeg', 'delegLeg'].every((n) =>
      par.rows.some((r) => r.leg === n) || n === 'coveredLeg',
    ) &&
      par.rows.find((r) => r.leg === 'constThrottleLeg').tickFile === 'aasa-health-tick.ts' &&
      par.rows.find((r) => r.leg === 'constThrottleLeg').intervalMs === 6 * 60 * 60 * 1000 &&
      par.rows.find((r) => r.leg === 'throttledLeg').tickFile === 'throttled-dispatch-last.json' &&
      par.rows.find((r) => r.leg === 'delegLeg').tickFile === 'qoder-sync-task-tick.iso',
  )
  t('㉒b coveredLeg 在 tick 面 ⇒ 不进真名单', !par.rows.filter((r) => !r.onTick).some((r) => r.leg === 'coveredLeg'))
  t(
    '㉓ frozenLeg(戳 10 天未动,interval 30min)⇒ stalled 且点名',
    par.state === 'stalled' && /frozenLeg/.test(par.detail),
  )
  t(
    '㉔ freshLeg(戳 5 分钟前)⇒ 该腿 live 不背离',
    par.rows.find((r) => r.leg === 'freshLeg' && !r.onTick)?.verdict === 'live',
  )
  t(
    '㉕ missingLeg 戳文件不在 ⇒ undetermined(不冒红也不冒绿)',
    par.rows.find((r) => r.leg === 'missingLeg' && !r.onTick)?.verdict === 'undetermined',
  )
  t(
    '㉖ constThrottleLeg(戳 30 分钟前,宽限窗 max(3×6h,2h)=18h)⇒ live',
    par.rows.find((r) => r.leg === 'constThrottleLeg' && !r.onTick)?.verdict === 'live',
  )
  t(
    '㉗ delegLeg 模板代换出的戳 10 天未动 ⇒ 进 stalled 名单',
    /delegLeg/.test(par.detail),
  )
  t(
    '㉘ 真名单为空 ⇒ idle-clean(把 main-only 调用摘掉后重测)',
    (() => {
      const only = FIX.replace(/^  frozenLeg\(\)$/gm, '')
        .replace(/^  freshLeg\(\)$/gm, '')
        .replace(/^  missingLeg\(\)$/gm, '')
        .replace(/^  constThrottleLeg\(\)$/gm, '')
        .replace(/^  throttledLeg\(\)$/gm, '')
        .replace(/^  delegLeg\(\)$/gm, '')
      const r = dispatchParityMeasure({ src: only, stateDir: parDir, nowMs: NOW })
      return r.state === 'idle-clean' && r.stock === 0
    })(),
  )
  t(
    '㉙ 枚举到 0 条带戳腿 ⇒ 判死 undetermined(§0.3,不当绿)',
    dispatchParityMeasure({ src: 'async function main() {\n}\nfunction startDaemon() {\n  const tick = () => {\n    x()\n  }\n}\n', stateDir: parDir, nowMs: NOW }).state === 'undetermined',
  )
  t(
    '㉚ 源码取不到 ⇒ undetermined(不记绿)',
    dispatchParityMeasure({ src: null, stateDir: parDir, nowMs: NOW }).state === 'undetermined',
  )
  t(
    '㉛ readStampAt 双形态:裸 ISO(.ts)与 {attemptAt}(.json)都读得出,目录/坏值 ⇒ null',
    readStampAt(path.join(parDir, 'aasa-health-tick.ts')) === NOW - 30 * 60 * 1000 &&
      readStampAt(path.join(parDir, 'frozen-last.json')) === NOW - 10 * 24 * HOUR_MS &&
      readStampAt(path.join(parDir, 'nope.json')) === null,
  )

  console.log(`自检 ${total - fails}/${total}`)
  return fails ? 1 : 0
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())
  const { overall, families } = measure()
  if (args.includes('--json')) {
    console.log(JSON.stringify({ ok: overall !== 'stalled', overall, families }, null, 1))
  } else {
    humanReport({ overall, families })
  }
  return overall === 'stalled' ? 1 : overall === 'undetermined' ? 2 : 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  verdictFor,
  readTickAt,
  readLedgerAt,
  measure,
  closedStockOf,
  claimStockOf,
  FAMILIES,
  DISPATCH_FRESH_MIN,
  SILENT_HOURS,
  FILE,
  ROOT,
  STATE_DIR,
  // 第三族 dispatch-parity(票 RP-74):切片/解析/判定全在这,镜像测试 import 本出口,零复制(§0.6/§22c)
  tickBodyOf,
  mainBodyOf,
  hasLiveCall,
  liveCallOffset,
  parseDispatchKeyTable,
  dispatchParityMeasure,
  dispatchParityFamily,
  readStampAt,
  parityThresholdMs,
  GUARDIAN_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
