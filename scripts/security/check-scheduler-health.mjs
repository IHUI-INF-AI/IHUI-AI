#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 单行 JSON 与清单要落 stdout,告警落 stderr */
/**
 * 调度健康哨兵(2026-11-25 立)。
 *
 * 判据全在 lib/scheduler-health.mjs(纯函数),本层只做三件事:
 *   ① 枚举本机 \IHUI* 计划任务(走 schtasks.exe —— 本机没有 Get-ScheduledTask)
 *   ② 取 Last Result / Last Run / Status / Schedule Type;周期型再取 Interval 与注册时间
 *   ③ 判、记账、必要时告警
 *
 * 为什么双挂而不是只挂一处:
 *   autoban 派发链(10 分钟)与 security-repair(6 小时)各挂一次。
 *   只挂 autoban ⇒ autoban 自己挂了就一起盲,而那正是最需要被看见的场景。
 *
 * 刻意不写成阻断门(与 check-prod-parity / check-self-integrity 同一理由):
 *   调度状态是本机运行时事实,不属于提交内容;把它设成提交链阻断门只会逼人 --no-verify。
 *
 * 退出码: 0 全健康 | 1 有失效 | 2 未判定(取不到或全盲)
 * 用法:
 *   node scripts/security/check-scheduler-health.mjs            # 人读
 *   node scripts/security/check-scheduler-health.mjs --json     # 单行 JSON
 *   node scripts/security/check-scheduler-health.mjs --alert    # 失效时发信(stderr 出投递回执)
 *   node scripts/security/check-scheduler-health.mjs --paths    # 列受管任务
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  judgeSchedulerHealth,
  remediationForScheduler,
  SCHEDULER_STATE,
} from './lib/scheduler-health.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = 'D:/IHUI-AI'
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
const LEDGER = join(STATE_DIR, 'scheduler-health.jsonl')
const ROSTER = join(ROOT, 'scripts', 'data', 'scheduler-roster.json')
const NOTIFY = join(ROOT, 'apps', 'api', 'scripts', 'notify-deploy-failure.ts')
const TASK_PREFIX = 'IHUI'

/** 显式 stdio:门 193 要求派生进程写清三根管道,不靠继承。 */
function run(file, args, timeoutMs) {
  const r = execFileSync(file, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return String(r || '')
}

/** 取本机上次开机时刻。取不到返回 null,由判据落 undetermined 而不是瞎猜。 */
function readBootAt() {
  try {
    const out = run(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command',
        "(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToString('o')"],
      60_000,
    )
    const t = Date.parse(out.trim())
    return Number.isFinite(t) ? t : null
  } catch {
    return null
  }
}

/** 把 "PT6H" / "PT15M" / "P1D" 解析成分钟;认不出返回 null。 */
function parseIsoDurationMin(v) {
  const m = String(v || '').trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/)
  if (!m) return null
  const days = Number(m[1] || 0)
  const hours = Number(m[2] || 0)
  const mins = Number(m[3] || 0)
  const total = days * 1440 + hours * 60 + mins
  return total > 0 ? total : null
}

/**
 * 解析一行 CSV(处理双引号与 "" 转义;Task To Run 里同时含逗号和引号)。
 */
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else if (c === '"') {
        inQuote = false
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuote = true
    } else if (c === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

/**
 * 枚举 \IHUI* 任务。
 *
 * 为什么走 PowerShell 包一层:schtasks.exe 在 GBK 码页下输出中文表头
 * (「任务名:」「上次结果:」),Node 按 utf8 解码直接对不上 —— 实测 TaskName 命中数为 0。
 * chcp 65001 之后 /fo CSV /v 输出 29 列全英文,字段顺序固定:
 *   0 HostName | 1 TaskName | 2 Next Run Time | 3 Status | 5 Last Run Time
 *   6 Last Result | 8 Task To Run
 */
function enumerateTasks() {
  const text = run(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command',
      'chcp 65001 >$null; schtasks /query /fo CSV /v /NH'],
    180_000,
  )
  const out = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, '').trim()
    if (!line.startsWith('"')) continue
    const f = parseCsvLine(line)
    const taskName = (f[1] || '').replace(/^\\/, '')
    if (!taskName || !taskName.startsWith(TASK_PREFIX)) continue
    out.push({
      name: taskName,
      lastResult: Number(String(f[6] || '').trim()),
      lastRun: String(f[5] || '').trim(),
      status: String(f[3] || '').trim(),
      scheduleType: '',
      taskToRun: String(f[8] || '').trim(),
      /* 重复窗口三列(2026-11-25 补,第二十二件)。此前都没读 —— 于是「任务已死但所有
         仪表全绿」这一型在采集面就是盲的:Repeat: Every 有值、Next Run Time 没人看、
         Repeat: Until: Duration 更是从没被取过。列序按 `schtasks /fo CSV /v` 表头实测:
         2 Next Run Time / 24 Repeat: Every / 26 Repeat: Until: Duration。 */
      nextRun: String(f[2] || '').trim(),
      repeatEvery: String(f[24] || '').trim(),
      repeatDuration: String(f[26] || '').trim(),
    })
  }
  return out
}

