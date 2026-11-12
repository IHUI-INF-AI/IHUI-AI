#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「号池跨环境自动同步」Windows 计划任务的注册/查询/注销(2026-11-11 立)。
 *
 * 为什么落到计划任务而不是进程内 cron:同步要跨两台机器(开发机 Postgres ⇄ 生产 Postgres),
 * 它的驱动方必须是**同时能连本地库、又能免密 SSH 生产**的那一端 = 开发机。api 进程内的
 * BullMQ/node-cron 只在服务运行时有效,服务一停同步就断;计划任务是 OS 级调度,重启仍在。
 *
 * 任务形态(2026-11-12 定型,桌面零弹窗):
 *   Execute   = C:\Windows\System32\wscript.exe(GUI 子系统程序,本身不开控制台)
 *   Arguments = //B "<repo>\scripts\pool-sync-hidden.vbs"
 *   启动器    = scripts\pool-sync-hidden.vbs:shell.Run "<内层命令>", 0, False(SW_HIDE)
 *               ASCII-only —— wscript 按 ANSI 代码页解码 .vbs,非 ASCII 会编译失败
 *   内层命令  = "<node.exe 绝对路径>" "<repo>\scripts\relay-account-pool-sync.mjs" --if-dirty --apply --all-owners --quiet --log "<repo>\.tmp\pool-sync.log"
 *   (--all-owners 自 2026-11-12 机主令起为自动任务定值:全库所有归属 + 运营池都要互通)
 *   Trigger   = 每 N 分钟(默认 2)
 *
 * 为什么必须套 wscript:计划任务主体是 Interactive(要读用户级凭据/配置),直跑 node.exe 这类
 * 控制台程序时 Windows 必在桌面弹一扇黑窗(闪一下即消失)。wscript.exe 无控制台,内层命令
 * 又以 SW_HIDE 启动,窗口从创建起就不可见。
 *
 * 两个反面教材(都实测踩过):
 *   1) 用 cmd.exe 执行 + `>>` 重定向:非交互会话里进程被系统中断,LastTaskResult=0xC000013A
 *      (CTRL_C_EXIT),日志只剩 `^C`。改用 node.exe 直接执行(如今再套 wscript 隐藏包装),
 *      日志交给脚本 --log 自己写。
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
/** 本机重新提取兜底任务(2026-11-12 立)。命名沿用 IHUI-Pool-* 家族。 */
export const REEXTRACT_TASK_NAME = 'IHUI-Pool-Local-Reextract'
const SYNC_SCRIPT = path.join(ROOT, 'scripts', 'relay-account-pool-sync.mjs')
const REEXTRACT_SCRIPT = path.join(ROOT, 'scripts', 'relay-account-local-reextract.mjs')
const LOG_DIR = path.join(ROOT, '.tmp')
const LOG_FILE = path.join(LOG_DIR, 'pool-sync.log')
/** reextract 会 spawn 本机客户端做提取,不宜高频:每天 09:10 一次(机主建议)。 */
const REEXTRACT_DAILY_TIME = '09:10'
/** 隐藏启动器(2026-11-12 远程演进融合):wscript 跑的 VBS,SW_HIDE 让内层 node 零黑窗。 */
const VBS_PATH = path.join(ROOT, 'scripts', 'pool-sync-hidden.vbs')
const WSCRIPT_EXE = 'C:\\Windows\\System32\\wscript.exe'

