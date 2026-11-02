// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * verify-guardian-mutex.mjs —— 双跑互斥的验收尺子(2026-11-02 立)。
 *
 * 只读:不建锁、不删锁、不发信、不重启服务、不改任何状态文件。
 * 它回答四件事,每件都必须能在改动前后复跑对账:
 *   ① 现在有几个 git-guardian 载体进程(daemon / 计划任务轮次)、源码是否已接轮级锁;
 *   ② 24h 日志里「同一分钟同语义」重复多少组、多少条多余,✅/❌ 严格口径多少;
 *   ③ 24h 日志里「幻影漂移对齐」相邻间隔 < 60s 的重复有几组(写索引被双跑的证据);
 *   ④ `mail-send-ledger.jsonl` 里同一 alertId 在 4h 内 delivered 超过 1 条的组数与最多条数。
 *
 * 用法:
 *   node scripts/verify-guardian-mutex.mjs                 # 人读基线
 *   node scripts/verify-guardian-mutex.mjs --json          # 机器可读(验收流水线用)
 *   node scripts/verify-guardian-mutex.mjs --window-hours 24 --align-gap-ms 60000 --dedupe-hours 4
 *
 * 退出码:0 = 量到了(不代表通过);1 = 关键输入读不到(日志/台账缺失),结论不可用。
 * 通过与否由调用方按 `verdict` 判:只有 `single-run-clean` 或 `mutex-effective` 才算绿。
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { inspectGuardianLock } from './lib/guardian-lock.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STATE = join(ROOT, '.ihui-agent', 'state')
const LOG_FILE = join(STATE, 'git-guardian.log')
const PID_FILE = join(STATE, 'git-guardian.pid')
const LEDGER_FILE = join(STATE, 'mail-send-ledger.jsonl')
const LOCK_FILE = join(STATE, 'git-guardian.lock')
const GUARDIAN_SRC = join(ROOT, 'scripts', 'git-guardian.mjs')

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const windowHours = Number(opt('--window-hours') ?? 24)
const alignGapMs = Number(opt('--align-gap-ms') ?? 60_000)
const dedupeHours = Number(opt('--dedupe-hours') ?? 4)

function opt(name) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}

const nowMs = Date.now()
const sinceMs = nowMs - windowHours * 3_600_000

function readText(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch (e) {
    return { error: `${e?.code ?? 'unknown'} ${e?.message ?? e}` }
  }
}

function parseLogRows(text, since) {
  const rows = []
  const re = /^\[(\d{4}-\d{2}-\d{2}T[^\]]+)\] (.+)$/
  for (const line of String(text).split(/\r?\n/)) {
    const m = re.exec(line)
    if (!m) continue
    const ts = Date.parse(m[1])
    if (!Number.isFinite(ts) || ts < since) continue
    rows.push({ ts, iso: m[1], msg: m[2], line })
  }
  return rows
}

/**
 * 语义归一:数字/hex/时间戳/盘符路径都折叠成占位符。
 * 不折叠的话「已持续 0 分钟」「已持续 1 分钟」会被当成两条不同结论 —— 同一件事刷两行正是要抓的。
 */