/** 带真实重复间隔的才算重复型任务(其余 Next Run Time 是「一次性」,不归本维判)。 */
function isRepeating(task) {
  const every = String(task?.repeatEvery || '').trim()
  return Boolean(every) && !/^(n\/a|none|disabled)$/i.test(every)
}

/**
 * 对重复型任务补 `<LogonType>`(2026-11-25 补)。
 *
 * 为什么单独取而不是塞进 enrich():enrich 对「2 小时内跑过且结果为 0」直接返回,
 * 而静默死亡的任务恰好**永远是新鲜的** —— 塞进去等于把判据放在它永远走不到的分支里。
 * 只对重复型任务取 XML(本机 6~7 条),代价约 1.5 秒,值得。
 * CSV 的 `Logon Mode` 列不可用于判 InteractiveToken:实测 S4U 与 S-1-5-18 都显示
 * `Interactive/Background`,两种完全不同的令牌模型在这一列上同名。
 */
function enrichRepetition(task) {
  if (!isRepeating(task)) return task
  try {
    const xml = run('schtasks.exe', ['/query', '/tn', `\\${task.name}`, '/xml'], 60_000)
    const ltM = xml.match(/<LogonType>(.+?)<\/LogonType>/)
    return { ...task, logonType: ltM ? ltM[1].trim() : '' }
  } catch {
    /* 取不到不瞎猜:留空 ⇒ 这一维不判(其余维照判) */
    return { ...task, logonType: '' }
  }
}

/** 2 小时内跑过且结果为 0 ⇒ 视为新鲜,不必再取 XML(把 25 次 XML 压到 2~3 次)。 */
const FRESH_MS = 2 * 3600 * 1000

/**
 * 对一条任务补触发类型 / Interval / 注册时间。
 * 只有「不新鲜」的才取 XML:结果非 0、或上次运行已超 2 小时 —— 这些才有判过期与判从未运行的需要。
 * 取 XML 失败不瞎猜:留 trigger 空 ⇒ 判据走 undetermined 分支。
 */
function enrich(task, now) {
  const lastRunMs = Date.parse(task.lastRun)
  const fresh = task.lastResult === 0 && Number.isFinite(lastRunMs) && now - lastRunMs < FRESH_MS
  if (fresh) return task

  try {
    const xml = run('schtasks.exe', ['/query', '/tn', `\\${task.name}`, '/xml'], 60_000)
    const ivM = xml.match(/<Interval>(.+?)<\/Interval>/)
    const dtM = xml.match(/<Date>(.+?)<\/Date>/)
    const trM = xml.match(/<(BootTrigger|CalendarTrigger|TimeTrigger|LogonTrigger|EventTrigger)/)
    const trigger = trM ? trM[1] : ''
    return {
      ...task,
      intervalMin: ivM ? parseIsoDurationMin(ivM[1]) : null,
      registeredAt: dtM ? dtM[1] : null,
      trigger,
      scheduleType: trigger,
    }
  } catch {
    return { ...task, trigger: '', scheduleType: '' }
  }
}

/** 配置里标记「有意停用」的任务 —— 它们被 Disabled 是预期,不该反复告警。 */
function loadRoster() {
  if (!existsSync(ROSTER)) return {}
  try {
    const j = JSON.parse(readFileSync(ROSTER, 'utf8'))
    return j && typeof j.tasks === 'object' && j.tasks ? j.tasks : {}
  } catch {
    return {}
  }
}

function appendLedger(row) {
  mkdirSync(STATE_DIR, { recursive: true })
  appendFileSync(LEDGER, `${JSON.stringify(row)}\n`, 'utf8')
}

/**
 * 复用单一发信出口(与 check-self-integrity 同一条腿:
 * apps/api 本地 tsx 直接跑通知脚本,不走 npx —— npx 在离线环境下会先尝试拉包)。
 * 告警走 stderr,stdout 只留一行 JSON 供派发器解析。
 */
