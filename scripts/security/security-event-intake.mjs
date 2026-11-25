// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 单行 JSON 落 stdout,摘要落 stderr */
/**
 * 安全事件增量抽取器 + 日志窗口哨兵(第十九件,2026-11-26 立)。
 *
 * 为什么立:实测 Security 日志只保留 4.6 小时(01:55 → 06:31,512MB 上限 + 滚动覆盖,
 * 4688 双开是主要噪声源)。审计策略补齐 22 条双开之后事件只会更多、窗口只会更短。
 * 结论:日志只能当「实时缓存」,取证必须先把关键事件增量抽取到 JSONL 永久落盘。
 *
 * 本工具做四件事:
 *   ① 按 RecordId 游标增量读 Security 日志(默认只抽 EVENT_CATALOG 里的取证面 ID,
 *     4688/4674 这类超高频刻意不抽);
 *   ② 追加写 .ihui-agent/state/security-events.jsonl(每行一个事件,已分类);
 *   ③ 交纯函数判分(1102/4719/4697/4732/4740 命中即 breach);
 *   ④ 顺带体检日志窗口(最老事件距今 < 6h ⇒ warn 点名)。
 *
 * 退出码: 0 ok(含空窗) | 1 breach(高危事件命中) | 2 undetermined(日志取不到)
 * 用法:
 *   node scripts/security/security-event-intake.mjs              # 人读
 *   node scripts/security/security-event-intake.mjs --json       # 单行 JSON
 *   node scripts/security/security-event-intake.mjs --alert      # breach 时发信
 *   node scripts/security/security-event-intake.mjs --seed       # 首次建游标(只取最近 500 条)
 *   node scripts/security/security-event-intake.mjs --stats      # 只看已落盘统计
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  INTAKE_EVENT_IDS,
  describeEvent,
  filterAfterCursor,
  judgeEventBatch,
  summarizeWindow,
} from './lib/security-events.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const CURSOR_FILE = join(STATE_DIR, 'security-events-cursor.json')
const EVENTS_FILE = join(STATE_DIR, 'security-events.jsonl')
const RUN_LEDGER = join(STATE_DIR, 'security-events-intake.jsonl')
const NOTIFY = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')

/** 抽取时只带这些字段(其余字段体积大且无取证价值)。 */
const FIELDS = [
  'SubjectUserName',
  'TargetUserName',
  'SubjectDomainName',
  'TargetDomainName',
  'IpAddress',
  'IpPort',
  'ProcessName',
  'ImagePath',
  'ServiceName',
  'LogonType',
  'Status',
  'SubjectLogonId',
]

function run(file, args, timeoutMs) {
  return String(
    execFileSync(file, args, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    }) || '',
  )
}

function readCursor() {
  try {
    if (!existsSync(CURSOR_FILE)) return { lastRecordId: 0, updatedAt: null, seeded: false }
    const j = JSON.parse(readFileSync(CURSOR_FILE, 'utf8'))
    return {
      lastRecordId: Number(j.lastRecordId) || 0,
      updatedAt: j.updatedAt || null,
      seeded: Boolean(j.seeded),
    }
  } catch {
    /* 游标损坏 ⇒ 当未初始化,走 --seed 路径,不猜 */
    return { lastRecordId: 0, updatedAt: null, seeded: false, corrupt: true }
  }
}

function writeCursor(next) {
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(
    CURSOR_FILE,
    `${JSON.stringify({ lastRecordId: next.lastRecordId, updatedAt: new Date().toISOString(), seeded: true }, null, 2)}\n`,
    'utf8',
  )
}

/**
 * 抽一批事件。
 *
 * 关键实测坑(2026-11-26):`Get-WinEvent -FilterHashtable @{LogName='Security'; Id=@(...)}` 在
 * Security 频道上**只要 ID 列表里含「从未产生过」的 ID,整批就静默返回 0 条**
 * (32 个 ID ⇒ 0,拆成小批才有数据;逐个试 1102/5440/4768 均 0、4776 有 1)。
 * 所以这里改用**StartTime 过滤**(时间条件是可靠面),再在 PowerShell 侧按 ID 白名单过滤,
 * 绝不用 ID 数组赌「都不存在」。
 *
 * 返回 { events, oldest, newest, error }。
 */
