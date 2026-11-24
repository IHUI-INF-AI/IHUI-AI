#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * local-scheduler.mjs — 本机常驻调度器(2026-11-18 立)。
 *
 * 背景(机主铁律):"项目禁止使用 Windows 计划任务做自动化"。
 * 原先把 19 个本机周期作业(守护/备份/清理/会话同步…)挂在 Task Scheduler 上,
 * 卸载它们需要等价载体:本文件就是那个载体 —— 一个由登录启动的隐藏常驻进程,
 * 按 scripts/data/local-schedule.json 里的表调度子作业。
 *
 * 与计划任务的等价性:
 *   · interval  每 N 分钟一次(对应 TimeTrigger + Repetition.Interval)
 *   · daily     每天 HH:MM(对应 DailyTrigger)
 *   · weekly    每周若干 HH:MM(对应 WeeklyTrigger)
 *   · start     进程启动后跑一次(对应 Logon/Boot 触发器)
 *   · resident  常驻子进程,退出即重启(对应 logon 启动的服务型 exe)
 *
 * 纪律:
 *   · 单实例:锁文件写 pid,判活后拒绝第二份(不靠任务名去重)。
 *   · 子进程一律 windowsHide + 独立日志,绝不在桌面弹窗。
 *   · 同一作业不并发(MultipleInstancesPolicy=IgnoreNew 的等价实现)。
 *   · 全部行为落 .ihui-agent/state/local-scheduler.log(可 grep 的时间线)。
 *
 * 用法:
 *   node scripts/local-scheduler.mjs --import    从当前计划任务生成调度表(迁移用)
 *   node scripts/local-scheduler.mjs --run       守护模式(常驻)
 *   node scripts/local-scheduler.mjs --status    打印表与最近一次运行
 *   node scripts/local-scheduler.mjs --once <id> 立刻跑某一条(验证用)
 */
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const SCHEDULE_PATH = join(ROOT, 'scripts', 'data', 'local-schedule.json')
const LOCK_PATH = join(STATE_DIR, 'local-scheduler.lock')
const LOG_PATH = join(STATE_DIR, 'local-scheduler.log')
const TICK_MS = 15_000

mkdirSync(STATE_DIR, { recursive: true })

function log(line) {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const text = `[${stamp}] ${line}`
  appendFileSync(LOG_PATH, text + '\n', 'utf8')
  if (process.stdout.isTTY) console.log(text)
}

// Expand {ROOT} (and {SCRIPTS}) placeholders to absolute paths derived from this
// file's own location, so the whole schedule moves with the repo to any drive.
// System binaries (node.exe/wscript/pwsh) and user-home paths stay absolute.
function expandPath(v) {
  if (typeof v !== 'string') return v
  return v.replace(/\{ROOT\}/g, ROOT).replace(/\{SCRIPTS\}/g, join(ROOT, 'scripts'))
}

function expandJob(job) {
  return {
    ...job,
    command: expandPath(job.command),
    cwd: expandPath(job.cwd),
    args: Array.isArray(job.args) ? job.args.map(expandPath) : job.args,
  }
}

