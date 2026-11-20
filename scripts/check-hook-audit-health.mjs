#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-hook-audit-health.mjs — 钩子审计台账健康只读哨兵(运维尺子,不接任何提交链)
 *
 * ## 为什么要有这把尺子
 *
 * 第 39/41 项把 `hook.run` 写进 `.ihui-agent/state/hook-audit.jsonl`;第 44/45/49 项把
 * 「截断 / 只剩备份 / 容量占比」搬进了面板读数。但面板只在**有人打开会话**时才看一眼 ——
 * 台账到 5MB 轮转时 `.1` 会被下一次轮转直接覆盖,这段历史永久消失,而"没有人在看"正是
 * 它消失的唯一原因。本尺子把同一批事实搬到守护侧:容量、轮转备份、坏行、失败率。
 *
 * ## 判据来源与"单一真相源"(§0.6)
 *
 * - 上限 `HOOK_AUDIT_MAX_BYTES` **不抄数字**:从 Python 侧唯一源头
 *   `apps/ai-service/app/core/hook_audit.py` 里现读该常量的字面表达式(只接受
 *   `数字 * 数字 * …` 形态)。读不到 ⇒ exit 2 未判定,绝不回落到硬编码 5MB。
 * - 台账路径同源:env `IHUI_HOOK_AUDIT_PATH` 优先(与该 Python 函数同一口径),
 *   缺省 `<repo>/.ihui-agent/state/hook-audit.jsonl`。
 *
 * ## 三态与退出码(对齐 §0.3)
 *
 * - `absent`  :台账还不存在(= 一次钩子都没跑过,合法形态)⇒ exit 0,不记绿也不冒红。
 * - `healthy` :有台账、容量宽松、无坏行、失败率未越线 ⇒ exit 0。
 * - `warn`    :容量 ≥90%(轮转就会覆盖唯一备份)、有坏行、近期失败率越线 ⇒ exit 1。
 * - `undetermined`:常量或台账取不到 ⇒ exit 2,点名原因,不冒充通过。
 *
 * ## 阈值为什么是这几个
 *
 * - 90% 与前端 `HookReadout.nearFullPct` 同一个档(§0.6 不另立第二套百分比口径)——
 *   两处读数若不同档,面板说"还早"而守护说"快满了",人就再也不信任何一处。
 * - 失败率:取**最近 50 条**、`error+timeout ≥ 30%` 且至少 5 条失败才报。单条失败是
 *   钩子该有的行为(命令跑挂了就该红);只有"近一半都在挂"才值得到人。这也是不出
 *   邮件告警的理由:本尺子是守护侧读数,红了人的动作是"去看哪条钩子在挂",不是运维故障。
 */
import { readFileSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = dirname(HERE)
const PY_SOURCE = join(REPO, 'apps/ai-service/app/core/hook_audit.py')
const NEAR_FULL_PCT = 90
const FAIL_RATE_WINDOW = 50
const FAIL_RATE_MIN_EVENTS = 5

/** 从 Python 源头现读上限;不可读/形态不认识 ⇒ null(调用方判"未判定") */
export function readCapFromSource(srcText) {
  const m = /^HOOK_AUDIT_MAX_BYTES[^\n=]*=\s*(\d+(?:\s*\*\s*\d+)+)\s*$/m.exec(srcText)
  if (!m) return null
  const parts = m[1].split('*').map((s) => Number(s.trim()))
  if (parts.some((n) => !Number.isFinite(n) || n <= 0)) return null
  return parts.reduce((a, b) => a * b, 1)
}

/** 台账路径:env 优先,与 Python 的 hook_audit_path() 同口径 */
export function resolveLedgerPath(env = process.env) {
  const override = (env.IHUI_HOOK_AUDIT_PATH || '').trim()
  if (override) return override
  return join(REPO, '.ihui-agent/state/hook-audit.jsonl')
}

/**
 * 读台账并算读数。台账不存在 ⇒ {state:'absent'}。
 * 坏行不折 0:逐行 JSON 解析失败的行单独计数(它们是"已经写进去但读不出来"的事件)。
 */
export function readLedger(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    if (err && err.code === 'ENOENT') return { state: 'absent' }
    return { state: 'undetermined', reason: `台账读不到:${err instanceof Error ? err.message : String(err)}` }
  }
  let sizeBytes
  try {
    sizeBytes = statSync(path).size
  } catch (err) {
    return { state: 'undetermined', reason: `台账 stat 失败:${err instanceof Error ? err.message : String(err)}` }
  }
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '')
  const badLines = []
  const events = []
  lines.forEach((line, idx) => {
    try {
      const obj = JSON.parse(line)
      events.push(obj && typeof obj === 'object' ? obj : null)
      if (!obj || typeof obj !== 'object') badLines.push(idx + 1)
    } catch {
      badLines.push(idx + 1)
    }
  })
  const backupPath = `${path}.1`
  let backup = null
  try {
    const st = statSync(backupPath)
    backup = { bytes: st.size, mtimeMs: st.mtimeMs }
  } catch {
    backup = null
  }
  return { state: 'ok', sizeBytes, events, badLines, lines, backup }
}

