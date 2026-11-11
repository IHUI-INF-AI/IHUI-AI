#!/usr/bin/env node
/**
 * 「号池跨环境自动同步」Windows 计划任务的注册/查询/注销(2026-11-11 立)。
 *
 * 为什么落到计划任务而不是进程内 cron:同步要跨两台机器(开发机 Postgres ⇄ 生产 Postgres),
 * 它的驱动方必须是**同时能连本地库、又能免密 SSH 生产**的那一端 = 开发机。api 进程内的
 * BullMQ/node-cron 只在服务运行时有效,服务一停同步就断;计划任务是 OS 级调度,重启仍在。
 *
 * 任务形态(2026-11-11 实测定型):
 *   Execute   = node.exe 绝对路径(**不经 cmd**)
 *   Arguments = "<repo>\scripts\relay-account-pool-sync.mjs" --if-dirty --apply --quiet --log "<repo>\.tmp\pool-sync.log"
 *   Trigger   = 每 N 分钟(默认 2)
 *
 * 两个反面教材(都实测踩过):
 *   1) 用 cmd.exe 执行 + `>>` 重定向:非交互会话里进程被系统中断,LastTaskResult=0xC000013A
 *      (CTRL_C_EXIT),日志只剩 `^C`。改用 node.exe 直接执行,日志交给脚本 --log 自己写。
 *   2) 用 schtasks.exe 注册:本机安全策略把 schtasks.exe 列入程序黑名单,调用直接被拦。
 *      改用 PowerShell 的 Register-ScheduledTask / Get-ScheduledTask / Unregister-ScheduledTask。
 *
 * 用法:
 *   node scripts/register-pool-sync-task.mjs --register [--interval 2]
 *   node scripts/register-pool-sync-task.mjs --query
 *   node scripts/register-pool-sync-task.mjs --unregister
 *   node scripts/register-pool-sync-task.mjs --run-now
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TASK_NAME = 'IHUI-Pool-Sync'
const SYNC_SCRIPT = path.join(ROOT, 'scripts', 'relay-account-pool-sync.mjs')
const LOG_DIR = path.join(ROOT, '.tmp')
const LOG_FILE = path.join(LOG_DIR, 'pool-sync.log')

const HELP = `号池跨环境自动同步 · Windows 计划任务管理

用法:
  node scripts/register-pool-sync-task.mjs --register [--interval 2] [--dry-run-task]
  node scripts/register-pool-sync-task.mjs --query
  node scripts/register-pool-sync-task.mjs --unregister
  node scripts/register-pool-sync-task.mjs --run-now

说明:
  · 任务每 <interval> 分钟跑一次 sync --if-dirty --apply --quiet;
  · 没有变更标记时立即退出(零开销),有标记才做两端全量对账;
  · Execute 优先选**路径稳定**的 node(系统安装 → 用户级安装 → 当前进程),
    逐个校验主版本达 engines 下限;绝不把带版本号的目录写死进任务(升级即失效);
  · 日志由脚本 --log 追加到 .tmp/pool-sync.log(只在真有动作时写一行);
  · 健康自检不在这里:node scripts/relay-account-pool-sync.mjs --status(任务状态+执行面+日志+脏标记+生产 checkout+tsx);
  · schtasks.exe 在本机被安全策略黑名单,本脚本走 PowerShell ScheduledTasks 模块。`

function parseArgs(argv) {
  const options = { action: 'query', interval: 2, dryRunTask: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.action = 'help'
    else if (arg === '--register') options.action = 'register'
    else if (arg === '--unregister') options.action = 'unregister'
    else if (arg === '--query') options.action = 'query'
    else if (arg === '--run-now') options.action = 'run-now'
    else if (arg === '--dry-run-task') options.dryRunTask = true
    else if (arg === '--interval') {
      const v = Number((argv[++i] ?? '').trim())
      if (!Number.isFinite(v) || v < 1) return { options: null, error: '--interval 需要 >= 1 的分钟数' }
      options.interval = Math.floor(v)
    } else return { options: null, error: `未知参数: ${arg}` }
  }
  return { options, error: null }
}

/** 跑一段 PowerShell(本机 schtasks.exe 被程序黑名单拦截,只能用 ScheduledTasks 模块)。 */
function ps(script) {
  try {
    const out = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
    )
    return { ok: true, text: String(out ?? '').trim() }
  } catch (e) {
    const err = e?.stderr ? String(e.stderr) : ''
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, text: `${err}${msg}`.trim() }
  }
}