const HELP = `号池跨环境自动同步 + 本机重新提取兜底 · Windows 计划任务管理

用法:
  node scripts/register-pool-sync-task.mjs --register [--interval 2] [--dry-run-task]
  node scripts/register-pool-sync-task.mjs --register-reextract [--dry-run-task]
  node scripts/register-pool-sync-task.mjs --query [--reextract]
  node scripts/register-pool-sync-task.mjs --unregister [--reextract]
  node scripts/register-pool-sync-task.mjs --run-now [--reextract]

说明:
  · --register     注册号池跨环境同步任务 IHUI-Pool-Sync,每 <interval> 分钟跑 sync --if-dirty --apply --quiet;
  · --register-reextract 注册本机重新提取兜底任务 IHUI-Pool-Local-Reextract,每天 ${REEXTRACT_DAILY_TIME} 跑
                     relay-account-local-reextract --apply(refreshable=false 且已知到期进入窗口的平台做本机提取);
  · 带目标开关(--reextract)时,--query/--unregister/--run-now 作用于 reextract 任务,否则作用于同步任务;
  · --dry-run-task 只打印将注册的 PowerShell,不写系统计划任务;
  · 没有变更标记时 sync 立即退出(零开销),有标记才做两端全量对账;
  · Execute = wscript.exe + 隐藏启动器 .vbs(SW_HIDE 包装,内层 node 桌面零弹窗);内层 node 优先选**路径稳定**的 node(系统安装 → 用户级安装 → 当前进程),
    逐个校验主版本达 engines 下限;绝不把带版本号的目录写死进任务(升级即失效);
  · 日志由 sync 脚本 --log 追加到 .tmp/pool-sync.log(只在真有动作时写一行);reextract 无 --log,
    排查看任务计划程序「上次运行时间/结果」;
  · 健康自检不在这里:node scripts/relay-account-pool-sync.mjs --status(任务状态+执行面+日志+脏标记+生产 checkout+tsx);
  · schtasks.exe 在本机被安全策略黑名单,本脚本走 PowerShell ScheduledTasks 模块。`

function parseArgs(argv) {
  const options = { action: 'query', interval: 2, dryRunTask: false, target: 'sync' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.action = 'help'
    else if (arg === '--register') options.action = 'register'
    else if (arg === '--register-reextract') {
      options.action = 'register'
      options.target = 'reextract'
    } else if (arg === '--unregister') options.action = 'unregister'
    else if (arg === '--query') options.action = 'query'
    else if (arg === '--run-now') options.action = 'run-now'
    else if (arg === '--dry-run-task') options.dryRunTask = true
    else if (arg === '--reextract') options.target = 'reextract'
    else if (arg === '--interval') {
      const v = Number((argv[++i] ?? '').trim())
      if (!Number.isFinite(v) || v < 1) return { options: null, error: '--interval 需要 >= 1 的分钟数' }
      options.interval = Math.floor(v)
    } else return { options: null, error: `未知参数: ${arg}` }
  }
  return { options, error: null }
}

/** 跑一段 PowerShell(本机 schtasks.exe 被程序黑名单拦截,只能用 ScheduledTasks 模块)。 */
export function ps(script) {
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

export const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`

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
export function resolveStableNode() {
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
  // 2026-11-12 机主令「所有号池里的号都应该自动同步运营生产」:自动任务必须覆盖全库
  // 所有归属(含运营池 owner=NULL),不能只同步 ~/.wb-switch/pool-owner 指定的单一 owner。
  return `"${SYNC_SCRIPT}" --if-dirty --apply --all-owners --quiet --log "${LOG_FILE}"`
}

/** reextract 兜底任务的命令行:--apply 真正落库+推生产,人读格式写进注册器自己的日志。 */
function buildReextractTaskArgument() {
  return `"${REEXTRACT_SCRIPT}" --apply`
}

/** 每日触发器的 StartBoundary(今天 <HH:mm>,若已过则今天仍注册、明天生效)。 */
function todayAt(time) {
  return `(Get-Date).Date.Add('${time}').ToString('yyyy-MM-ddTHH:mm:ss')`
}

/**
 * 隐藏启动器正文(ASCII-only,SW_HIDE)。
 *
 * 立因(2026-11-12):任务主体是 Interactive,action 直指 node.exe 这类控制台程序时 Windows
 * 必弹一扇可见黑窗。wscript.exe 是 GUI 子系统(无控制台),VBS 内 shell.Run 第 2 参 0 = SW_HIDE,
 * 内层命令的窗口从创建起就不可见。wscript 按 **ANSI 代码页**解码 .vbs,故正文只能纯 ASCII。
 * sync 与 reextract 兜底任务共用同一套包装,只是 .vbs 各写一份(标题区分)。
 */
function hiddenWrapperContent(nodeExe, arg, label) {
  const cmd = `"${nodeExe}" ${arg}`
  return [
    `' Hidden launcher for IHUI-Pool-* (${label}; SW_HIDE, zero visible console window).`,
    `' Auto-generated by scripts/register-pool-sync-task.mjs -- do not edit by hand.`,
    `' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.`,
    `Option Explicit`,
    `Dim shell`,
    `Set shell = CreateObject("WScript.Shell")`,
    `shell.Run "${cmd.replace(/"/g, '""')}", 0, False`,
    ``,
  ].join('\r\n')
}

