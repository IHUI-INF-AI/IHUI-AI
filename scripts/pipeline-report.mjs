#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * pipeline-report.mjs —— 派单面「供票漏斗」只读读数(2026-11-26 立)
 *
 * 立因(台账实证,不是感觉):
 *   - `auto-evolve-ledger.jsonl` 1463 行里 `session-ok` 只有 12 行,最近一次停在 11-05;
 *   - 近 7 天 155 行:no-whitelist-hit 62 / budget-exhausted 42 / dispatched 8 / session-ok 0;
 *   - 同日 `plan-tasks --open --dispatchable --json` 的 HEAD 面只剩 1 张(R8,不属任何白名单档)。
 *   三件事拼起来说明**不是 Agent 不够,是票源枯竭** —— 这正是原文里"按 lane 供票、按缺口补组"
 *   那一格最容易被忽略的前提:没有票,控制器只能让全组空转。
 *
 * 本器只读,不派单、不改台账、不猜"应该有多少票":
 *   可派(此刻) = plan-tasks 的 `--open --dispatchable` 真出单面(HEAD 与工作树两面分开报,
 *                因为工作树里可能躺着尚未落账的新票,混成一面就是两份尺子);
 *   已派 = 台账 dispatched;成品 = 台账 session-ok;
 *   供给断档/白名单未命中/预算耗尽 = 台账对应 action 的条数;
 *   lane 缺口 = 按票面文本归类,逐 lane 报"可派/在飞/近 7 天成品",让"哪一组没票"一眼可见。
 *
 * 用法:
 *   node scripts/pipeline-report.mjs                 # 人读
 *   node scripts/pipeline-report.mjs --days=7 --json # 机读
 *   node scripts/pipeline-report.mjs --self-test     # 纯函数形状锁
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const LEDGER = path.join(ROOT, '.ihui-agent', 'state', 'auto-evolve-ledger.jsonl')
export const PLAN_TASKS = path.join(ROOT, 'scripts', 'plan-tasks.mjs')

/** 票面归类:只认文本里的稳定关键词,不猜语义;一条票可以同时落多 lane(照实报)。 */
export const LANE_RULES = [
  { lane: '文档', re: /文档|README|AGENTS|指南|说明|注释/ },
  { lane: '国际化', re: /i18n|国际化|多语言|翻译/ },
  { lane: '测试', re: /测试|用例|覆盖|回归|镜像/ },
  { lane: '性能', re: /性能|耗时|延迟|p95|p99|吞吐|内存|卡顿/ },
  { lane: '安全', re: /安全|越权|鉴权|密钥|注入|审计|风控/ },
  { lane: 'API', re: /API|接口|路由|后端|api/ },
  { lane: 'Web', re: /Web|Browser|前端|页面|组件|样式|web/ },
  { lane: 'AI', re: /AI|模型|提示词|推理|评测|Agent|agent/ },
  { lane: '小程序', re: /小程序|miniapp|微信/ },
  { lane: 'RN', re: /RN|React Native|移动端|App/ },
  { lane: '桌面', re: /桌面|desktop|Electron|安装包/ },
  { lane: 'CLI', re: /CLI|命令行|脚本/ },
  { lane: '基础设施', re: /部署|CI|构建|数据库|迁移|缓存|Redis|Postgres/ },
]

export function classifyLanes(text) {
  const lanes = []
  for (const rule of LANE_RULES) if (rule.re.test(String(text ?? ''))) lanes.push(rule.lane)
  return lanes.length > 0 ? lanes : ['未归类']
}

/**
 * 台账汇总:只数 action,不做"健康/不健康"的价值判断。
 * `now` 显式传入(测试可复现);窗口按 UTC 毫秒算。
 */