function readSchedule() {
  if (!existsSync(SCHEDULE_PATH)) throw new Error(`调度表不存在: ${SCHEDULE_PATH}(先跑 --import)`)
  const sched = JSON.parse(readFileSync(SCHEDULE_PATH, 'utf8'))
  return { ...sched, jobs: (sched.jobs || []).map(expandJob) }
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function acquireLock() {
  if (existsSync(LOCK_PATH)) {
    const pid = Number(readFileSync(LOCK_PATH, 'utf8').trim())
    if (pid && pid !== process.pid && pidAlive(pid)) return false
  }
  writeFileSync(LOCK_PATH, String(process.pid), 'utf8')
  return true
}

function releaseLock() {
  try {
    if (existsSync(LOCK_PATH) && readFileSync(LOCK_PATH, 'utf8').trim() === String(process.pid)) {
      unlinkSync(LOCK_PATH)
    }
  } catch {
    /* 退出路径,忽略 */
  }
}

/** 下一次到点的时刻(ms)—— interval 用 lastRun 推,日历型用当前时钟推。 */
function nextDue(job, now, lastRun) {
  if (job.kind === 'interval') {
    const base = lastRun ?? now
    return base + job.everyMinutes * 60_000
  }
  if (job.kind === 'daily') return nextClock(now, job.at, null)
  if (job.kind === 'weekly') return nextClock(now, job.at, job.days)
  return Number.POSITIVE_INFINITY // start / resident 由启动阶段接管
}

/** HH:MM + 可选星期集合 → 下一次时刻;days 为 [0..6](0=周日)。 */
function nextClock(now, at, days) {
  const [hh, mm] = at.split(':').map(Number)
  const d = new Date(now)
  for (let i = 0; i < 8; i++) {
    d.setDate(new Date(now).getDate() + i)
    d.setHours(hh, mm, 0, 0)
    const candidate = d.getTime()
    if (candidate <= now) continue
    if (days && !days.includes(d.getDay())) continue
    return candidate
  }
  return Number.POSITIVE_INFINITY
}

const running = new Map() // id -> { child, startedAt }

function spawnJob(job, reason) {
  if (running.has(job.id)) {
    log(`SKIP ${job.id} 仍在运行(自 ${running.get(job.id).startedAt.toISOString().slice(11, 19)})`)
    return
  }
  const child = spawn(job.command, job.args, {
    cwd: job.cwd || ROOT,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })
  const tag = `${job.id}#${child.pid}`
  running.set(job.id, { child, startedAt: new Date() })
  log(`START ${tag} (${reason})`)
  const capture = (stream, kind) => {
    stream.on('data', (buf) => {
      const text = buf.toString('utf8').trimEnd()
      if (text) appendFileSync(LOG_PATH, `[${tag}:${kind}] ${text}\n`, 'utf8')
    })
  }
  capture(child.stdout, 'out')
  capture(child.stderr, 'err')
  child.on('exit', (code) => {
    running.delete(job.id)
    log(`EXIT ${tag} code=${code}`)
    if (job.kind === 'resident') {
      setTimeout(() => {
        if (!stopping) spawnJob(job, 'resident-restart')
      }, 15_000)
    }
  })
  child.on('error', (err) => {
    running.delete(job.id)
    log(`ERROR ${tag} ${err.message}`)
  })
  return child
}

let stopping = false

async function runDaemon() {
  if (!acquireLock()) {
    console.error('local-scheduler 已有实例在跑(锁文件活 pid),拒绝启动第二份')
    process.exit(2)
  }
  const schedule = readSchedule()
  const jobs = schedule.jobs.filter((j) => j.enabled !== false)
  log(`BOOT pid=${process.pid} jobs=${jobs.length} schedule=${schedule.source ?? 'n/a'}`)

  const lastRun = new Map()
  const dueAt = new Map()

  // start 型:错峰 20s 起跑;resident 型:立即托管
  let stagger = 0
  for (const job of jobs) {
    if (job.kind === 'start') {
      stagger += 20_000
      setTimeout(() => spawnJob(job, 'start'), stagger)
    } else if (job.kind === 'resident') {
      spawnJob(job, 'resident')
    } else {
      // 首轮错峰,避免开机瞬间打满;日历型(daily/weekly)必须等到真正的时刻,
      // 不能因为"刚启动"就提前跑一次(那是 22:52 跑 03:00 作业的错)
      stagger += 5_000
      const now = Date.now()
      const first =
        job.kind === 'interval' ? now + stagger : Math.max(nextDue(job, now, null), now + stagger)
      dueAt.set(job.id, first)
    }
  }

  const shutdown = (signal) => {
    stopping = true
    log(`STOP signal=${signal} 收尾:子进程 ${running.size} 个`)
    for (const [, v] of running) {
      try {
        v.child.kill()
      } catch {
        /* 忽略 */
      }
    }
    releaseLock()
    setTimeout(() => process.exit(0), 3_000)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  setInterval(() => {
    if (stopping) return
    const now = Date.now()
    for (const job of jobs) {
      if (job.kind === 'start' || job.kind === 'resident') continue
      const last = lastRun.get(job.id) ?? null
      let due = dueAt.get(job.id)
      if (due === undefined) due = nextDue(job, now, last)
      if (now < due) {
        dueAt.set(job.id, due)
        continue
      }
      if (running.has(job.id)) {
        // 跑到下一轮还没结束 ⇒ 顺延(不并发)
        dueAt.set(job.id, nextDue(job, now, null))
        continue
      }
      spawnJob(job, `due:${job.kind}`)
      lastRun.set(job.id, now)
      dueAt.set(job.id, nextDue(job, now, now))
    }
  }, TICK_MS)

  // 常驻:每 10 分钟把「心跳」写进日志,便于判断守护是否还活着
  setInterval(() => {
    log(`HEARTBEAT jobs=${jobs.length} running=${running.size}`)
  }, 600_000)
}

function status() {
  const schedule = readSchedule()
  const lockPid = existsSync(LOCK_PATH) ? readFileSync(LOCK_PATH, 'utf8').trim() : '(none)'
  console.log(`schedule: ${SCHEDULE_PATH}`)
  console.log(`daemon pid: ${lockPid} alive=${lockPid !== '(none)' && pidAlive(Number(lockPid))}`)
  for (const j of schedule.jobs) {
    const when =
      j.kind === 'interval'
        ? `每 ${j.everyMinutes} 分钟`
        : j.kind === 'daily'
          ? `每天 ${j.at}`
          : j.kind === 'weekly'
            ? `每周 ${j.days.map((d) => '日一二三四五六'[d]).join('/')} ${j.at}`
            : j.kind
    console.log(`${j.enabled === false ? '[停]' : '[开]'} ${j.id.padEnd(28)} ${when}`)
  }
}

/**
 * 从**当前**计划任务生成等价调度表。
 * 迁移是一次性的:生成后即视为真源,不再回读计划任务(避免"两处各说各话")。
 */
function importFromTasks() {
  const ps = `
$out = @()
Get-ScheduledTask | Where-Object { $_.TaskName -like 'IHUI*' } | ForEach-Object {
  $t = $_
  $trg = @()
  foreach ($x in $t.Triggers) {
    $kind = $x.CimClass.CimClassName -replace 'MSFT_Task',''
    $trg += [pscustomobject]@{
      kind = $kind
      interval = $x.Repetition.Interval
      start = $(if ($x.StartBoundary) { $x.StartBoundary } else { $null })
      days = $(if ($x.DaysOfWeek) { $x.DaysOfWeek } else { $null })
    }
  }
  $acts = @()
  foreach ($a in $t.Actions) { $acts += [pscustomobject]@{ exec = $a.Execute; args = $a.Arguments; cwd = $a.WorkingDirectory } }
  $out += [pscustomobject]@{ name = $t.TaskName; triggers = $trg; actions = $acts }
}
$out | ConvertTo-Json -Depth 6 -Compress
`
  const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    encoding: 'utf8',
    windowsHide: true,
  })
  const tasks = JSON.parse(raw)
  const list = Array.isArray(tasks) ? tasks : [tasks]

  // 常驻型(子进程本就不退出):迁移后由守护托管,不再按点重启
  const RESIDENT = new Set(['IHUI-DevStack', 'IHUI-WorkBuddy2API', 'IHUI-PG-BACKUP'])

  const jobs = list.map((t) => {
    const action = (t.actions || [])[0] || {}
    const job = {
      id: t.name,
      command: String(action.exec || '').replace(/^"|"$/g, ''),
      args: splitArgs(String(action.args || '')),
      enabled: true,
    }
    if (action.cwd) job.cwd = action.cwd
    if (RESIDENT.has(t.name)) {
      job.kind = 'resident'
      return job
    }
    const triggers = t.triggers || []
    const time = triggers.find((x) => x.kind === 'TimeTrigger' && x.interval)
    const daily = triggers.find((x) => x.kind === 'DailyTrigger')
    const weekly = triggers.find((x) => x.kind === 'WeeklyTrigger')
    const startOnly = triggers.find((x) => x.kind === 'LogonTrigger' || x.kind === 'BootTrigger')
    if (time) {
      job.kind = 'interval'
      job.everyMinutes = isoToMinutes(time.interval)
    } else if (daily) {
      job.kind = 'daily'
      job.at = timeOf(daily.start)
    } else if (weekly) {
      job.kind = 'weekly'
      job.at = timeOf(weekly.start)
      job.days = dayNumbers(weekly.days)
    } else if (startOnly || triggers.length === 0) {
      job.kind = 'start'
    } else {
      // 触发形态认不出来 ⇒ 不默认放行:标成停用,人工看
      job.kind = 'start'
      job.enabled = false
      job.note = '触发形态未识别,迁移时停用待人工确认'
    }
    return job
  })

  const out = {
    $schema: 'local-scheduler/1',
    source: 'imported-from-TaskScheduler@' + new Date().toISOString().slice(0, 19),
    migratedAt: new Date().toISOString(),
    jobs,
  }
  writeFileSync(SCHEDULE_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8')
  log(`IMPORT jobs=${jobs.length} → ${SCHEDULE_PATH}`)
  console.log(`已生成 ${jobs.length} 条调度项 → ${SCHEDULE_PATH}`)
  for (const j of jobs) console.log(`  ${j.kind.padEnd(8)} ${j.id}  ${j.everyMinutes ?? j.at ?? ''}`)
}

/** "PT2M" / "PT1H" / "P1D" → 分钟 */
function isoToMinutes(iso) {
  if (!iso) return null
  const m = iso.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/)
  if (!m) return null
  const d = Number(m[1] || 0)
  const h = Number(m[2] || 0)
  const min = Number(m[3] || 0)
  return d * 1440 + h * 60 + min
}