function collect({ minutes, maxEvents }) {
  const ids = INTAKE_EVENT_IDS.join(',')
  const fieldList = FIELDS.map((f) => `'${f}'`).join(',')
  const script = [
    'chcp 65001 >$null',
    '$out=@{ error=$null; events=@(); oldest=$null; newest=$null }',
    'try {',
    "  $null=Get-WinEvent -LogName 'Security' -MaxEvents 1 -ErrorAction Stop",
    `  $since=(Get-Date).AddMinutes(-${minutes})`,
    "  $ev=Get-WinEvent -FilterHashtable @{LogName='Security'; StartTime=$since} -MaxEvents " +
      `${maxEvents} -ErrorAction SilentlyContinue`,
    `  $ids=@(${ids})`,
    '  $arr=New-Object System.Collections.ArrayList',
    '  foreach($e in $ev){',
    '    try{ $id=[int]$e.Id } catch { continue }',
    '    if(-not ($ids -contains $id)){ continue }',
    '    try{ $x=[xml]$e.ToXml() } catch { continue }',
    '    $d=@{}; foreach($p in $x.Event.EventData.Data){ $d[$p.Name]=$p.\'#text\' }',
    '    $h=@{ recordId=[long]$e.RecordId; id=$id; ts=$e.TimeCreated.ToString(\'o\') }',
    `    foreach($k in @(${fieldList})){ if($d.ContainsKey($k)){ $h[$k]=[string]$d[$k] } }`,
    '    [void]$arr.Add([pscustomobject]$h)',
    '  }',
    '  $old=Get-WinEvent -LogName \'Security\' -Oldest -MaxEvents 1 -ErrorAction SilentlyContinue',
    '  $new=Get-WinEvent -LogName \'Security\' -MaxEvents 1 -ErrorAction SilentlyContinue',
    "  if($old){ $out.oldest=$old.TimeCreated.ToString('o') }",
    "  if($new){ $out.newest=$new.TimeCreated.ToString('o') }",
    '  $out.events=$arr.ToArray()',
    '} catch { $out.error=$_.Exception.Message }',
    '$out | ConvertTo-Json -Compress -Depth 6',
  ].join('\n')

  let raw
  try {
    raw = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], 240_000)
  } catch (e) {
    return { events: null, oldest: null, newest: null, error: String(e?.message || e).split(/\r?\n/)[0] }
  }
  const txt = String(raw || '').trim().split(/\r?\n/).filter(Boolean).pop()
  if (!txt) return { events: null, oldest: null, newest: null, error: '抽取脚本无输出' }
  let parsed
  try {
    parsed = JSON.parse(txt)
  } catch (e) {
    return { events: null, oldest: null, newest: null, error: `输出非 JSON: ${String(e?.message || e).split(/\r?\n/)[0]}` }
  }
  if (parsed.error) return { events: null, oldest: null, newest: null, error: String(parsed.error) }
  return {
    events: Array.isArray(parsed.events) ? parsed.events : [],
    oldest: parsed.oldest ?? null,
    newest: parsed.newest ?? null,
    error: null,
  }
}

function appendEvents(rows) {
  if (!rows.length) return
  mkdirSync(STATE_DIR, { recursive: true })
  const lines = rows.map((r) => JSON.stringify(r)).join('\n')
  appendFileSync(EVENTS_FILE, `${lines}\n`, 'utf8')
}

function appendRunLedger(row) {
  mkdirSync(STATE_DIR, { recursive: true })
  appendFileSync(RUN_LEDGER, `${JSON.stringify(row)}\n`, 'utf8')
}

function statsOfFile() {
  if (!existsSync(EVENTS_FILE)) return { exists: false, bytes: 0, lines: 0 }
  const size = statSync(EVENTS_FILE).size
  let lines = 0
  try {
    lines = readFileSync(EVENTS_FILE, 'utf8').split('\n').filter(Boolean).length
  } catch {
    lines = -1
  }
  return { exists: true, bytes: size, lines }
}