export function summarizeLedger(rows, { days = 7, now = Date.now() } = {}) {
  const cutoff = now - days * 24 * 60 * 60 * 1000
  const recent = rows.filter((r) => {
    const t = Date.parse(r?.ts ?? '')
    return Number.isFinite(t) && t >= cutoff
  })
  const count = (list, action) => list.filter((r) => r.action === action).length
  let lastOk = null
  for (const r of rows) {
    if (r.action !== 'session-ok') continue
    const t = Date.parse(r.ts ?? '')
    if (!Number.isFinite(t)) continue
    if (!lastOk || t > lastOk.t) lastOk = { t, iso: new Date(t).toISOString(), ticket: r.ticketKey ?? r.ticket ?? null }
  }
  return {
    total: rows.length,
    windowDays: days,
    windowRows: recent.length,
    dispatched: count(recent, 'dispatched'),
    sessionOk: count(recent, 'session-ok'),
    noWhitelistHit: count(recent, 'no-whitelist-hit'),
    budgetExhausted: count(recent, 'budget-exhausted'),
    supplyStall: count(recent, 'supply-stall-round'),
    runnerUnavailable: count(recent, 'runner-unavailable') + count(recent, 'session-failed'),
    // 落地漏斗(2026-11-26 补):原文说"合并是最难维持的一环"在本仓的对应读数 ——
    // 实测 172 次 dispatch、12 次 session-ok、0 次 artifact-committed;只报"派了多少"会把这条藏掉。
    committed: count(recent, 'artifact-committed'),
    manifestMissing: count(recent, 'artifact-manifest-missing'),
    manifestInvalid: count(recent, 'artifact-manifest-invalid'),
    manifestStale: count(recent, 'artifact-manifest-stale'),
    commitFailed: count(recent, 'artifact-commit-failed'),
    sessionNoWrite: count(recent, 'session-no-write'),
    sessionNoProgress: count(recent, 'session-no-progress'),
    lastSessionOk: lastOk,
  }
}

/** plan-tasks --json 的输出 → 漏斗四格;缺字段一律报 null,不拿 0 冒充"没有"。 */
export function funnelFromPlan(json) {
  const c = json?.counts ?? {}
  return {
    face: json?.face ?? null,
    open: Number.isFinite(c.open) ? c.open : null,
    unclaimed: Number.isFinite(c.unclaimed) ? c.unclaimed : null,
    claimed: Number.isFinite(c.claimed) ? c.claimed : null,
    actionable: Number.isFinite(c.dispActionable) ? c.dispActionable : null,
    waitingHuman: Number.isFinite(c.dispWaitingHuman) ? c.dispWaitingHuman : null,
    waitingEnv: Number.isFinite(c.dispWaitingEnv) ? c.dispWaitingEnv : null,
    ownedElsewhere: Number.isFinite(c.dispOwnedElsewhere) ? c.dispOwnedElsewhere : null,
    rows: Array.isArray(json?.open) ? json.open.map((r) => ({ line: r.line ?? null, text: String(r.text ?? '') })) : [],
  }
}

function runPlanTasks(extra) {
  const out = execFileSync(process.execPath, [PLAN_TASKS, '--open', '--dispatchable', ...extra, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120000,
  })
  return JSON.parse(out)
}

function readLedger() {
  if (!existsSync(LEDGER)) return null
  const rows = []
  for (const line of readFileSync(LEDGER, 'utf8').split('\n')) {
    const s = line.trim()
    if (!s) continue
    try {
      const row = JSON.parse(s)
      if (row && typeof row === 'object') rows.push(row)
    } catch {
      // 坏行不猜:计数里没有它,但不阻止其余行;真跑判据在 auto-evolve,不在这份只读报表。
    }
  }
  return rows
}

export function buildReport({ days = 7, now = Date.now() } = {}) {
  const head = funnelFromPlan(runPlanTasks([]))
  const worktree = funnelFromPlan(runPlanTasks(['--worktree']))
  const ledgerRows = readLedger()
  if (!ledgerRows) return { head, worktree, ledger: null, lanes: [], error: `台账不存在:${LEDGER}` }

  const ledger = summarizeLedger(ledgerRows, { days, now })
  const seen = new Set()
  const lanes = []
  for (const face of [head, worktree]) {
    for (const row of face.rows) {
      const key = row.text.trim()
      if (seen.has(key)) continue
      seen.add(key)
      lanes.push({ line: row.line, face: face.face, text: key, lanes: classifyLanes(key) })
    }
  }
  return { head, worktree, ledger, lanes, error: null }
}