function normalizeMessage(msg) {
  return String(msg)
    .replace(/\b\d{4}-\d{2}-\d{2}T[0-9:.]+Z\b/g, '<ts>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
    .replace(/\b[0-9a-f]{7,40}\b/gi, '<hex>')
    .replace(/[A-Za-z]:\\[^\s,;()]+/g, '<path>')
    .replace(/\b\d+(?:\.\d+)?(?:ms|s|分钟|小时|秒)?\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
}

function severityOf(msg) {
  const m = /^(✅|❌|ℹ️|⚠️|❓|🚀|🛑|📌)/u.exec(msg)
  return m ? m[1] : '·'
}

function groupBy(rows, keyOf) {
  const map = new Map()
  for (const r of rows) {
    const k = keyOf(r)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(r)
  }
  return map
}

function duplicateStats(rows, { onlyStrict = false, withinMs = 60_000 } = {}) {
  const filtered = onlyStrict ? rows.filter((r) => /^[✅❌]/u.test(r.msg)) : rows
  const groups = []
  // 同分钟 = 同一自然分钟;withinMs 口径用于"同一时刻两轮"的更宽判据。
  const map = new Map()
  for (const r of filtered) {
    const bucket = withinMs === 60_000 ? Math.floor(r.ts / 60_000) : Math.floor(r.ts / withinMs)
    const key = `${bucket}|${severityOf(r.msg)}|${normalizeMessage(r.msg)}`
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(r)
  }
  for (const [key, list] of map) {
    if (list.length <= 1) continue
    groups.push({
      key,
      count: list.length,
      extras: list.length - 1,
      first: list[0],
      second: list[1],
      gapMs: list[1].ts - list[0].ts,
    })
  }
  groups.sort((a, b) => b.extras - a.extras || a.gapMs - b.gapMs)
  return {
    groups: groups.length,
    extras: groups.reduce((n, g) => n + g.extras, 0),
    top: groups.slice(0, 5),
  }
}

function alignRepeats(rows, gapMs) {
  const hits = rows.filter((r) => r.msg.includes('幻影漂移对齐'))
  const pairs = []
  for (let i = 1; i < hits.length; i += 1) {
    const gap = hits[i].ts - hits[i - 1].ts
    if (gap >= 0 && gap < gapMs) pairs.push({ gapMs: gap, first: hits[i - 1], second: hits[i] })
  }
  pairs.sort((a, b) => a.gapMs - b.gapMs)
  return { count: hits.length, repeatPairs: pairs.length, pairs: pairs.slice(0, 5) }
}

function ledgerStats(text, hours) {
  const rows = []
  for (const line of String(text).split(/\r?\n/)) {
    const s = line.trim()
    if (s === '') continue
    try {
      const o = JSON.parse(s)
      if (o?.disposition !== 'delivered') continue
      const alertId = String(o.alertId ?? '').trim()
      if (alertId === '') continue
      const ts = Date.parse(o.at)
      if (!Number.isFinite(ts)) continue
      rows.push({ ts, at: o.at, alertId, source: o.source ?? '', subject: o.subject ?? '' })
    } catch {
      /* 坏行不参与统计;总数单独报 */
    }
  }
  const byId = groupBy(rows, (r) => r.alertId)
  const violations = []
  const windowMs = hours * 3_600_000
  for (const [alertId, list] of byId) {
    const sorted = [...list].sort((a, b) => a.ts - b.ts)
    // 滑动窗口最大条数:双指针。
    let best = 0
    let left = 0
    for (let right = 0; right < sorted.length; right += 1) {
      while (sorted[right].ts - sorted[left].ts > windowMs) left += 1
      best = Math.max(best, right - left + 1)
    }
    if (best > 1) {
      let minGapMs = Infinity
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].ts - sorted[i - 1].ts <= windowMs)
          minGapMs = Math.min(minGapMs, sorted[i].ts - sorted[i - 1].ts)
      }
      violations.push({
        alertId,
        deliveredWithin4h: best,
        totalDelivered: sorted.length,
        minAdjacentGapMs: Number.isFinite(minGapMs) ? minGapMs : null,
        firstAt: sorted[0].at,
        lastAt: sorted[sorted.length - 1].at,
        source: sorted[0].source,
        subject: sorted[0].subject,
      })
    }
  }
  // 先按"4h 内条数"降序,同条数再按相邻间隔升序 —— 39.4s 那种双封必须排在最前,
  // 否则会被一堆 2 条/2.5h 的旧账挤掉,基线读起来像"没那么严重"。
  violations.sort(
    (a, b) =>
      b.deliveredWithin4h - a.deliveredWithin4h ||
      (a.minAdjacentGapMs ?? Infinity) - (b.minAdjacentGapMs ?? Infinity),
  )
  return {
    deliveredRows: rows.length,
    alertIds: byId.size,
    violations: violations.length,
    maxDeliveredWithinWindow: violations[0]?.deliveredWithin4h ?? 1,
    top: violations.slice(0, 5),
  }
}

function readPidFile() {
  const text = readText(PID_FILE)
  if (typeof text !== 'string') return { exists: false, error: text.error }
  const pid = Number(String(text).match(/pid=(\d+)/)?.[1] ?? 0) || 0
  const alive = pid > 0 ? isPidAlive(pid) : false
  return { exists: true, raw: text.trim(), pid, alive }
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e?.code === 'EPERM'
  }
}