/** 近窗失败率:只看能读出 status 的事件 */
export function failRate(events, window = FAIL_RATE_WINDOW) {
  const tail = events
    .filter((e) => e && typeof e.status === 'string')
    .slice(-window)
  const total = tail.length
  const failed = tail.filter((e) => e.status === 'error' || e.status === 'timeout').length
  return { total, failed, ratio: total === 0 ? 0 : failed / total }
}

/** 汇总判定;纯函数,便于自检 */
export function judge(ledger, capBytes) {
  if (!capBytes || !Number.isFinite(capBytes)) {
    return { state: 'undetermined', reasons: ['上限常量取不到(Python 源头未读或形态不认识)'] }
  }
  if (ledger.state === 'absent') return { state: 'absent', reasons: [] }
  if (ledger.state === 'undetermined') return { state: 'undetermined', reasons: [ledger.reason] }
  const reasons = []
  const pct = ledger.sizeBytes / capBytes
  if (pct >= NEAR_FULL_PCT / 100) {
    reasons.push(
      `容量 ${Math.min(100, Math.round(pct * 100))}% (${ledger.sizeBytes}/${capBytes} 字节):到 100% 就轮转,` +
        `下一次轮转会覆盖唯一备份 ${ledger.backup ? `(当前 .1 有 ${ledger.backup.bytes} 字节)` : '(.1 尚不存在)'}` +
        ' ⇒ 需要保留的历史先另存一份,或调大 IHUI_HOOK_AUDIT_PATH 所在盘的上限常量',
    )
  }
  if (ledger.badLines.length > 0) {
    reasons.push(
      `有 ${ledger.badLines.length} 行读不出 JSON(行号 ${ledger.badLines.slice(0, 5).join('/')}` +
        `${ledger.badLines.length > 5 ? '…' : ''}):写盘被中断或并发追加撕裂 ⇒ 这些事件在审计读数里静默丢失`,
    )
  }
  const fr = failRate(ledger.events)
  if (fr.total > 0 && fr.failed >= FAIL_RATE_MIN_EVENTS && fr.ratio >= 0.3) {
    reasons.push(
      `最近 ${fr.total} 条里失败 ${fr.failed} 条(${Math.round(fr.ratio * 100)}%):先按 ` +
        '`summarize` 的 slowest/lastTs 定位是哪条钩子,再决定修挂掉的那条还是放宽超时',
    )
  }
  return { state: reasons.length > 0 ? 'warn' : 'healthy', reasons }
}