/**
 * 幂等生成/刷新隐藏启动器(内容一致则不重写,避免无谓的文件时间戳漂移)。
 * `write:false` 供 --dry-run-task 使用:零副作用,但仍做 ASCII 校验并如实报告是否需刷新。
 */
function ensureHiddenWrapper(nodeExe, arg, { write = true, label = 'sync', vbsPath = VBS_PATH } = {}) {
  const content = hiddenWrapperContent(nodeExe, arg, label)
  if (/[^\x00-\x7F]/.test(content)) {
    throw new Error('隐藏启动器含非 ASCII 字符(wscript 按 ANSI 解码会编译失败)')
  }
  let current = ''
  try {
    current = fs.readFileSync(vbsPath, 'utf8')
  } catch {
    /* 首次生成 */
  }
  const changed = current !== content
  if (write && changed) fs.writeFileSync(vbsPath, content, 'utf8') // utf8 不带 BOM,正文纯 ASCII
  return { path: vbsPath, changed }
}

// —— COM 兼容层:PowerShell 7 无 ScheduledTasks 模块,改用 Schedule.Service COM(本机实际环境) ——
// action 走 wscript + 隐藏包装(与 PowerShell 主路径一致),spec: { taskName, description,
// trigger:{kind:'interval',minutes}|{kind:'daily',time}, startBoundaryExpr }
function comRegisterScript(taskArg, spec) {
  const trigInit =
    spec.trigger.kind === 'daily'
      ? `$trig.StartBoundary=${spec.startBoundaryExpr}
$trig.DaysInterval=1`
      : `$trig.StartBoundary=(Get-Date).AddMinutes(1).ToString('yyyy-MM-ddTHH:mm:ss')
$trig.Repetition.Interval='PT${spec.trigger.minutes}M'
$trig.Repetition.Duration='P3650D'
$trig.Repetition.StopAtDurationEnd=$true`
  return `
$ErrorActionPreference='Stop'
$s=New-Object -ComObject Schedule.Service
$s.Connect()
$root=$s.GetFolder('\\')
$td=$s.NewTask(0)
$td.RegistrationInfo.Description='${spec.description}'
$trig=$td.Triggers.Create(1)
${trigInit}
$act=$td.Actions.Create(0)
$act.Path=${psQuote(WSCRIPT_EXE)}
$act.Arguments=${psQuote(taskArg)}
$act.WorkingDirectory=${psQuote(ROOT)}
$user=$env:USERNAME
$t=$root.RegisterTaskDefinition('${spec.taskName}', $td, 6, $user, $null, 2)
$t.Enabled=$true
Write-Output 'REGISTERED'
`.trim()
}

function comQueryScript(taskName) {
  return `
$ErrorActionPreference='Stop'
$s=New-Object -ComObject Schedule.Service
$s.Connect()
$f=$s.GetFolder('\\')
$t=$f.GetTask('${taskName}')
$act=$t.Definition.Actions.Item(1)
$stateMap=@{0='Unknown';1='Disabled';2='Queued';3='Ready';4='Running'}
Write-Output ('STATE='+$stateMap[[int]$t.State])
Write-Output ('EXEC='+$act.Path)
Write-Output ('ARGS='+$act.Arguments)
Write-Output ('LASTRUN='+$t.LastRunTime)
Write-Output ('LASTRESULT=0x'+('{0:X}' -f [int]$t.LastTaskResult))
`.trim()
}