function timeOf(start) {
  if (!start) return '03:00'
  const iso = String(start)
  const m = iso.match(/T(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : '03:00'
}

function dayNumbers(days) {
  const map = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }
  if (!days) return [0, 1, 2, 3, 4, 5, 6]
  return String(days)
    .split(',')
    .map((d) => map[d.trim()])
    .filter((d) => d !== undefined)
}

/** 命令行参数拆分(只处理本仓实际用到的双引号形态,不引第三方 shell) */
function splitArgs(s) {
  if (!s) return []
  const out = []
  const re = /"([^"]+)"|(\S+)/g
  let m
  while ((m = re.exec(s))) out.push(m[1] ?? m[2])
  return out
}

async function once(id) {
  const schedule = readSchedule()
  const job = schedule.jobs.find((j) => j.id === id)
  if (!job) {
    console.error(`没有这个作业: ${id}`)
    process.exit(2)
  }
  log(`ONCE ${id} begin`)
  const child = spawnJob(job, 'once')
  const code = await new Promise((resolve) => child.on('exit', (c) => resolve(c ?? 1)))
  log(`ONCE ${id} done code=${code}`)
  process.exit(code)
}

const mode = process.argv[2]
// 2026-11-22 用户定案:项目禁止用 Windows 计划任务/自建常驻调度器做自动化。
// 本文件是计划任务的等价载体,同样默认停用;--status 只读可看,其余动作必须显式放行。
if (mode !== '--status' && process.env.IHUI_ALLOW_SCHEDULED_TASKS !== '1') {
  console.error('❌ local-scheduler 已停用(2026-11-22 定案:周期任务一律走产品内置自动化)')
  console.error('   显式开启:IHUI_ALLOW_SCHEDULED_TASKS=1')
  process.exit(0)
}
if (mode === '--import') {
  importFromTasks()
} else if (mode === '--run') {
  runDaemon()
} else if (mode === '--status') {
  status()
} else if (mode === '--once') {
  once(process.argv[3])
} else {
  console.error('用法: --import | --run | --status | --once <id>')
  process.exit(2)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