export function render(report) {
  const out = []
  const l = report.ledger
  out.push('派单面供票漏斗(只读;HEAD 与工作树两面分开报,不混成一面)')
  out.push('')
  for (const [label, f] of [
    ['HEAD', report.head],
    ['工作树', report.worktree],
  ]) {
    out.push(
      `${label}: 可派=${f.actionable ?? '?'} 无人认领=${f.unclaimed ?? '?'} 在飞=${f.claimed ?? '?'} ` +
        `等人=${f.waitingHuman ?? '?'} 等环境=${f.waitingEnv ?? '?'} 他处在飞=${f.ownedElsewhere ?? '?'} 出单行=${f.rows.length}`,
    )
  }
  if (!l) {
    out.push('', `台账:${report.error}`)
    return out.join('\n')
  }
  out.push(
    '',
    `台账全量=${l.total} 行;近 ${l.windowDays} 天=${l.windowRows} 行`,
    `  供票→派发:可派见上;已派=${l.dispatched}`,
    `  派发→产出:session-ok=${l.sessionOk}(no-write=${l.sessionNoWrite} no-progress=${l.sessionNoProgress})`,
    `  产出→落账:artifact-committed=${l.committed}(清单缺=${l.manifestMissing} 清单坏=${l.manifestInvalid} 清单旧=${l.manifestStale} 提交失败=${l.commitFailed})`,
    `  中断:白名单未命中=${l.noWhitelistHit} 供给断档=${l.supplyStall} 预算耗尽=${l.budgetExhausted} 执行体故障=${l.runnerUnavailable}`,
    `  最近一次成品:${l.lastSessionOk ? `${l.lastSessionOk.iso}${l.lastSessionOk.ticket ? `(${l.lastSessionOk.ticket})` : ''}` : '从未'}`,
  )
  const rate = (num, den) => (den > 0 ? `${num}/${den} = ${((num / den) * 100).toFixed(1)}%` : '无分母')
  out.push(
    `  产出率:${rate(l.sessionOk, l.dispatched)}`,
    `  落账率:${rate(l.committed, l.sessionOk)}(占派发:${rate(l.committed, l.dispatched)})`,
  )
  if (report.lanes.length > 0) {
    out.push('', '在册票的 lane 归类(同一票可落多 lane,照实报):')
    for (const row of report.lanes) {
      out.push(`  L${row.line ?? '?'} [${row.lanes.join('/')}] ${row.text.slice(0, 90)}`)
    }
  }
  out.push('')
  out.push('读法:可派=0 时,再高的并发也只是空转;先补票源,再谈扩容。')
  return out.join('\n')
}

function selfTest() {
  const fails = []
  const check = (cond, msg) => {
    if (!cond) fails.push(msg)
  }
  const rows = [
    { ts: '2026-11-26T01:00:00.000Z', action: 'dispatched' },
    { ts: '2026-11-26T01:10:00.000Z', action: 'session-failed' },
    { ts: '2026-11-26T01:20:00.000Z', action: 'session-ok' },
    { ts: '2026-11-19T01:20:00.000Z', action: 'session-ok' },
    { ts: 'not-a-time', action: 'dispatched' },
  ]
  const now = Date.parse('2026-11-26T02:00:00.000Z')
  const s = summarizeLedger(rows, { days: 7, now })
  check(s.windowRows === 3, '窗口应只数近 7 天 3 行')
  check(s.dispatched === 1 && s.sessionOk === 1 && s.runnerUnavailable === 1, 'action 计数错误')
  check(s.lastSessionOk?.iso === '2026-11-26T01:20:00.000Z' && s.lastSessionOk?.ticket === null, '最近成品应取最新一条')
  const f = funnelFromPlan({ counts: { open: 1, dispActionable: 0 }, open: [{ line: 8, text: 'R8 真实回归' }] })
  check(f.actionable === 0 && f.rows.length === 1, 'plan-tasks 漏斗映射错误')
  const lanes = classifyLanes('R8 真实 Browser Hub 会话回归')
  check(lanes.includes('Web'), 'lane 归类应识别 Browser Hub 为 Web')
  const bad = funnelFromPlan({})
  check(bad.open === null && bad.rows.length === 0, '缺字段应报 null 而不是 0')

  if (fails.length > 0) {
    console.log('[SELF-TEST FAIL]')
    for (const f of fails) console.log('  ✗', f)
    return 2
  }
  console.log('[SELF-TEST PASS] 台账窗口/漏斗映射/lane 归类 形状锁通过(零网络)。')
  return 0
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const daysArg = argv.find((a) => a.startsWith('--days='))
  const days = daysArg ? Number(daysArg.split('=')[1]) : 7
  if (!Number.isFinite(days) || days <= 0) {
    console.error('--days 必须是正整数')
    return 2
  }
  const report = buildReport({ days })
  if (argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
  else console.log(render(report))
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