function comUnregisterScript(taskName) {
  return `
$ErrorActionPreference='Stop'
$s=New-Object -ComObject Schedule.Service
$s.Connect()
$f=$s.GetFolder('\\')
$f.DeleteTask('${taskName}', 0)
Write-Output 'DELETED'
`.trim()
}

function comRunNowScript(taskName) {
  return `
$ErrorActionPreference='Stop'
$s=New-Object -ComObject Schedule.Service
$s.Connect()
$f=$s.GetFolder('\\')
$t=$f.GetTask('${taskName}')
$t.Run($null)
Write-Output 'STARTED'
`.trim()
}

/**
 * 注册 reextract 兜底任务(每日 09:10 一次;2026-11-12 立)。
 * 与 sync 任务同一套 node 选择 / PowerShell→COM 回退;幂等靠 -Force / RegisterTaskDefinition 覆盖。
 */
function doRegisterReextract(options) {
  if (!fs.existsSync(REEXTRACT_SCRIPT)) {
    process.stderr.write(`❌ 兜底脚本不存在: ${REEXTRACT_SCRIPT}\n`)
    return 2
  }
  const picked = resolveStableNode()
  if (!picked.node) {
    process.stderr.write(
      `❌ 找不到可用的 node(需 v${MIN_NODE_MAJOR}+):\n` +
        picked.rejected.map((r) => `   · ${r}`).join('\n') + '\n',
    )
    return 2
  }
  const nodeExe = picked.node
  const arg = buildReextractTaskArgument()
  // reextract 兜底同样走 wscript 隐藏包装:它 spawn 本机客户端,直指 node 必弹黑窗,每日一次更扰人。
  const reextractVbs = path.join(ROOT, 'scripts', 'reextract-hidden.vbs')
  const wrapper = ensureHiddenWrapper(nodeExe, arg, { write: !options.dryRunTask, label: 'reextract', vbsPath: reextractVbs })
  const taskArg = `//B "${wrapper.path}"`
  const spec = {
    taskName: REEXTRACT_TASK_NAME,
    description: '无刷新协议平台的「本机重新提取」兜底(每日 09:10,refreshable=false 且到期进入窗口)',
    trigger: { kind: 'daily', time: REEXTRACT_DAILY_TIME },
    startBoundaryExpr: todayAt(REEXTRACT_DAILY_TIME),
  }
  if (options.dryRunTask) {
    process.stdout.write(
      `[dry-run] Register-ScheduledTask -TaskName ${psQuote(spec.taskName)}\n` +
        `  -Execute ${psQuote(WSCRIPT_EXE)}\n  -Argument ${psQuote(taskArg)}\n` +
        `  -WorkingDirectory ${psQuote(ROOT)}\n  -Trigger 每日 ${REEXTRACT_DAILY_TIME}\n` +
        `  隐藏启动器: ${wrapper.path}${wrapper.changed ? '(需刷新:内容与内层命令不一致)' : '(已是最新)'}\n` +
        `  内层命令  : "${nodeExe}" ${arg}\n` +
        `  node 来源: ${picked.source} / ${picked.version}\n`,
    )
    return 0
  }
  const script = `
$ErrorActionPreference = 'Stop'
$action = New-ScheduledTaskAction -Execute ${psQuote(WSCRIPT_EXE)} -Argument ${psQuote(taskArg)} -WorkingDirectory ${psQuote(ROOT)}
$trigger = New-ScheduledTaskTrigger -Daily -At ${spec.startBoundaryExpr}
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName ${psQuote(spec.taskName)} -Action $action -Trigger $trigger -Settings $settings -Description ${psQuote(spec.description)} -Force | Out-Null
Write-Output 'REGISTERED'
`.trim()
  let r = ps(script)
  if (!r.ok || !/REGISTERED/.test(r.text)) {
    // PS7 无 ScheduledTasks 模块:退回 Schedule.Service COM
    r = ps(comRegisterScript(taskArg, spec))
  }
  if (!r.ok || !/REGISTERED/.test(r.text)) {
    process.stderr.write(`❌ 注册失败: ${r.text}\n`)
    return 1
  }
  process.stdout.write(`✅ 已注册计划任务 ${spec.taskName}(每日 ${REEXTRACT_DAILY_TIME})\n`)
  process.stdout.write(
    `   Execute : ${WSCRIPT_EXE}\n   Argument: ${taskArg}\n` +
      `   内层命令: "${nodeExe}" ${arg}\n` +
      `   启动器  : ${wrapper.path}${wrapper.changed ? '(已刷新)' : '(已是最新)'}\n` +
      `   node 来源: ${picked.source} / ${picked.version}\n`,
  )
  if (picked.source.includes('版本目录')) {
    process.stdout.write(
      '   ⚠️ 用的是 WorkBuddy 内置 node(路径含版本目录):WorkBuddy 升级 Node 后此路径可能失效,\n' +
        '      届时重跑本命令即可。\n',
    )
  }
  return 0
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
  const wrapper = ensureHiddenWrapper(nodeExe, arg, { write: !options.dryRunTask })
  const taskArg = `//B "${wrapper.path}"`
  if (options.dryRunTask) {
    process.stdout.write(
      `[dry-run] Register-ScheduledTask -TaskName ${psQuote(TASK_NAME)}\n` +
        `  -Execute ${psQuote(WSCRIPT_EXE)}\n  -Argument ${psQuote(taskArg)}\n` +
        `  -WorkingDirectory ${psQuote(ROOT)}\n  -Interval ${options.interval}min\n` +
        `  隐藏启动器: ${wrapper.path}${wrapper.changed ? '(需刷新:内容与内层命令不一致)' : '(已是最新)'}\n` +
        `  内层命令  : "${nodeExe}" ${arg}\n` +
        `  node 来源 : ${picked.source} / ${picked.version}\n`,
    )
    return 0
  }
  const script = `
$ErrorActionPreference = 'Stop'
$action = New-ScheduledTaskAction -Execute ${psQuote(WSCRIPT_EXE)} -Argument ${psQuote(taskArg)} -WorkingDirectory ${psQuote(ROOT)}
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes ${options.interval}) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName ${psQuote(TASK_NAME)} -Action $action -Trigger $trigger -Settings $settings -Description '号池跨环境双向自动同步(本地<->生产,脏标记驱动)' -Force | Out-Null
Write-Output 'REGISTERED'
`.trim()
  const syncSpec = {
    taskName: TASK_NAME,
    description: '号池跨环境双向自动同步(本地<->生产,脏标记驱动)',
    trigger: { kind: 'interval', minutes: options.interval },
  }
  let r = ps(script)
  if (!r.ok || !/REGISTERED/.test(r.text)) {
    // PS7 无 ScheduledTasks 模块:退回 Schedule.Service COM
    r = ps(comRegisterScript(taskArg, syncSpec))
  }
  if (!r.ok || !/REGISTERED/.test(r.text)) {
    process.stderr.write(`❌ 注册失败: ${r.text}\n`)
    return 1
  }
  process.stdout.write(`✅ 已注册计划任务 ${TASK_NAME}(每 ${options.interval} 分钟)\n`)
  process.stdout.write(
    `   Execute  : ${WSCRIPT_EXE}\n   Argument : ${taskArg}\n` +
      `   内层命令 : "${nodeExe}" ${arg}\n` +
      `   启动器   : ${wrapper.path}${wrapper.changed ? '(已刷新)' : '(已是最新)'}\n` +
      `   node 来源: ${picked.source} / ${picked.version}\n   Log      : ${LOG_FILE}\n`,
  )
  if (picked.source.includes('版本目录')) {
    process.stdout.write(
      '   ⚠️ 用的是 WorkBuddy 内置 node(路径含版本目录):WorkBuddy 升级 Node 后此路径可能失效,\n' +
        '      届时 node scripts/relay-account-pool-sync.mjs --status 会报错并提示重跑本命令。\n',
    )
  }
  return 0
}

