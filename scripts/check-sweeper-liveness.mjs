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
 * 判什么(每族三读):派发节流台账 attemptAt(派发在不在动) / 摘除留痕台账最后一条 at(干没干成活)/
 * HEAD 面上**可清存量**(该不该有活)。三读齐了才有背离;缺任何一读 ⇒ 未判定(§0.3)。
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

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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

/** 两族配置:tick/ledger 文件名与 git-guardian 派发点、清扫器留痕点逐字一致(形状锁见测试)。
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
  const families = FAMILIES.map((fam) => {
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
  console.log('📡 清扫背离巡检(判据:派发节流在动 ∧ 留痕静默 > 2h ∧ 可清存量 > 0 ⇒ stalled)')
  for (const f of families) {
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

  // 形状锁:两族配置与守护派发点/清扫器留痕点同款(防别席删掉一格)
  t(
    '⑲ FAMILIES 恰有两族且文件名与生产端一致',
    FAMILIES.length === 2 &&
      FAMILIES[0].tick === 'plan-closed-sweep-last.json' &&
      FAMILIES[0].ledger === 'plan-row-drop.jsonl' &&
      FAMILIES[0].ledgerKind === 'stale-closed-sweep' &&
      FAMILIES[1].tick === 'stale-claim-strip-last.json' &&
      FAMILIES[1].ledger === 'stale-claim-strip.jsonl',
  )
  const src = readFileSync(path.join(ROOT, 'scripts', 'check-sweeper-liveness.mjs'), 'utf8')
  t(
    '⑳ 存量口径 import 生产实现(closedRows/claimMarks 都在用)',
    /closedRows\.buildLineLossRuler\(\)/.test(src) &&
      /closedRows\.partitionStaleByProtection\(/.test(src) &&
      /claimMarks\.planSweep\(/.test(src) &&
      /claimMarks\.planFaceBlockedBy\(/.test(src),
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