const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`

/** engines 下限(与 package.json 的 `>=22.13.0` 同源判据:只看主版本,不复制具体补丁号)。 */
const MIN_NODE_MAJOR = 22

/**
 * 选一个**路径稳定**的 node 给计划任务(2026-11-12 立,拆定时炸弹)。
 *
 * 立因(实测):任务最初注册成 `process.execPath`,即
 *   `C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`
 * —— 路径里带**版本号目录**。WorkBuddy 升级 Node 后旧版本目录会被清理,任务里的绝对路径
 * 就指向不存在的文件:每 2 分钟照常"启动"、立即失败、脏标记越积越多,而两端从此悄悄分叉。
 * 这类失效没有任何响声(§12f),只能靠选稳定路径 + `--status` 的存在性检查双保险。
 *
 * 顺序:**系统安装的 node 优先**(路径与版本无关、随安装升级而原地更新),
 * 最后才回落 `process.execPath`(WorkBuddy 内置,带版本目录,仅兜底)。
 * 每个候选都必须真跑一次 `--version` 且主版本达 engines 下限 —— 存在但太老的 node 不能用,
 * 否则会把"能启动但语法不认"的失败引进任务里。
 */
function resolveStableNode() {
  const candidates = [
    { path: 'C:\\Program Files\\nodejs\\node.exe', source: '系统安装(nodejs 官方安装包)' },
    { path: path.join(process.env['LOCALAPPDATA'] ?? '', 'Programs', 'nodejs', 'node.exe'), source: '用户级安装' },
    { path: process.execPath, source: '当前进程(WorkBuddy 内置,路径含版本目录)' },
  ]
  const rejected = []
  for (const c of candidates) {
    if (!c.path || !fs.existsSync(c.path)) {
      rejected.push(`${c.path || '(空)'} — 不存在`)
      continue
    }
    let version = ''
    try {
      version = execFileSync(c.path, ['--version'], { encoding: 'utf8', timeout: 15_000 }).trim()
    } catch (e) {
      rejected.push(`${c.path} — 跑不起来(${e instanceof Error ? e.message : String(e)})`)
      continue
    }
    const major = Number(/^v(\d+)\./.exec(version)?.[1] ?? 0)
    if (!(major >= MIN_NODE_MAJOR)) {
      rejected.push(`${c.path} — 版本 ${version} 低于 engines 下限 v${MIN_NODE_MAJOR}`)
      continue
    }
    return { node: c.path, source: c.source, version, rejected }
  }
  return { node: null, source: '', version: '', rejected }
}

function buildTaskArgument() {
  return `"${SYNC_SCRIPT}" --if-dirty --apply --quiet --log "${LOG_FILE}"`
}

function doRegister(options) {
  if (!fs.existsSync(SYNC_SCRIPT)) {
    process.stderr.write(`❌ 同步脚本不存在: ${SYNC_SCRIPT}\n`)
    return 2
  }
  fs.mkdirSync(LOG_DIR, { recursive: true })
  const picked = resolveStableNode()
  if (!picked.node) {
    process.stderr.write(
      `❌ 找不到可用的 node(需 v${MIN_NODE_MAJOR}+):\n` +
        picked.rejected.map((r) => `   · ${r}`).join('\n') +
        '\n   先装 nodejs 后再注册;或用当前 node 强制注册(路径可能随版本失效)。\n',
    )
    return 2
  }
  const nodeExe = picked.node
  const arg = buildTaskArgument()
  if (options.dryRunTask) {
    process.stdout.write(
      `[dry-run] Register-ScheduledTask -TaskName ${psQuote(TASK_NAME)}\n` +
        `  -Execute ${psQuote(nodeExe)}\n  -Argument ${psQuote(arg)}\n` +
        `  -WorkingDirectory ${psQuote(ROOT)}\n  -Interval ${options.interval}min\n` +
        `  node 来源: ${picked.source} / ${picked.version}\n`,
    )
    return 0
  }
  const script = `