function report(verdict, ledger, capBytes) {
  const head = `[hook-audit-health] 结论 ${verdict.state}`
  const facts = []
  if (ledger && ledger.state === 'ok') {
    facts.push(
      `台账 ${ledger.sizeBytes} 字节 / 上限 ${capBytes} 字节 / ${ledger.lines} 行 / 备份 ${ledger.backup ? ledger.backup.bytes + ' 字节' : '无'}`,
    )
  } else if (ledger && ledger.state === 'absent') {
    facts.push('台账尚未建立(一次钩子都没跑过,不算故障)')
  }
  for (const r of verdict.reasons) facts.push(`  - ${r}`)
  console.log([head, ...facts].join('\n'))
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-hook-audit-health-'))
  const cases = []
  const push = (name, ok, extra = '') => cases.push({ name, ok, extra })
  try {
    const cap = readCapFromSource('HOOK_AUDIT_MAX_BYTES: Final = 5 * 1024 * 1024\n')
    push('自检1:常量现读 = 5242880', cap === 5242880, String(cap))
    push('自检2:畸形常量不猜(返回 null)', readCapFromSource('HOOK_AUDIT_MAX_BYTES: Final = 5MB\n') === null)

    const absent = judge({ state: 'absent' }, cap)
    push('自检3:台账不存在 ⇒ absent 且零理由', absent.state === 'absent' && absent.reasons.length === 0)

    const p = join(dir, 'audit.jsonl')
    writeFileSync(p, '{"name":"a","status":"ok"}\n{"name":"b","status":"ok"}\n', 'utf8')
    const small = judge(readLedger(p), cap)
    push('自检4:小台账 ⇒ healthy', small.state === 'healthy', small.state)

    // 95% 容量:用 padding 撑出字节数,再问判定是否报近满
    const big = join(dir, 'big.jsonl')
    const pad = 'x'.repeat(Math.floor(cap * 0.95))
    writeFileSync(big, `{"name":"pad","status":"ok","note":"${pad}"}\n`, 'utf8')
    const near = judge(readLedger(big), cap)
    push('自检5:≥90% ⇒ warn 且给下一步', near.state === 'warn' && /另存|上限常量/.test(near.reasons.join('')))

    const bad = join(dir, 'bad.jsonl')
    writeFileSync(bad, '{"a":1}\n{not json}\n', 'utf8')
    const corrupt = judge(readLedger(bad), cap)
    push('自检6:坏行 ⇒ warn 且点名行号', corrupt.state === 'warn' && /第|行读不出/.test(corrupt.reasons.join('')))

    const failing = join(dir, 'fail.jsonl')
    const rows = []
    for (let i = 0; i < 20; i += 1) rows.push(JSON.stringify({ name: 'h', status: i % 2 === 0 ? 'error' : 'ok' }))
    writeFileSync(failing, rows.join('\n') + '\n', 'utf8')
    const fr = failRate(readLedger(failing).events)
    push('自检7:失败率窗内计 20 条 10 条失败', fr.total === 20 && fr.failed === 10, JSON.stringify(fr))

    push('自检8:上限取不到 ⇒ undetermined', judge({ state: 'absent' }, null).state === 'undetermined')
    push('自检9:env 覆盖生效', resolveLedgerPath({ IHUI_HOOK_AUDIT_PATH: 'D:/x/y.jsonl' }) === 'D:/x/y.jsonl')
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* 临时目录清理失败不影响判定 */
    }
  }
  const failed = cases.filter((c) => !c.ok)
  for (const c of cases) console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.extra ? ` (${c.extra})` : ''}`)
  if (failed.length > 0) {
    console.log(`❌ 自检失败 ${failed.length}/${cases.length}`)
    return 1
  }
  console.log(`✅ 自检通过 ${cases.length}/${cases.length}`)
  return 0
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  let capBytes = null
  try {
    capBytes = readCapFromSource(readFileSync(PY_SOURCE, 'utf8'))
  } catch {
    capBytes = null
  }
  const ledger = readLedger(resolveLedgerPath())
  const verdict = judge(ledger, capBytes)
  report(verdict, ledger, capBytes)
  if (verdict.state === 'undetermined') {
    console.error('[hook-audit-health] ⓘ 未判定(exit 2):' + verdict.reasons.join(';'))
    return 2
  }
  if (verdict.state === 'warn') return 1
  return 0
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()
if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