function sendAlert(result, remediation) {
  const tsx = join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  if (!existsSync(tsx) || !existsSync(NOTIFY)) {
    console.error('   --alert:tsx 或通知脚本不在位(未判定)')
    return
  }
  const lines = [
    `调度健康哨兵: ${result.state}`,
    '',
    result.reason,
    '',
    '逐条:',
    ...result.rows
      .filter((r) => r.verdict !== 'ok')
      .map((r) => `  [${r.verdict}] ${r.name} — ${r.reason}`),
    '',
    '下一步:',
    ...remediation.map((s) => `  ${s}`),
  ]
  const body = lines.join('\n')
  try {
    const out = execFileSync(
      process.execPath,
      [tsx, NOTIFY, '--subject', `[IHUI 调度] ${result.state} — ${result.breaches.length} 条失效`,
        '--message', body,
        '--alert-id', `scheduler-health-${result.state}`,
        '--dedupe-hours', '6'],
      { cwd: join(ROOT, 'apps', 'api'), encoding: 'utf8', timeout: 120_000,
        windowsHide: true, maxBuffer: 8 << 20, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    console.error(`   --alert:已投递 ${String(out).trim().split(/\r?\n/).slice(-1)[0] || ''}`)
  } catch (e) {
    console.error(`   --alert:投递失败 ${String(e?.message || e).split(/\r?\n/)[0]}`)
  }
}

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const alert = argv.includes('--alert')
  const pathsOnly = argv.includes('--paths')

  const roster = loadRoster()
  const bootAt = readBootAt()
  const now = Date.now()

  let base
  try {
    base = enumerateTasks()
  } catch (e) {
    const out = {
      state: SCHEDULER_STATE.UNDETERMINED,
      reason: `枚举失败: ${String(e?.message || e).split(/\r?\n/)[0]}`,
      total: 0,
      rows: [],
    }
    if (json) console.log(JSON.stringify(out))
    else console.log(`? 未判定 — ${out.reason}`)
    return 2
  }

  /* 枚举到 0 个候选判「未判定」,不记绿(§0.3)。 */
  if (base.length === 0) {
    const out = { state: SCHEDULER_STATE.UNDETERMINED, reason: '枚举到 0 个 \\IHUI* 任务', total: 0, rows: [] }
    if (json) console.log(JSON.stringify(out))
    else console.log('? 未判定 — 枚举到 0 个任务')
    return 2
  }

  if (pathsOnly) {
    for (const t of base) console.log(`  ${t.name}  result=${t.lastResult}  status=${t.status}  last=${t.lastRun}`)
    return 0
  }

  const entries = base.map((t) => {
    const e = enrichRepetition(enrich(t, now))
    const cfg = roster[t.name] || {}
    return {
      name: e.name,
      lastResult: e.lastResult,
      lastRun: e.lastRun,
      status: e.status,
      trigger: e.trigger || '',
      intervalMin: e.intervalMin ?? null,
      registeredAt: e.registeredAt ?? null,
      bootAt,
      disabledIntent: cfg.disabledIntent === true,
      /* 重复窗口维(第二十二件) */
      repeatEvery: e.repeatEvery ?? '',
      repeatDuration: e.repeatDuration ?? '',
      nextRun: e.nextRun ?? '',
      logonType: e.logonType ?? '',
    }
  })

  const result = judgeSchedulerHealth(entries, { now })
  const remediation = remediationForScheduler(result)

  appendLedger({
    at: new Date().toISOString(),
    state: result.state,
    total: result.total,
    breaches: result.breaches,
    warns: result.warns,
    undetermined: result.undetermined,
    reason: result.reason,
  })

  if (json) {
    console.log(JSON.stringify({
      state: result.state,
      reason: result.reason,
      total: result.total,
      breaches: result.breaches,
      warns: result.warns,
      undetermined: result.undetermined,
      rows: result.rows,
      remediation,
    }))
  } else {
    console.log(`${result.state === 'ok' ? '✓' : result.state === 'breach' ? '✗' : '?'} ${result.state} — ${result.reason}`)
    for (const r of result.rows.filter((x) => x.verdict !== 'ok')) {
      console.log(`   [${r.verdict}] ${r.name} — ${r.reason}`)
    }
    for (const s of remediation) console.log(`   → ${s}`)
  }

  if (alert && result.state !== SCHEDULER_STATE.OK) sendAlert(result, remediation)

  /*
   * --alert 档的退出码恒 0。
   *
   * 理由:这一档的产物是那封告警信,不是退出码。若让退出码表达「被监控对象的健康」,
   * 计划任务自身的 Last Result 就会跟着变成 1,下一轮它判自己失败 ⇒ 报警自己、噪声循环。
   * 监控器不该替被监控者承担失败。而「哨兵自己坏了」由两处看得见:
   *   ① autoban 每 10 分钟派发它一次,结论记 downstream-dispatch.jsonl 的 state 与 code;
   *   ② 它每轮都往 scheduler-health.jsonl 追一行,停更即说明它没在跑。
   */
  if (alert) return 0

  if (result.state === SCHEDULER_STATE.OK) return 0
  if (result.state === SCHEDULER_STATE.BREACH) return 1
  return 2
}

const IS_MAIN = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('check-scheduler-health.mjs')
if (IS_MAIN) process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