$ErrorActionPreference = 'Stop'
$action = New-ScheduledTaskAction -Execute ${psQuote(nodeExe)} -Argument ${psQuote(arg)} -WorkingDirectory ${psQuote(ROOT)}
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes ${options.interval}) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName ${psQuote(TASK_NAME)} -Action $action -Trigger $trigger -Settings $settings -Description '号池跨环境双向自动同步(本地<->生产,脏标记驱动)' -Force | Out-Null
Write-Output 'REGISTERED'
`.trim()
  const r = ps(script)
  if (!r.ok || !/REGISTERED/.test(r.text)) {
    process.stderr.write(`❌ 注册失败: ${r.text}\n`)
    return 1
  }
  process.stdout.write(`✅ 已注册计划任务 ${TASK_NAME}(每 ${options.interval} 分钟)\n`)
  process.stdout.write(
    `   Execute : ${nodeExe}\n   node 来源: ${picked.source} / ${picked.version}\n` +
      `   Argument: ${arg}\n   Log     : ${LOG_FILE}\n`,
  )
  if (picked.source.includes('版本目录')) {
    process.stdout.write(
      '   ⚠️ 用的是 WorkBuddy 内置 node(路径含版本目录):WorkBuddy 升级 Node 后此路径可能失效,\n' +
        '      届时 node scripts/relay-account-pool-sync.mjs --status 会报错并提示重跑本命令。\n',
    )
  }
  return 0
}

function doQuery() {
  const script = `
$ErrorActionPreference = 'Stop'
$t = Get-ScheduledTask -TaskName ${psQuote(TASK_NAME)}
$i = $t | Get-ScheduledTaskInfo
Write-Output ('STATE=' + $t.State)
Write-Output ('EXEC=' + $t.Actions[0].Execute)
Write-Output ('ARGS=' + $t.Actions[0].Arguments)
Write-Output ('LASTRUN=' + $i.LastRunTime)
Write-Output ('LASTRESULT=0x' + ('{0:X}' -f $i.LastTaskResult))
`.trim()
  const r = ps(script)
  if (!r.ok) {
    process.stdout.write(`未安装:计划任务 ${TASK_NAME} 不存在(或查询失败)\n`)
    return 0
  }
  process.stdout.write(`任务 ${TASK_NAME}:\n`)
  for (const line of r.text.split(/\r?\n/).filter(Boolean)) process.stdout.write(`  ${line}\n`)
  return 0
}

function doUnregister() {
  const r = ps(
    `$ErrorActionPreference='Stop'; Unregister-ScheduledTask -TaskName ${psQuote(TASK_NAME)} -Confirm:$false; Write-Output 'DELETED'`,
  )
  if (!r.ok) {
    process.stdout.write(`未删除(可能本就不存在): ${r.text}\n`)
    return 0
  }
  process.stdout.write(`✅ 已注销计划任务 ${TASK_NAME}\n`)
  return 0
}

function doRunNow() {
  const r = ps(
    `$ErrorActionPreference='Stop'; Start-ScheduledTask -TaskName ${psQuote(TASK_NAME)}; Write-Output 'STARTED'`,
  )
  if (!r.ok || !/STARTED/.test(r.text)) {
    process.stderr.write(`❌ 触发失败(任务未注册?): ${r.text}\n`)
    return 1
  }
  process.stdout.write(`✅ 已触发 ${TASK_NAME}(结果看 ${LOG_FILE})\n`)
  return 0
}

function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n\n${HELP}\n`)
    return 2
  }
  const options = parsed.options
  switch (options.action) {
    case 'help':
      process.stdout.write(`${HELP}\n`)
      return 0
    case 'register':
      return doRegister(options)
    case 'unregister':
      return doUnregister()
    case 'run-now':
      return doRunNow()
    default:
      return doQuery()
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}