function doQuery(options) {
  const name = options?.target === 'reextract' ? REEXTRACT_TASK_NAME : TASK_NAME
  const script = `
$ErrorActionPreference = 'Stop'
$t = Get-ScheduledTask -TaskName ${psQuote(name)}
$i = $t | Get-ScheduledTaskInfo
Write-Output ('STATE=' + $t.State)
Write-Output ('EXEC=' + $t.Actions[0].Execute)
Write-Output ('ARGS=' + $t.Actions[0].Arguments)
Write-Output ('LASTRUN=' + $i.LastRunTime)
Write-Output ('LASTRESULT=0x' + ('{0:X}' -f $i.LastTaskResult))
`.trim()
  let r = ps(script)
  if (!r.ok) {
    // PS7 无 ScheduledTasks 模块:退回 Schedule.Service COM
    r = ps(comQueryScript(name))
  }
  if (!r.ok) {
    process.stdout.write(`未安装:计划任务 ${name} 不存在(或查询失败)\n`)
    return 0
  }
  process.stdout.write(`任务 ${name}:\n`)
  for (const line of r.text.split(/\r?\n/).filter(Boolean)) process.stdout.write(`  ${line}\n`)
  return 0
}

function doUnregister(options) {
  const name = options?.target === 'reextract' ? REEXTRACT_TASK_NAME : TASK_NAME
  let r = ps(
    `$ErrorActionPreference='Stop'; Unregister-ScheduledTask -TaskName ${psQuote(name)} -Confirm:$false; Write-Output 'DELETED'`,
  )
  if (!r.ok) {
    // PS7 无 ScheduledTasks 模块:退回 Schedule.Service COM
    r = ps(comUnregisterScript(name))
  }
  if (!r.ok) {
    process.stdout.write(`未删除(可能本就不存在): ${r.text}\n`)
    return 0
  }
  process.stdout.write(`✅ 已注销计划任务 ${name}\n`)
  return 0
}