function sendAlert(result, windowInfo) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const body = [
    `安全事件抽取器: ${result.state}`,
    '',
    result.reason,
    '',
    '高危样本:',
    ...result.breaches.slice(0, 8).map((b) => `  #${b.recordId} ${b.name} @${b.ts} 用户=${b.TargetUserName || b.SubjectUserName || '-'} 进程=${b.ProcessName || b.ImagePath || '-'}`),
    '',
    `日志窗口: ${windowInfo.reason}`,
    '',
    '台账: .ihui-agent/state/security-events.jsonl',
  ].join('\n')
  try {
    const out = execFileSync(
      process.execPath,
      [
        tsx,
        NOTIFY,
        '--subject',
        `[IHUI 安全事件] ${result.state} — 高危 ${result.breaches.length} 条`,
        '--message',
        body,
        '--alert-id',
        'security-event-intake',
        '--dedupe-hours',
        '2',
      ],
      {
        cwd: join(ROOT, 'apps', 'api'),
        encoding: 'utf8',
        timeout: 120_000,
        windowsHide: true,
        maxBuffer: 8 << 20,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    console.error(`   --alert:已投递 ${String(out).trim().split(/\r?\n/).slice(-1)[0] || ''}`)
  } catch (e) {
    console.error(`   --alert:投递失败 ${String(e?.message || e).split(/\r?\n/)[0]}`)
    console.error('   --alert:标记 UNDELIVERED 留痕(下次成功自动清)')
  }
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json')
  const alert = argv.includes('--alert')
  const seed = argv.includes('--seed')
  const rebuild = argv.includes('--rebuild')
  const statsOnly = argv.includes('--stats')

  if (statsOnly) {
    const s = statsOfFile()
    const c = readCursor()
    const payload = { eventsFile: s, cursor: c }
    if (json) console.log(JSON.stringify(payload))
    else {
      console.log(`security-events.jsonl: ${s.exists ? `${s.lines} 行 / ${(s.bytes / 1024).toFixed(1)} KB` : '(尚无)'}`)
      console.log(`游标: lastRecordId=${c.lastRecordId} seeded=${c.seeded} updatedAt=${c.updatedAt || '-'}`)
    }
    return 0
  }

  let cursor = readCursor()
  if (rebuild) {
    /* 重建:清空台账并把游标归 0,然后拉满整个日志窗口 24h —— 一次性把今天的历史补齐落盘。
       游标清空是必要的:filterAfterCursor 严格大于游标,不归零就补不到更早的事件。 */
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(EVENTS_FILE, '', 'utf8')
    cursor = { lastRecordId: 0, updatedAt: null, seeded: false }
  }
  const firstRun = cursor.lastRecordId === 0 && !cursor.seeded
  /* 首次/重建:24h 窗 + 20000 上限(拉满 512MB 日志的全部);增量:30 分钟窗(节律 15 分钟的一倍,靠 recordId 去重防漏)。 */
  const plan =
    rebuild || seed || firstRun ? { minutes: 1440, maxEvents: 20000 } : { minutes: 30, maxEvents: 20000 }
  const got = collect(plan)

  if (got.error) {
    const result = { state: 'undetermined', total: 0, breaches: [], watches: [], counts: {}, reason: `Security 日志取不到: ${got.error}` }
    const win = { state: 'undetermined', hours: null, minHours: 6, reason: '日志不可读 ⇒ 窗口无法体检' }
    appendRunLedger({ at: new Date().toISOString(), state: result.state, total: 0, reason: result.reason, window: win })
    if (json) console.log(JSON.stringify({ state: result.state, reason: result.reason, window: win }))
    else {
      console.log(`? undetermined — ${result.reason}`)
      console.log(`   → 先手工跑:Get-WinEvent -LogName Security -MaxEvents 1(看是否权限/日志被关)`)
    }
    return 2
  }

  const fresh = filterAfterCursor(got.events, cursor.lastRecordId)
  const decorated = fresh.map((r) => {
    const d = describeEvent(r.id)
    return { ...r, name: d.name, level: d.level }
  })
  appendEvents(decorated)
  const maxRecordId = got.events.reduce((m, r) => Math.max(m, Number(r.recordId) || 0), cursor.lastRecordId)
  if (maxRecordId > cursor.lastRecordId) writeCursor({ lastRecordId: maxRecordId })

  const result = judgeEventBatch(fresh)
  const win = summarizeWindow({ oldestTs: got.oldest, newestTs: got.newest })

  appendRunLedger({
    at: new Date().toISOString(),
    state: result.state,
    total: fresh.length,
    fetched: got.events.length,
    cursorFrom: cursor.lastRecordId,
    cursorTo: maxRecordId,
    breaches: result.breaches.length,
    watches: result.watches.length,
    window: win,
  })

  const payload = {
    state: result.state,
    reason: result.reason,
    total: fresh.length,
    fetched: got.events.length,
    cursorFrom: cursor.lastRecordId,
    cursorTo: maxRecordId,
    counts: result.counts,
    breaches: result.breaches,
    watches: result.watches,
    window: win,
    ledger: statsOfFile(),
  }

  if (json) console.log(JSON.stringify(payload))
  else {
    const mark = result.state === 'ok' ? '✓' : '✗'
    console.log(`${mark} ${result.state} — ${result.reason}`)
    console.log(`   本次新增落盘 ${fresh.length} 条(拉取 ${got.events.length} 条,游标 ${cursor.lastRecordId} → ${maxRecordId})`)
    for (const b of result.breaches.slice(0, 8)) {
      console.log(`   ! #${b.recordId} ${b.name} @${b.ts} 用户=${b.TargetUserName || b.SubjectUserName || '-'}`)
    }
    for (const w of result.watches.slice(0, 5)) {
      console.log(`   · #${w.recordId} ${w.name} @${w.ts}`)
    }
    console.log(`   日志窗口: ${win.state} — ${win.reason}`)
    const s = statsOfFile()
    console.log(`   台账: ${s.lines} 行 / ${(s.bytes / 1024).toFixed(1)} KB`)
  }

  if (alert && (result.state === 'breach' || win.state === 'warn')) sendAlert(result, win)
  if (alert) return 0
  if (result.state === 'breach') return 1
  return 0
}

const IS_MAIN = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('security-event-intake.mjs')
if (IS_MAIN) process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