function probeProcesses() {
  if (process.platform !== 'win32') return { ok: false, why: `非 win32(${process.platform})` }
  const script = [
    `Get-CimInstance Win32_Process -Filter "Name='node.exe'"`,
    `| Where-Object { $_.CommandLine -match 'git-guardian\\.mjs' }`,
    `| Select-Object ProcessId,ParentProcessId,CreationDate,CommandLine`,
    `| ConvertTo-Json -Compress`,
  ].join(' ')
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const trimmed = out.trim()
    if (trimmed === '') return { ok: true, list: [] }
    const parsed = JSON.parse(trimmed)
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    const list = arr.map((p) => {
      const commandLine = String(p.CommandLine ?? '')
      return {
        pid: Number(p.ProcessId) || 0,
        parentPid: Number(p.ParentProcessId) || 0,
        createdAt: p.CreationDate ?? null,
        daemon: /--daemon(?:\s|$)/.test(commandLine),
        commandLine,
      }
    })
    return { ok: true, list }
  } catch (e) {
    return { ok: false, why: `进程表取不到:${e?.message ?? e}` }
  }
}

function sourceWiring() {
  const text = readText(GUARDIAN_SRC)
  if (typeof text !== 'string') return { readable: false, error: text.error }
  const acquireCalls = (text.match(/acquireGuardianLock\s*\(/g) ?? []).length
  const daemonGuarded = /function startDaemon\s*\(\s*\)[^]*?acquireGuardianLock\s*\(/.test(text)
  const mainGuarded = /async function main\s*\(\s*\)[^]*?acquireGuardianLock\s*\(/.test(text)
  return { readable: true, acquireCalls, mainGuarded, daemonGuarded }
}

const logText = readText(LOG_FILE)
if (typeof logText !== 'string') {
  console.error(`❌ 日志读不到(${LOG_FILE}):${logText.error} —— 结论不可用`)
  process.exit(1)
}
const logSize = statSync(LOG_FILE).size
const rows = parseLogRows(logText, sinceMs)
const allDup = duplicateStats(rows)
const strictDup = duplicateStats(rows, { onlyStrict: true })
const align = alignRepeats(rows, alignGapMs)

const ledgerText = readText(LEDGER_FILE)
const ledger = typeof ledgerText === 'string' ? ledgerStats(ledgerText, dedupeHours) : { unreadable: ledgerText.error }

const procs = probeProcesses()
const lock = inspectGuardianLock({ path: LOCK_FILE, env: process.env })
const pidFile = readPidFile()
const wiring = sourceWiring()

const daemonCount = procs.ok ? procs.list.filter((p) => p.daemon).length : null
const taskCount = procs.ok ? procs.list.filter((p) => !p.daemon).length : null
const carriers = procs.ok ? procs.list.length : null

/**
 * 结论只看证据,不猜:
 *  - 双载体同时存活 + 日志里仍有同语义重复 / 对齐 <60s 重复 ⇒ double-run-unmitigated;
 *  - 源码已接锁 + 日志 24h 无上述重复 ⇒ mutex-effective(仍需连续 3 天复跑确认);
 *  - 单载体 + 无重复 ⇒ single-run-clean;
 *  - 其它 ⇒ undetermined(不得记绿)。
 */
let verdict = 'undetermined'
const dupEvidence = allDup.extras > 0 || align.repeatPairs > 0
if (dupEvidence && wiring.readable && wiring.acquireCalls === 0) {
  // 24h 日志里已经留下双跑痕迹,但抓拍那一刻恰好只有一台在跑(计划任务轮次每 2 分钟才起一次,
  // 窗口极窄)⇒ 不能因为"瞬时只有一台"就记成未判定。锁尚未接进源码时,重复本身就是双跑实证。
  verdict = 'double-run-unmitigated'
} else if (carriers !== null && carriers >= 2 && dupEvidence) {
  verdict = 'double-run-unmitigated'
} else if (wiring.readable && wiring.acquireCalls > 0 && allDup.extras === 0 && align.repeatPairs === 0) {
  verdict = 'mutex-effective'
} else if (carriers === 1 && allDup.extras === 0 && align.repeatPairs === 0) {
  verdict = 'single-run-clean'
}

const report = {
  generatedAt: new Date(nowMs).toISOString(),
  windowHours,
  log: {
    path: LOG_FILE,
    sizeBytes: logSize,
    validRows: rows.length,
    sameMinuteAll: { groups: allDup.groups, extras: allDup.extras, top: allDup.top },
    sameMinuteStrict: { groups: strictDup.groups, extras: strictDup.extras, top: strictDup.top },
    align: { messages: align.count, repeatPairsUnderGap: align.repeatPairs, gapMs: alignGapMs, examples: align.pairs },
  },
  carriers: {
    probeOk: procs.ok,
    why: procs.why ?? null,
    total: carriers,
    daemon: daemonCount,
    task: taskCount,
    list: procs.ok ? procs.list : [],
    pidFile,
    lock,
  },
  sourceWiring: wiring,
  mailLedger: ledger,
  verdict,
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const fmt = (n) => (n === null || n === undefined ? '?' : String(n))
  const lockLine = lock.exists
    ? `存在 state=${lock.state} pid=${fmt(lock.pid)} heartbeatAge=${lock.heartbeatAgeMs === null ? '?' : `${Math.round(lock.heartbeatAgeMs / 1000)}s`}`
    : `不存在 state=${lock.state}`
  console.log('【双跑互斥验收 / 只读】')
  console.log(`窗口:最近 ${windowHours}h(自 ${new Date(sinceMs).toISOString()})`)
  console.log('')
  console.log(`载体进程:${fmt(carriers)}(daemon=${fmt(daemonCount)}, 计划任务轮次=${fmt(taskCount)})`)
  if (procs.ok) {
    for (const p of procs.list) console.log(`  - pid=${p.pid} parent=${p.parentPid} daemon=${p.daemon} :: ${p.commandLine}`)
  } else {
    console.log(`  - 进程表未判定:${procs.why}`)
  }
  console.log(`pid 台账:${pidFile.exists ? `pid=${pidFile.pid} alive=${pidFile.alive}` : '不存在'}`)
  console.log(`轮级锁:${lockLine}`)
  console.log(`源码接线:acquireGuardianLock=${wiring.readable ? wiring.acquireCalls : '读不到'} 处,main=${wiring.mainGuarded},daemon=${wiring.daemonGuarded}`)
  console.log('')
  console.log(`同分钟同语义:${allDup.groups} 组 / ${allDup.extras} 条多余(严格 ✅/❌:${strictDup.groups} 组 / ${strictDup.extras} 条)`)
  for (const g of allDup.top) {
    console.log(`  - x${g.count} gap=${Math.round(g.gapMs / 1000)}s ${g.first.iso} 与 ${g.second.iso}`)
    console.log(`      ${g.first.line}`)
    console.log(`      ${g.second.line}`)
  }
  console.log(`幻影漂移对齐:${align.count} 条,相邻 <${Math.round(alignGapMs / 1000)}s 的重复 ${align.repeatPairs} 组`)
  for (const p of align.pairs) {
    console.log(`  - gap=${(p.gapMs / 1000).toFixed(1)}s ${p.first.iso} 与 ${p.second.iso}`)
    console.log(`      ${p.first.line}`)
    console.log(`      ${p.second.line}`)
  }
  if (ledger.unreadable) {
    console.log(`邮件台账:读不到(${ledger.unreadable})`)
  } else {
    console.log(
      `邮件台账:delivered ${ledger.deliveredRows} 条 / ${ledger.alertIds} 个 alertId;同一 alertId ${dedupeHours}h 内 delivered>1 的 ${ledger.violations} 组,最多 ${ledger.maxDeliveredWithinWindow} 条`,
    )
    for (const v of ledger.top) {
      console.log(`  - ${v.deliveredWithin4h} 条 / ${dedupeHours}h(总 ${v.totalDelivered}) gap=${v.minAdjacentGapMs === null ? '?' : `${(v.minAdjacentGapMs / 1000).toFixed(1)}s`} :: ${v.alertId}`)
      console.log(`      ${v.firstAt} → ${v.lastAt}`)
    }
  }
  console.log('')
  console.log(`结论:${verdict}`)
}