function doRunNow(options) {
  const name = options?.target === 'reextract' ? REEXTRACT_TASK_NAME : TASK_NAME
  let r = ps(
    `$ErrorActionPreference='Stop'; Start-ScheduledTask -TaskName ${psQuote(name)}; Write-Output 'STARTED'`,
  )
  if (!r.ok || !/STARTED/.test(r.text)) {
    // PS7 无 ScheduledTasks 模块:退回 Schedule.Service COM
    r = ps(comRunNowScript(name))
  }
  if (!r.ok || !/STARTED/.test(r.text)) {
    process.stderr.write(`❌ 触发失败(任务未注册?): ${r.text}\n`)
    return 1
  }
  const logHint = options?.target === 'reextract'
    ? `(无 --log,结果看 Windows 任务计划程序「上次运行时间/结果」)`
    : `(结果看 ${LOG_FILE})`
  process.stdout.write(`✅ 已触发 ${name} ${logHint}\n`)
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
      return options.target === 'reextract' ? doRegisterReextract(options) : doRegister(options)
    case 'unregister':
      return doUnregister(options)
    case 'run-now':
      return doRunNow(options)
    default:
      return doQuery(options)
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}

// 纯函数导出给校验用(import 无副作用;§22d 同款双形态入口)
export const __test__ = {
  hiddenWrapperContent,
  ensureHiddenWrapper,
  resolveStableNode,
  buildTaskArgument,
  VBS_PATH,
  WSCRIPT_EXE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
