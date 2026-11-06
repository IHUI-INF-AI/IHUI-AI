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
 * 族三 dispatch-parity(票 RP-74,2026-11-05 立)判的不是一族的空转,而是**两条执行体链是否对等**:
 *   键表(腿→tickFile→intervalMs)一律**从 scripts/git-guardian.mjs 源码现解析**(§0.6 单一真相源,
 *   本文件不写第二份清单);解析到 0 条 / 取不到源码 / 判不出两条链 ⇒ 显式未判定并点名(§0.3)。
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

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, utimesSync } from 'node:fs'
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

/* ── 第三族 dispatch-parity(票 RP-74,2026-11-05 立)─────────────────────────────
 *
 * 判什么:守护两条执行体链(一次性 main 单轮链 / daemon 常驻 tick 链)的**派发面是否对等**,
 *   以及挂在 tick 上的腿它自己的节流戳是否真在被更新。2026-11-03 事故的原形就是"腿只写在
 *   main() 上,计划任务档 00:28 被禁用后 daemon 成唯一执行体 ⇒ 该面永久不跑";11-04 把剩下的
 *   搬进 tick 之后,新的静默形态变成"挂在 tick 上、常驻进程却是旧代码 ⇒ 戳从此不动"。
 *   两型都靠人翻台账才发现不了,所以量在提交链之外的只读探针里(§12e 恒红门禁令)。
 *
 * 键表口径(§0.6 单一真相源):**从 scripts/git-guardian.mjs 源码现解析** 腿→tickFile→intervalMs,
 *   本文件不写第二份清单(写死就会与源码漂移,正是 11-03 那一病)。"B 档刻意不搬"同样不另立
 *   清单 —— 理由钉在 main 链挂点旁的 `dispatch-parity-exempt: <理由>` 标记行上,由本族现解析;
 *   标记所指的腿若已双挂,按 §0.7"豁免不再命中 ⇒ 清单腐烂"计入背离。
 *
 * 三态(与另两族同形,守护只读一个 JSON):
 *   stalled      有背离:某腿 main-only 且无标记 / tick 腿节流戳冻结 > 声明节律×PARITY_FREEZE_FACTOR
 *                / 豁免标记腐烂
 *   live         键表解析到 ≥1 条且零背离零未判定
 *   undetermined 取不到源码 / 判不出两条链 / 解析到 0 条键表(§0.3 枚举到 0 个候选不记绿),
 *                或有腿的戳形状读不出、intervalMs 解不出 ⇒ 逐条点名,不折成 0
 *
 * 取材面:工作树副本(= 守护下次加载的那一面;与同族形状锁
 *   scripts/tests/cross-end-landing-dispatch.test.mjs 头注同口径)。取不到**不回落 HEAD 面**(§0.4)。
 */
const GUARDIAN_REL = 'scripts/git-guardian.mjs'
/** 派发行的形状判据(不是腿清单):只认这些动词前缀,避开 log/status/beatRoundLock 等辅助调用。 */
const PARITY_LEG_PREFIX_RE =
  /^(audit|sweep|heal|watch|dispatch|report|rotate|refresh|scrub|reap|archive|ensure|converge|autoRegister|gc|check)[A-Z]/
const PARITY_EXEMPT_MARK = 'dispatch-parity-exempt:'
/** 「确实没有可写戳位」的具名声明:格式 `dispatch-parity-no-stamp: <腿名> <理由>`。
 *  这类腿**保持未判定**并逐条点名 —— 绝不为消未判定而硬造门限,也不折成 live(§0.3)。 */
const PARITY_NO_STAMP_MARK = 'dispatch-parity-no-stamp:'
/** 冻结倍率:腿自己声明的节律 ×3 还看不到新戳 ⇒ 承载面根本没跑到它(与 SILENT_HOURS 同族参数)。 */
const PARITY_FREEZE_FACTOR = 3
/** 承载面心跳多新才算"执行体在动":轮级锁每轮 beat 一次,30 分钟 = 连丢一整段节拍(与 DISPATCH_FRESH_MIN 同档)。 */
const CARRIER_FRESH_MIN = 30

function isCommentLine(t) {
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

/** 取两条执行体链的行区间;判不出 ⇒ null(由上层落未判定,绝不默认已对齐)。 */
function facesOf(src) {
  const lines = src.split(/\r?\n/)
  const mainStart = lines.findIndex((l) => l.startsWith('async function main()'))
  const daemonStart = lines.findIndex((l) => l.startsWith('function startDaemon'))
  if (mainStart < 0 || daemonStart < 0 || daemonStart <= mainStart) return null
  const tickStart = lines.findIndex((l, i) => i > daemonStart && l.includes('const tick = () => {'))
  if (tickStart < 0) return null
  const tick = []
  for (let i = tickStart + 1; i < lines.length; i++) {
    const l = lines[i]
    // 收口规则与镜像测试一致:列 0 的非空行即视为 startDaemon 结束(提前收口 ⇒ 少判 ⇒ 点名)
    if (l.trim() !== '' && !/^\s/.test(l)) break
    tick.push({ text: l, no: i + 1 })
  }
  const main = lines
    .slice(mainStart, daemonStart)
    .map((l, i) => ({ text: l, no: mainStart + i + 1 }))
  if (tick.length < 20 || main.length < 20) return null
  return { lines, main, tick }
}

/** 挂点旁最近一条豁免标记(往前最多 10 行;碰到另一条派发行就停,防把上层理由算到这条腿)。 */
function exemptOf(rows, idx) {
  for (let k = idx - 1; k >= Math.max(0, idx - 10); k--) {
    const t = rows[k].text.trim()
    const m = t.match(/dispatch-parity-exempt:\s*(.+)/)
    if (m) return m[1].trim()
    if (isCommentLine(t) || t === '') continue
    const d = t.replace(/^if \(!CHECK_ONLY\)\s*/, '').match(/^([A-Za-z_]\w*)\(/)
    if (d && PARITY_LEG_PREFIX_RE.test(d[1])) return null
  }
  return null
}

/** 一条链的派发面:直接形(`X()` / `if (!CHECK_ONLY) X()`)与 legThrottle 守卫形都收。
 *  同名腿可能有多个派发点(如 ensureS4u 既在 --install 分支又在巡检链),全部记入 at[],
 *  豁免判定按"任一挂点旁有标记"算 —— 只看第一处会把另一处的具名理由读成"无人裁决"。 */
function dispatchFaceOf(rows) {
  const out = new Map()
  const put = (name, no, exempt) => {
    const prev = out.get(name)
    if (!prev) out.set(name, { no, at: [no], exempt: !!exempt })
    else {
      prev.at.push(no)
      if (exempt) prev.exempt = true
    }
  }
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].text.trim()
    if (isCommentLine(t)) continue
    const direct = t.replace(/^if \(!CHECK_ONLY\)\s*/, '').match(/^([A-Za-z_]\w*)\(/)
    if (direct && PARITY_LEG_PREFIX_RE.test(direct[1])) {
      put(direct[1], rows[i].no, exemptOf(rows, i))
      continue
    }
    if (/^if \($/.test(t)) {
      for (let k = i + 1; k < Math.min(i + 14, rows.length); k++) {
        const g = rows[k].text.trim().match(/^([A-Za-z_]\w*)\(\)$/)
        if (g && PARITY_LEG_PREFIX_RE.test(g[1])) {
          put(g[1], rows[k].no, exemptOf(rows, k))
          break
        }
      }
    }
  }
  return out
}

/**
 * `.ihui-agent/state/git-guardian.lock` 的 `at=` = **取锁时刻**(lib/guardian-lock.mjs 只在
 * openSync 成功时写一次,轮次刷新不动它)。保留此读取只为"取锁时刻"这一真实语义,
 * 它不是心跳。
 * 取不到 ⇒ 'missing';解析不出 ⇒ null。
 */
export function readCarrierAt(file) {
  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch {
    return 'missing'
  }
  const m = raw.match(/^at=(.+)$/m)
  if (!m) return null
  const t = Date.parse(m[1].trim())
  return Number.isFinite(t) ? t : null
}

/**
 * 承载面心跳 = 锁文件 **mtime**(lib/guardian-lock.mjs 用 utimesSync 续约,其头注写明
 * "heartbeat 的载体是锁文件的 mtime,不是重写文件内容")。只有它证明"执行体本身在动";
 * `at=` 取锁后恒定不动,拿它当心跳会把一个正在跑的执行体永久判成"停了"。
 * 取不到 ⇒ 'missing';读不出 mtime ⇒ null。两种都由上层落未判定,不折成"承载面停了"。
 */
export function readCarrierHeartbeatMs(file) {
  try {
    return statSync(file).mtimeMs
  } catch (e) {
    return e?.code === 'ENOENT' ? 'missing' : null
  }
}

/** 顶层 `const IDENT = …`(可跨行,含 `export const` 形)的初始化式;取不到 ⇒ null。 */
function constExprOf(lines, name) {
  const re = new RegExp(`^(?:export )?const ${name} =`)
  const i = lines.findIndex((l) => re.test(l))
  if (i < 0) return null
  let acc = lines[i].replace(re, '').trim()
  for (let k = i; k < Math.min(i + 10, lines.length - 1); k++) {
    const opens = (acc.match(/\(/g) || []).length
    const closes = (acc.match(/\)/g) || []).length
    if (opens <= closes) break
    acc += ' ' + lines[k + 1].trim()
  }
  return acc
}

/** intervalMs 表达式 → 毫秒;解不出 ⇒ null(上层落未判定,不自造默认节律)。
 *  `resolveConst` 注入时,常量可跨一层 import 取(如 HOME_HEAL_MIN_INTERVAL_MS 住 lib)。 */
function resolveIntervalMs(expr, lines, depth = 0, resolveConst = null) {
  if (expr === null || expr === undefined || depth > 8) return null
  // 多行 Number( 换行形态会被拼成 "...,\n)" ⇒ 先摘掉括号尾部的悬挂逗号
  let e = String(expr)
    .trim()
    .replace(/,(\s*\))/g, '$1')
    .replace(/,$/, '')
  const coalesce = e.match(/\?\?\s*(.+)$/)
  if (coalesce) e = coalesce[1].trim()
  // `Number(a || b || 1800000)`:逐段试解,取第一个解得出的(env 名本身解不出,落到字面默认值)
  const num = e.match(/^Number\(\s*(.+?)\s*\)$/)
  if (num) {
    const parts = num[1].split('||')
    for (let i = parts.length - 1; i >= 0; i--) {
      const r = resolveIntervalMs(parts[i], lines, depth + 1, resolveConst)
      if (r !== null) return r
    }
    return null
  }
  // 纯乘式(不 eval):5 * 60 * 1000 / 6 * 60 * 60 * 1000 / 30_000 之类
  const product = e.match(/^(\d+(?:_\d+)*)(?:\s*\*\s*\d+(?:_\d+)*)+$/)
  if (product)
    return e
      .split('*')
      .map((p) => Number(p.replace(/_/g, '').trim()))
      .reduce((a, b) => a * b, 1)
  if (/^\d+(?:_\d+)*$/.test(e)) return Number(e.replace(/_/g, ''))
  const id = e.match(/^([A-Z][A-Z0-9_]*)$/)
  if (id) {
    const found = resolveConst
      ? resolveConst(id[1])
      : (() => {
          const x = constExprOf(lines, id[1])
          return x === null ? null : { expr: x, lines }
        })()
    if (found) return resolveIntervalMs(found.expr, found.lines, depth + 1, resolveConst)
    return null
  }
  return null
}

/** tickFile 表达式 → {file};模板名(逐族展开)⇒ {dynamic:true},该腿计入"无从量"而非"没跑"。 */
function resolveTickFile(expr, lines, depth = 0, resolveConst = null) {
  if (expr === null || expr === undefined || depth > 8) return null
  const e = String(expr).trim().replace(/,$/, '')
  if (/\$\{/.test(e)) return { dynamic: true }
  const id = e.match(/^([A-Z][A-Z0-9_]*)$/)
  if (id) {
    const found = resolveConst
      ? resolveConst(id[1])
      : (() => {
          const x = constExprOf(lines, id[1])
          return x === null ? null : { expr: x, lines }
        })()
    if (found) return resolveTickFile(found.expr, found.lines, depth + 1, resolveConst)
    return null
  }
  const lits = [...e.matchAll(/'([^']+)'/g)].map((m) => m[1])
  if (!lits.length) return null
  const file = lits[lits.length - 1]
  // 有扩展名 ⇒ 直接认;`join(dir, …, 'name')` 形末段即文件名(本仓若干戳位没有扩展名,不许因此判成"没戳");
  // 纯字面路径 ⇒ 取 basename。其余(三元表达式、非路径字面量)仍判不明。
  if (/\./.test(file) || /join\(/.test(e)) return { file }
  if (/[\\/]/.test(file)) return { file: file.split(/[\\/]/).pop() }
  return null
}

/** 具名 import(`import { a, b as c } from './x.mjs'`,含跨行块)的本地名 → 相对路径;按行取,不 eval。 */
function importMapOf(lines) {
  const map = new Map()
  let buf = ''
  for (const raw of lines) {
    const l = raw.trim()
    if (!buf) {
      if (!/^import\s*\{/.test(l)) continue
      buf = l
    } else buf += ' ' + l
    if (!/\}\s*from\s*'/.test(buf)) continue
    const m = buf.match(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)'/)
    if (m)
      for (const part of m[1].split(',')) {
        const t = part.trim()
        if (!t) continue
        const name = t.split(/\s+as\s+/).pop().trim()
        if (name) map.set(name, m[2])
      }
    buf = ''
  }
  return map
}

/** 从赋值式里取 `键 = 值` 的右侧:括号内逗号不算分隔,深度归零后的 `,`/`}` 收口(join(...) 不会被切坏)。 */
function assignTailOf(line, keyRe) {
  const m = keyRe.exec(line)
  if (!m) return null
  let depth = 0
  let out = ''
  for (const ch of line.slice(m.index + m[0].length)) {
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) break
      depth--
    } else if (ch === ',' && depth === 0) break
    out += ch
  }
  return out.trim()
}

/**
 * 键表:每条被派发的腿 → {tickFile, intervalMs}(函数默认值区现取,`tickFile:`/`defaultTickFile:` 传参形也算)。
 * `root` 注入时跟随具名 import 去定义所在模块取默认值(腿住 lib 的也能量),常量亦跟随一层;
 * root 缺省时只看本文件(镜像测试的夹具源码仍走老路径)。
 */
function keyTableOf(lines, legNames, { root = null } = {}) {
  const importMap = importMapOf(lines)
  const moduleCache = new Map()
  const moduleLines = (rel) => {
    if (!root || !rel || !rel.startsWith('.')) return null
    const file = path.resolve(path.join(root, 'scripts'), rel)
    if (!moduleCache.has(file)) {
      try {
        moduleCache.set(file, readFileSync(file, 'utf8').split(/\r?\n/))
      } catch {
        moduleCache.set(file, null)
      }
    }
    return moduleCache.get(file)
  }
  const resolveConst = (bodyLines) => (name) => {
    const e = constExprOf(bodyLines, name)
    if (e !== null) return { expr: e, lines: bodyLines }
    const e2 = constExprOf(lines, name)
    if (e2 !== null) return { expr: e2, lines }
    const rel = importMap.get(name)
    const ml = rel ? moduleLines(rel) : null
    if (!ml) return null
    const e3 = constExprOf(ml, name)
    return e3 === null ? null : { expr: e3, lines: ml }
  }
  const table = new Map()
  for (const name of legNames) {
    const defRe = new RegExp(`^(?:export )?function ${name}\\(`)
    let at = lines.findIndex((l) => defRe.test(l))
    let body = lines
    if (at < 0) {
      const rel = importMap.get(name)
      const ml = rel ? moduleLines(rel) : null
      const i = ml ? ml.findIndex((l) => defRe.test(l)) : -1
      if (i >= 0) {
        at = i
        body = ml
      }
    }
    if (at < 0) {
      table.set(name, { tickFile: null, intervalMs: null, hasFn: false, rawInterval: null, rawTick: null, no: null })
      continue
    }
    let intv = null
    let tick = null
    for (let k = at; k < Math.min(at + 60, body.length); k++) {
      const l = body[k]
      if (k > at) {
        if (/^(?:export )?function |^export const |^\/\*\*|^const __test__/.test(l)) break
        if (/^\}/.test(l)) break
      }
      const s = l.trim()
      if (s.startsWith('//') || s.startsWith('*')) continue
      if (tick === null) tick = assignTailOf(s, /(?:^|[,{(])\s*(?:default)?[Tt]ickFile\s*[:=]/)
      if (intv === null) intv = assignTailOf(s, /(?:^|[,{(])\s*intervalMs\s*[:=]/)
      if (tick !== null && intv !== null) break
    }
    const f = resolveTickFile(tick, body, 0, resolveConst(body))
    table.set(name, {
      tickFile: f && f.file ? f.file : null,
      dynamic: !!(f && f.dynamic),
      intervalMs: resolveIntervalMs(intv, body, 0, resolveConst(body)),
      rawInterval: intv,
      rawTick: tick,
      hasFn: true,
      no: at + 1,
    })
  }
  return table
}

/**
 * 节流戳读数,三种真实形态都吃过(ISO 文本 / epoch 毫秒 / JSON {attemptAt|at|…})。
 * 文件不在 ⇒ 'missing';形状读不出 ⇒ null。两者都由上层落未判定,**一律不折成 0**。
 */
export function readStampMs(file) {
  let raw
  try {
    raw = readFileSync(file, 'utf8').trim()
  } catch {
    return 'missing'
  }
  if (raw === '') return null
  if (/^\d{13}$/.test(raw)) return Number(raw)
  if (/^\d{10}$/.test(raw)) return Number(raw) * 1000
  const direct = Date.parse(raw)
  if (Number.isFinite(direct)) return direct
  let j
  try {
    j = JSON.parse(raw)
  } catch {
    return null
  }
  for (const k of [
    'attemptAt',
    'tickAt',
    'stampedAt',
    'at',
    'updatedAt',
    'lastRunAt',
    'lastTickAt',
    'finishedAt',
  ]) {
    // 实测本机两种形态并存:{"attemptAt":"2026-...Z"} 与 {"attemptAt":1793898937284}
    const v = j?.[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v >= 1e12 ? v : v * 1000
    const t = Date.parse(String(v ?? ''))
    if (Number.isFinite(t)) return t
  }
  const n = Number(j?.atMs ?? j?.ms ?? NaN)
  return Number.isFinite(n) ? n : null
}

/**
 * dispatch-parity 族判定(键表与读数全部现取;`root` 只为镜像测试可注入夹具)。
 * @returns {{state:string,why:string,detail:string,stock:number,stockNote:string,bits:string[],
 *            legsParsed:number,mainFace:number,tickFace:number,items:object[]}}
 */
export function dispatchParityVerdict({ nowMs = Date.now(), root = ROOT } = {}) {
  let src = null
  try {
    src = readFileSync(path.join(root, 'scripts', 'git-guardian.mjs'), 'utf8')
  } catch {
    src = null
  }
  if (typeof src !== 'string' || src === '')
    return {
      state: 'undetermined',
      why: 'guardian-source-unreadable',
      stock: 0,
      legsParsed: 0,
      mainFace: 0,
      tickFace: 0,
      bits: ['state=undetermined', `键表=取不到 ${GUARDIAN_REL}`],
      detail: `dispatch-parity 未判定:取不到 ${GUARDIAN_REL}(取不到不回落另一个面,§0.4)` +
        ' ⇒ 两条执行体链是否对等无从量,不得读成"都对齐了"',
      stockNote: '源码一条也没读到',
      items: [],
    }
  const faces = facesOf(src)
  if (!faces)
    return {
      state: 'undetermined',
      why: 'dispatch-faces-unparsed',
      stock: 0,
      legsParsed: 0,
      mainFace: 0,
      tickFace: 0,
      bits: ['state=undetermined', '键表=判不出两条链'],
      detail:
        'dispatch-parity 未判定:判不出 main() 单轮链 / daemon tick 链区段' +
        '(async function main / function startDaemon / const tick 三处形态之一变了)⇒ 不得默认已接线',
      stockNote: '两条执行体链切片失败',
      items: [],
    }
  const main = dispatchFaceOf(faces.main)
  const tick = dispatchFaceOf(faces.tick)
  const legs = [...new Set([...main.keys(), ...tick.keys()])]
  const table = keyTableOf(faces.lines, legs, { root })
  // 「无戳位」具名声明:只在源码里逐条点名,不在本文件维护名单(§0.6)。
  // 这类腿保持未判定 —— 不许为了把未判定清零去硬造一枚门限戳(§0.3)。
  const noStampOf = new Map()
  for (const l of faces.lines) {
    const at = l.indexOf(PARITY_NO_STAMP_MARK)
    if (at < 0) continue
    const m = l.slice(at + PARITY_NO_STAMP_MARK.length).trim().match(/^([A-Za-z_]\w*)\s+(.+)/)
    if (m) noStampOf.set(m[1], m[2].trim())
  }
  const pinned = legs.filter((n) => {
    const r = table.get(n)
    return r && (r.tickFile || r.dynamic || r.intervalMs !== null)
  })
  if (!legs.length || !pinned.length)
    return {
      state: 'undetermined',
      why: 'dispatch-key-table-empty',
      stock: 0,
      legsParsed: legs.length,
      mainFace: main.size,
      tickFace: tick.size,
      bits: ['state=undetermined', `键表=0 条(派发面 main=${main.size} tick=${tick.size})`],
      detail:
        `dispatch-parity 未判定:从 ${GUARDIAN_REL} 源码解析到 0 条「腿→tickFile→intervalMs」键表` +
        '(§0.3:枚举到 0 个候选判死,不记绿也不冒红)',
      stockNote: `派发面 main=${main.size} / tick=${tick.size},键表 0 条`,
      items: [],
    }
  const stateDir = path.join(root, '.ihui-agent', 'state')
  // 承载面心跳:整条执行体都不在动的时候,不许把 24 枚冻结戳逐枚算到腿头上
  // (与 verdictFor 的 'dispatch-not-moving' 同一纪律:派发层停摆另属一族,不冒名 stalled)。
  // 口径 = 锁文件 mtime(utimesSync 续约);at= 只是取锁时刻,恒不刷新,不能当心跳。
  const carrierLock = path.join(stateDir, 'git-guardian.lock')
  const carrierBeatMs = readCarrierHeartbeatMs(carrierLock)
  const carrierAgeMin = Number.isFinite(carrierBeatMs)
    ? Math.max(0, Math.round((nowMs - carrierBeatMs) / MIN_MS))
    : null
  const carrierMoving = carrierAgeMin !== null && carrierAgeMin <= CARRIER_FRESH_MIN
  const breaches = []
  const unjudged = []
  let deferred = 0
  let tickOnly = 0
  let maxFreshAgeMin = null
  for (const name of legs) {
    const onMain = main.has(name)
    const onTick = tick.has(name)
    const entry = table.get(name) ?? { tickFile: null, intervalMs: null, hasFn: false }
    if (onMain && !onTick) {
      if (main.get(name).exempt) deferred++
      else
        breaches.push({
          leg: name,
          kind: 'main-only',
          detail: `只挂一次性 main 链 @L${main.get(name).no},且挂点旁没有 ${PARITY_EXEMPT_MARK} 理由` +
            ' ⇒ 计划任务档一旦停用,这一面永久不跑(2026-11-03 事故原形)',
        })
      continue
    }
    if (onMain && onTick && main.get(name).exempt)
      breaches.push({
        leg: name,
        kind: 'exempt-stale',
        detail: `豁免标记已腐烂:该腿其实双挂,标记却还写着不搬(§0.7)—— ${main.get(name).exempt.slice(0, 70)}`,
      })
    if (!onMain && onTick) {
      // 只在 tick 上(事件驱动修复动作等)不是本次事故那一型,只报数不判背离
      tickOnly++
      continue
    }
    const noStamp = noStampOf.get(name)
    if (noStamp) {
      // 具名声明「这条腿根本没有可写周期戳的位置」:保持未判定并点名,不折成 live(§0.3)。
      unjudged.push({ leg: name, kind: 'no-stamp-slot', detail: `无戳位，判据不适用：${noStamp}` })
      continue
    }
    if (!entry.hasFn) {
      unjudged.push({ leg: name, kind: 'no-fn-body', detail: '源码里找不到该腿的函数定义 ⇒ 节律无从解析' })
      continue
    }
    if (!entry.tickFile) {
      unjudged.push({
        leg: name,
        kind: entry.dynamic ? 'tickfile-dynamic' : 'tickfile-unresolved',
        detail: entry.dynamic
          ? 'tickFile 是模板名(逐族展开),本族不按名量'
          : '函数默认值区解析不出 tickFile ⇒ 该腿无被量到的心跳凭据',
      })
      continue
    }
    if (entry.intervalMs === null) {
      unjudged.push({
        leg: name,
        kind: 'interval-unresolved',
        detail: `intervalMs 解析不出:${String(entry.rawInterval ?? '(缺省)').slice(0, 70)}`,
      })
      continue
    }
    const at = readStampMs(path.join(stateDir, entry.tickFile))
    if (at === 'missing') {
      unjudged.push({ leg: name, kind: 'stamp-missing', detail: `节流戳文件不在:${entry.tickFile}` })
      continue
    }
    if (!Number.isFinite(at)) {
      unjudged.push({ leg: name, kind: 'stamp-unparsed', detail: `节流戳形状读不出:${entry.tickFile}` })
      continue
    }
    const ageMin = Math.max(0, Math.round((nowMs - at) / MIN_MS))
    if (nowMs - at > entry.intervalMs * PARITY_FREEZE_FACTOR) {
      const freezeNote =
        `挂在 tick 上,但自己的节流戳 ${ageMin} 分钟没更新(声明节律 ${Math.round(entry.intervalMs / MIN_MS)} 分钟` +
        `×${PARITY_FREEZE_FACTOR} 预算)`
      if (!carrierMoving)
        // 承载面自己没在动 ⇒ 这一枚不算"腿背离",算"派发层停摆"(另属一族,不冒名 stalled)
        unjudged.push({
          leg: name,
          kind: 'carrier-not-moving',
          detail:
            `${freezeNote},且轮级锁心跳 ${carrierAgeMin === null ? '取不到' : `${carrierAgeMin} 分钟前`} 也未更新` +
            ' ⇒ 分不清是这一腿没被跑到还是整条执行体停了,按未判定逐条点名(§0.3)',
        })
      else
        breaches.push({
          leg: name,
          kind: 'stamp-frozen',
          detail:
            `${freezeNote} ⇒ 承载面没走到这一腿。核验两步:① 该腿在写戳之前有没有自己的挡板` +
            `(器物不在位 / disabled 档早退);② 常驻进程启动时刻是否早于该腿上 tick 的时刻`,
        })
    } else if (maxFreshAgeMin === null || ageMin > maxFreshAgeMin) maxFreshAgeMin = ageMin
  }
  const kindOf = (arr, k) => arr.filter((x) => x.kind === k).length
  const namesOf = (arr) => arr.slice(0, 6).map((x) => `${x.leg}[${x.kind}]`).join(' ')
  const state = breaches.length ? 'stalled' : unjudged.length ? 'undetermined' : 'live'
  return {
    state,
    why: breaches.length ? 'dispatch-face-diverged' : unjudged.length ? 'legs-unjudged' : 'ok',
    stock: breaches.length,
    legsParsed: legs.length,
    mainFace: main.size,
    tickFace: tick.size,
    maxFreshAgeMin,
    deferred,
    tickOnly,
    bits: [
      `state=${state}`,
      `键表=${legs.length} 条`,
      `main=${main.size} tick=${tick.size}`,
      `B档已具名豁免=${deferred}`,
      carrierAgeMin === null ? '承载面心跳=取不到' : `承载面心跳=${carrierAgeMin} 分钟前`,
      maxFreshAgeMin === null ? '最老新鲜戳=—' : `最老新鲜戳=${maxFreshAgeMin} 分钟前`,
      `无戳位具名=${kindOf(unjudged, 'no-stamp-slot')}`,
    ],
    detail:
      `腿→tickFile→intervalMs 键表 ${legs.length} 条,全部从 ${GUARDIAN_REL} 源码现解析(本文件零清单)` +
      `;背离 ${breaches.length}(main-only ${kindOf(breaches, 'main-only')}、戳冻结 ${kindOf(breaches, 'stamp-frozen')}、` +
      `豁免腐烂 ${kindOf(breaches, 'exempt-stale')});未判定 ${unjudged.length}(戳不在 ${kindOf(unjudged, 'stamp-missing')}、` +
      `形状读不出 ${kindOf(unjudged, 'stamp-unparsed')}、节律解不出 ${kindOf(unjudged, 'interval-unresolved')}、` +
      `动态戳名 ${kindOf(unjudged, 'tickfile-dynamic')}、承载面未动 ${kindOf(unjudged, 'carrier-not-moving')}、` +
      `无戳位具名 ${kindOf(unjudged, 'no-stamp-slot')})` +
      `;只挂 tick ${tickOnly}` +
      (breaches.length
        ? `;出路=main-only 那族逐条补进常驻 tick(或就地写 dispatch-parity-exempt 理由),戳冻结那一族要落到` +
          `该腿自己的调用点为何到不了(本探针只量,不重启任何服务)⇒ ${namesOf(breaches)}`
        : unjudged.length
          ? `;未判定逐条 ⇒ ${namesOf(unjudged)}`
          : ''),
    stockNote: `背离 ${breaches.length} / 未判定 ${unjudged.length}(无戳位 ${kindOf(unjudged, 'no-stamp-slot')}) / 豁免 ${deferred} / 仅 tick ${tickOnly}`,
    items: [...breaches, ...unjudged],
  }
}

/** 三族配置:前两族 tick/ledger 文件名与 git-guardian 派发点、清扫器留痕点逐字一致(形状锁见测试)。
 *  stockOf 一律收**一个 ctx 对象**(不按位置传参)—— 两族签名本就不同(closed 要基线面、
 *  claim 要 nowMs/root),按位置统一传参踩过错位(实测把 4.2MB 基线面当成 nowMs 传进
 *  claimStockOf,C3 守恒不过整族报未判定);对象传参让错位在结构上不可能发生。
 *  第三族 dispatch-parity 走 `selfVerdict`(它自己不读节流台账/留痕台账,而是现解析守护源码),
 *  所以它**没有** tick/ledger 字段 —— measure() 见到 selfVerdict 就跳过那两读,不假装有值。 */
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
    // 票 RP-74 第三族:键表不在本文件,现解析 git-guardian.mjs(§0.6),故无 tick/ledger 字段。
    id: 'dispatch-parity',
    label: '派发面双链对等',
    tick: null,
    ledger: null,
    ledgerKind: null,
    needsBase: false,
    selfVerdict: ({ nowMs, root }) => dispatchParityVerdict({ nowMs, root }),
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
 * 全量测量:HEAD/HEAD^ 面一次取回(前两族共用),逐族读 tick/ledger/存量后过 verdictFor。
 * 面取不到 ⇒ 该族存量 undetermined(§0.4:不回落另一个面),由 verdictFor 折成未判定。
 * 第三族 dispatch-parity 走 selfVerdict:它不读这两份台账,而是现解析守护源码的派发面与键表
 * (§0.6 单一真相源),因此它这一行的 tick/ledger/tickAt/ledgerAt 恒为 null —— 是"本族没有这两个
 * 输入",不是"读到了空"。
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
    if (typeof fam.selfVerdict === 'function') {
      const v = fam.selfVerdict({ nowMs, root })
      return {
        id: fam.id,
        label: fam.label,
        tick: fam.tick ?? null,
        ledger: fam.ledger ?? null,
        tickAt: null,
        ledgerAt: null,
        stock: v.stock,
        stockNote: v.stockNote ?? '',
        state: v.state,
        why: v.why,
        detail: v.detail,
        bits: v.bits,
        legsParsed: v.legsParsed ?? null,
        mainFace: v.mainFace ?? null,
        tickFace: v.tickFace ?? null,
        deferred: v.deferred ?? null,
        items: v.items ?? [],
        tickAgeMin: null,
        ledgerSilentMin: null,
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
  console.log(
    '📡 清扫背离巡检(族一二判据:派发节流在动 ∧ 留痕静默 > 2h ∧ 可清存量 > 0 ⇒ stalled;' +
      '族三 dispatch-parity 判据:守护源码现解析的双链派发面 + 腿自己声明的节律)',
  )
  for (const f of families) {
    // 族三没有"节流台账/留痕台账"这两个输入,自带六段读数(键表条数 / 两面派发面 / 豁免数 /
    // 承载面心跳 / 最老新鲜戳)—— 缺 bits 才回落默认四段,不许给族三假装有节流心跳。
    const bits = f.bits ?? [
      `state=${f.state}`,
      `存量=${f.stock ?? '未判定'}`,
      f.tickAgeMin === null ? '节流=取不到' : `节流=${f.tickAgeMin} 分钟前刚醒`,
      f.ledgerSilentMin === null ? '留痕=从未写过' : `留痕=${f.ledgerSilentMin} 分钟前刚写`,
    ]
    if (f.bits) bits.splice(1, 0, `背离=${f.stock ?? '未判定'}`)
    console.log(`  ${ICON[f.state] ?? '·'} ${f.id} ${f.label}: ${bits.join(' · ')}`)
    console.log(`     └ ${f.detail}${f.stockNote ? ` ｜ ${f.stockNote}` : ''}`)
    if (f.id === 'dispatch-parity')
      for (const it of (f.items ?? []).slice(0, 8))
        console.log(`        · ${it.leg} [${it.kind}] ${it.detail}`)
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

  // 形状锁:三族配置与前两族在生产端的 tick/ledger 文件名同款(防别席删掉一格);
  // 第三族 dispatch-parity 刻意**不带** tick/ledger(键表从 git-guardian.mjs 源码现解析,§0.6)。
  t(
    '⑲ FAMILIES 恰有三族且前两族文件名与生产端一致、第三族走 selfVerdict',
    FAMILIES.length === 3 &&
      FAMILIES[0].tick === 'plan-closed-sweep-last.json' &&
      FAMILIES[0].ledger === 'plan-row-drop.jsonl' &&
      FAMILIES[0].ledgerKind === 'stale-closed-sweep' &&
      FAMILIES[1].tick === 'stale-claim-strip-last.json' &&
      FAMILIES[1].ledger === 'stale-claim-strip.jsonl' &&
      FAMILIES[2].id === 'dispatch-parity' &&
      FAMILIES[2].tick === null &&
      FAMILIES[2].ledger === null &&
      typeof FAMILIES[2].selfVerdict === 'function' &&
      FAMILIES[2].stockOf === undefined,
  )
  const src = readFileSync(path.join(ROOT, 'scripts', 'check-sweeper-liveness.mjs'), 'utf8')
  t(
    '⑳ 存量口径 import 生产实现(closedRows/claimMarks 都在用)',
    /closedRows\.buildLineLossRuler\(\)/.test(src) &&
      /closedRows\.partitionStaleByProtection\(/.test(src) &&
      /claimMarks\.planSweep\(/.test(src) &&
      /claimMarks\.planFaceBlockedBy\(/.test(src),
  )

  // ── 第三族 dispatch-parity:键表一律现解析,夹具自证(§0.6 不许有第二份清单) ──
  const pad = (n, ind = '    ') => Array.from({ length: n }, (_, i) => `${ind}// pad ${i}`)
  const fixtureSrc = [
    'async function main() {',
    ...pad(22),
    '  if (!CHECK_ONLY) auditAlpha()',
    '  // dispatch-parity-exempt: B档夹具理由-真换口令族',
    '  if (!CHECK_ONLY) auditBeta()',
    '  if (!CHECK_ONLY) auditGamma()',
    '  return 0',
    '}',
    'function startDaemon() {',
    '  const tick = () => {',
    ...pad(24, '    '),
    '    auditAlpha()',
    '  }',
    '}',
    'const ALPHA_INTERVAL_MS = 30 * 60 * 1000',
    'export function auditAlpha(opts = {}) {',
    '  const {',
    '    now = Date.now(),',
    '    intervalMs = ALPHA_INTERVAL_MS,',
    "    tickFile = join(dirname(LOG), 'alpha-tick.json'),",
    '  } = opts',
    '}',
    'export function auditBeta(opts = {}) {',
    '  const {',
    '    intervalMs = Number(process.env.IHUI_BETA_MS || 6 * 60 * 60 * 1000),',
    "    tickFile = join(WORKTREE, '.ihui-agent', 'state', 'beta-tick.ts'),",
    '  } = opts',
    '}',
    'export function auditGamma(opts = {}) {',
    '  const {',
    '    intervalMs = 5 * 60 * 1000,',
    '  } = opts',
    '}',
  ].join('\n')
  const pdir = mkScratch('sweeper-liveness-parity-')
  try {
    mkdirSync(path.join(pdir, 'scripts'), { recursive: true })
    mkdirSync(path.join(pdir, '.ihui-agent', 'state'), { recursive: true })
    const writeGuardian = (text) =>
      writeFileSync(path.join(pdir, 'scripts', 'git-guardian.mjs'), text, 'utf8')
    const stamp = (name, ms) =>
      writeFileSync(
        path.join(pdir, '.ihui-agent', 'state', name),
        JSON.stringify({ attemptAt: new Date(ms).toISOString() }),
        'utf8',
      )
    // 锁夹具:at= 是取锁时刻(可单独指定),心跳看 mtime ⇒ 两处都必须显式给。
    const writeLock = (mtimeMs, role, atMs = mtimeMs) => {
      const f = path.join(pdir, '.ihui-agent', 'state', 'git-guardian.lock')
      writeFileSync(f, `pid=9999\nat=${new Date(atMs).toISOString()}\nrole=${role}\n`, 'utf8')
      utimesSync(f, new Date(mtimeMs), new Date(mtimeMs))
    }
    writeGuardian(fixtureSrc)
    stamp('alpha-tick.json', NOW - 4 * MIN_MS)
    // ㉒ main-only 且无标记 ⇒ 背离点名(2026-11-03 事故原形)
    let v = dispatchParityVerdict({ nowMs: NOW, root: pdir })
    t(
      '㉒ main-only 无标记 ⇒ stalled 并点名该腿',
      v.state === 'stalled' &&
        v.items.some((x) => x.leg === 'auditGamma' && x.kind === 'main-only') &&
        v.stock === 1,
      JSON.stringify({ state: v.state, stock: v.stock, items: v.items.map((x) => `${x.leg}:${x.kind}`) }),
    )
    // ㉓ 挂点旁带 dispatch-parity-exempt ⇒ 计入"B档已具名豁免",不判背离(§0.7 验过才免)
    t(
      '㉓ 带 exempt 标记的 main-only ⇒ deferred=1 且不进背离',
      v.deferred === 1 && !v.items.some((x) => x.leg === 'auditBeta' && x.kind === 'main-only'),
    )
    // ㉔ 键表三形都解析得出:CONST / Number(env||式) / 直接乘式
    const faces = facesOf(fixtureSrc)
    const table = keyTableOf(faces.lines, ['auditAlpha', 'auditBeta', 'auditGamma'])
    t(
      '㉔ 键表(腿→tickFile→intervalMs)现解析:CONST 展开 / env 兜底 / 乘式',
      table.get('auditAlpha').tickFile === 'alpha-tick.json' &&
        table.get('auditAlpha').intervalMs === 1800000 &&
        table.get('auditBeta').tickFile === 'beta-tick.ts' &&
        table.get('auditBeta').intervalMs === 21600000 &&
        table.get('auditGamma').tickFile === null &&
        table.get('auditGamma').intervalMs === 300000,
      JSON.stringify([...table.entries()]),
    )
    // ㉕ 节流戳冻结 > 声明节律×3 ⇒ stamp-frozen;刚写过 ⇒ 不点名
    //     (前提:承载面心跳在动 —— 轮级锁 1 分钟前刚 beat,否则算"整条执行体停了",另属一族)
    writeLock(NOW - MIN_MS, 'git-guardian:daemon')
    stamp('alpha-tick.json', NOW - 4 * 60 * MIN_MS)
    v = dispatchParityVerdict({ nowMs: NOW, root: pdir })
    t(
      '㉕a 承载面在动 + 戳冻结 4 小时(节律 30 分钟×3)⇒ stamp-frozen',
      v.items.some((x) => x.leg === 'auditAlpha' && x.kind === 'stamp-frozen'),
    )
    stamp('alpha-tick.json', NOW - 80 * MIN_MS)
    v = dispatchParityVerdict({ nowMs: NOW, root: pdir })
    t(
      '㉕b 戳 80 分钟前(预算 90 分钟内)⇒ 不点名该腿',
      !v.items.some((x) => x.leg === 'auditAlpha' && x.kind === 'stamp-frozen'),
    )
    // ㉛ 承载面心跳也停 ⇒ 冻结戳降级成"未判定(carrier-not-moving)",不冒名 stalled
    //     (与 verdictFor 的 dispatch-not-moving 同一纪律:派发层停摆是另一族问题)
    writeLock(NOW - 4 * HOUR_MS, 'git-guardian:round')
    stamp('alpha-tick.json', NOW - 4 * 60 * MIN_MS)
    v = dispatchParityVerdict({ nowMs: NOW, root: pdir })
    t(
      '㉛ 承载面停 4 小时 ⇒ 该腿落未判定 carrier-not-moving,不记 stalled',
      v.items.some((x) => x.leg === 'auditAlpha' && x.kind === 'carrier-not-moving') &&
        !v.items.some((x) => x.kind === 'stamp-frozen'),
      JSON.stringify(v.items.map((x) => `${x.leg}:${x.kind}`)),
    )
    // ㉛b 同源口径自证:at=(取锁时刻)停在 4 小时前,但锁 mtime 1 分钟前刚续
    //      ⇒ 执行体在动,冻结戳必须冒名 stamp-frozen,不许沿用 at= 把整条执行体判成"停了"。
    writeLock(NOW - MIN_MS, 'git-guardian:round', NOW - 4 * HOUR_MS)
    stamp('alpha-tick.json', NOW - 4 * 60 * MIN_MS)
    v = dispatchParityVerdict({ nowMs: NOW, root: pdir })
    t(
      '㉛b at= 旧但锁 mtime 新鲜 ⇒ 心跳按 mtime 算,该腿落 stamp-frozen 而非 carrier-not-moving',
      v.items.some((x) => x.leg === 'auditAlpha' && x.kind === 'stamp-frozen') &&
        !v.items.some((x) => x.kind === 'carrier-not-moving'),
      JSON.stringify(v.items.map((x) => `${x.leg}:${x.kind}`)),
    )
    writeLock(NOW - MIN_MS, 'git-guardian:daemon')
    // ㉖ 戳文件不在 ⇒ 未判定逐条(§0.3:绝不折成"没跑过所以没事")
    writeFileSync(path.join(pdir, '.ihui-agent', 'state', 'alpha-tick.json'), '{畸形', 'utf8')
    v = dispatchParityVerdict({ nowMs: NOW, root: pdir })
    t(
      '㉖ 戳形状读不出 ⇒ 该腿未判定并点名',
      v.items.some((x) => x.leg === 'auditAlpha' && x.kind === 'stamp-unparsed'),
    )
    // ㉗ 取不到源码 ⇒ 未判定并点名文件(不回落另一个面)
    const emptyDir = mkScratch('sweeper-liveness-noguard-')
    try {
      const nv = dispatchParityVerdict({ nowMs: NOW, root: emptyDir })
      t(
        '㉗ 取不到 git-guardian.mjs ⇒ undetermined 且点名文件',
        nv.state === 'undetermined' &&
          nv.why === 'guardian-source-unreadable' &&
          nv.detail.includes('scripts/git-guardian.mjs'),
      )
    } finally {
      rmScratch(emptyDir, { bestEffort: true })
    }
    // ㉘ 解析到 0 条键表 ⇒ 未判定(§0.3:枚举到 0 个候选判死不记绿)
    writeGuardian(['async function main() {', ...pad(24), '  return 0', '}', 'function startDaemon() {', ...pad(24, '  '), '}'].join('\n'))
    v = dispatchParityVerdict({ nowMs: NOW, root: pdir })
    t(
      '㉘ 判不出两条链 ⇒ undetermined(dispatch-faces-unparsed)',
      v.state === 'undetermined' && v.why === 'dispatch-faces-unparsed',
      JSON.stringify({ state: v.state, why: v.why }),
    )
    writeGuardian(
      [
        'async function main() {',
        ...pad(22),
        '  if (!CHECK_ONLY) auditDelta()',
        '  return 0',
        '}',
        'function startDaemon() {',
        '  const tick = () => {',
        ...pad(24, '    '),
        '    auditDelta()',
        '  }',
        '}',
        'export function auditDelta(opts = {}) {',
        '  const { logger = log } = opts',
        '}',
      ].join('\n'),
    )
    v = dispatchParityVerdict({ nowMs: NOW, root: pdir })
    t(
      '㉙ 有派发但键表 0 条 ⇒ undetermined(dispatch-key-table-empty),不记绿',
      v.state === 'undetermined' && v.why === 'dispatch-key-table-empty',
      JSON.stringify({ state: v.state, why: v.why }),
    )
    // ㉚ 真源码读数:本仓必须解析出 >0 条键表(否则上面的自证全是夹具自证)
    const real = dispatchParityVerdict({ nowMs: Date.now(), root: ROOT })
    t(
      '㉚ 真源码现解析:键表 >0 条且 main/tick 两面都非空',
      real.legsParsed > 0 && real.mainFace > 0 && real.tickFace > 0 && real.items.length >= 0,
      JSON.stringify({ legs: real.legsParsed, main: real.mainFace, tick: real.tickFace }),
    )
  } finally {
    rmScratch(pdir, { bestEffort: true })
  }

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
  // 第三族 dispatch-parity(票 RP-74):键表解析与判定一律走这里,测试不得另写一份(§22c)
  dispatchParityVerdict,
  facesOf,
  dispatchFaceOf,
  keyTableOf,
  constExprOf,
  resolveIntervalMs,
  resolveTickFile,
  readStampMs,
  readCarrierAt,
  readCarrierHeartbeatMs,
  PARITY_FREEZE_FACTOR,
  CARRIER_FRESH_MIN,
  PARITY_EXEMPT_MARK,
  PARITY_LEG_PREFIX_RE,
  GUARDIAN_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
