// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/register-signin-residency-task.mjs — 签到常驻腿计划任务注册器(2026-11-16)
 *
 * 形态照抄 IHUI-Pool-Sync 先例(本机实测可用的注册路径):
 *   主体 = wscript.exe //B "<隐藏 vbs>",vbs 内层 = "<稳定 node>" "<ensure 执行体>" --ensure --quiet
 *   触发 = 每 RESIDENCY_INTERVAL_MINUTES(30) 分钟;任务级多实例策略默认 IgnoreNew ⇒ 天然单飞
 *   schtasks.exe 本机被黑名单、PS7 无 ScheduledTasks 模块 ⇒ PowerShell(5.1)主路 + Schedule.Service COM 回退,
 *   两套模板全部从 register-pool-sync-task.mjs 的 __test__ export 面 import(§0.6 零第二份实现)。
 *
 * 闸 = scripts/lib/dev-stack-residency-policy.mjs 的 judgeSigninLegResidency(2026-11-16 机主定向裁决);
 * 机主关闸 = IHUI_SIGNIN_RESIDENCY_DISABLE=1 ⇒ 拒装并给出路(失效方向恒为「多要一次定向说明」)。
 *
 * 用法:
 *   node scripts/register-signin-residency-task.mjs --register [--interval 30] [--dry-run-task]
 *   node scripts/register-signin-residency-task.mjs --query | --run-now | --unregister
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { judgeSigninLegResidency } from './lib/dev-stack-residency-policy.mjs'
import { RESIDENCY_INTERVAL_MINUTES, healthProbeUrl } from './lib/ai-service-residency-runtime.mjs'
import { __test__ as poolRuntime } from './register-pool-sync-task.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const TASK_NAME = 'IHUI AI Service Signin Residency'
const ENSURE_SCRIPT = path.join(ROOT, 'scripts', 'ensure-ai-service-residency.mjs')
const VBS_PATH = path.join(ROOT, 'scripts', 'ai-service-residency-hidden.vbs')

const HELP = `签到常驻腿计划任务管理(机主 2026-11-16 定向裁决落地;闸见 dev-stack-residency-policy)

用法:
  --register [--interval <min>=${RESIDENCY_INTERVAL_MINUTES}] [--dry-run-task]  注册/刷新幂等自检任务
  --query     查询任务状态/上次运行/上次结果
  --run-now   立即触发一轮 ensure
  --unregister  注销任务(机主收回常驻授权的卸载正道)

说明:
  · 探测 ${healthProbeUrl()} —— 在位零动作;不在位且无活 pid 账本才 spawn(单 worker 契约由 runtime lib 守卫);
  · IHUI_SIGNIN_RESIDENCY_DISABLE=1 时本注册器一律拒装(不给隐式绕闸,§0.10);
  · 隐藏启动器 .vbs 由注册器生成(SW_HIDE,wscript 按 ANSI 解码 ⇒ 纯 ASCII)。`

function parseArgs(argv) {
  const options = { action: 'query', interval: RESIDENCY_INTERVAL_MINUTES, dryRunTask: false }
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
      if (!Number.isFinite(v) || v < 5)
        return { options: null, error: '--interval 需要 >= 5 的分钟数(拒绝再造 2 分钟复活风暴)' }
      options.interval = Math.floor(v)
    } else return { options: null, error: `未知参数: ${arg}` }
  }
  return { options, error: null }
}

/** ensure 的内层参数(稳定形态;日志由执行体自己落 .ihui-agent/state)。 */
export function buildSigninTaskArgument() {
  return `"${ENSURE_SCRIPT}" --ensure --quiet`
}

function requirePolicyGate() {
  const verdict = judgeSigninLegResidency({ env: process.env })
  if (!verdict.allowed) {
    process.stderr.write(`❌ 拒装(常驻闸未开):${verdict.why}\n`)
    process.exit(2)
  }
  return verdict
}

function doRegister(options) {
  requirePolicyGate()
  if (!fs.existsSync(ENSURE_SCRIPT)) {
    process.stderr.write(`❌ 执行体不存在: ${ENSURE_SCRIPT}\n`)
    return 2
  }
  const picked = poolRuntime.resolveStableNode()
  if (!picked.node) {
    process.stderr.write(
      `❌ 找不到可用的 node(版本下限由池同族判据把关):\n` +
        (picked.rejected ?? []).map((r) => `   · ${r}`).join('\n') +
        '\n',
    )
    return 2
  }
  const arg = buildSigninTaskArgument()
  const wrapper = poolRuntime.ensureHiddenWrapper(picked.node, arg, {
    write: !options.dryRunTask,
    label: 'signin-residency',
    vbsPath: VBS_PATH,
  })
  const taskArg = `//B "${wrapper.path}"`
  const spec = {
    taskName: TASK_NAME,
    description: `签到/保活常驻腿 30min 幂等自检(在位零动作;机主 2026-11-16 定案,卸载=--unregister)`,
    trigger: { kind: 'interval', minutes: options.interval },
  }
  if (options.dryRunTask) {
    process.stdout.write(
      `[dry-run] Register: ${spec.taskName}\n` +
        `  -Execute ${poolRuntime.psQuote(poolRuntime.WSCRIPT_EXE)}\n` +
        `  -Argument ${poolRuntime.psQuote(taskArg)}\n` +
        `  -WorkingDirectory ${poolRuntime.psQuote(ROOT)}\n` +
        `  -Trigger 每 ${options.interval} 分钟\n` +
        `  隐藏启动器: ${wrapper.path}${wrapper.changed ? '(需刷新)' : '(已是最新)'}\n` +
        `  内层命令  : "${picked.node}" ${arg}\n` +
        `  node 来源: ${picked.source} / ${picked.version}\n`,
    )
    return 0
  }
  // 主路 PowerShell(ScheduledTasks 模块),回退 COM —— 与 IHUI-Pool-Sync 完全同路
  let r = poolRuntime.ps(
    `$ErrorActionPreference='Stop'; Register-ScheduledTask -TaskName ${poolRuntime.psQuote(spec.taskName)} ` +
      `-Action (New-ScheduledTaskAction -Execute ${poolRuntime.psQuote(poolRuntime.WSCRIPT_EXE)} ` +
      `-Argument ${poolRuntime.psQuote(taskArg)} -WorkingDirectory ${poolRuntime.psQuote(ROOT)}) ` +
      `-Trigger (New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) ` +
      `-RepetitionInterval (New-TimeSpan -Minutes ${options.interval})) ` +
      `-Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable ` +
      `-MultipleInstances IgnoreNew) ` +
      `-Description ${poolRuntime.psQuote(spec.description)} -Force | Out-Null; Write-Output 'REGISTERED'`,
  )
  if (!r.ok || !/REGISTERED/.test(r.text)) {
    r = poolRuntime.ps(poolRuntime.comRegisterScript(taskArg, spec))
  }
  if (!r.ok || !/REGISTERED/.test(r.text)) {
    process.stderr.write(`❌ 注册失败: ${r.text}\n`)
    return 1
  }
  process.stdout.write(
    `✅ 已注册 ${spec.taskName}(每 ${options.interval} 分钟幂等自检)\n   node: ${picked.node}(${picked.version})\n   现在可 --run-now 或等下一拍;读数 --query\n`,
  )
  return 0
}

function doQuery() {
  let r = poolRuntime.ps(
    `$ErrorActionPreference='Stop'; $t=Get-ScheduledTask -TaskName ${poolRuntime.psQuote(TASK_NAME)}; $i=$t | Get-ScheduledTaskInfo; Write-Output ('STATE='+[string]$t.State); Write-Output ('LASTRUN='+[string]$i.LastRunTime); Write-Output ('NEXTRUN='+[string]$i.NextRunTime); Write-Output ('LASTRESULT=0x'+('{0:X}' -f [int]$i.LastTaskResult))`,
  )
  if (!r.ok) r = poolRuntime.ps(poolRuntime.comQueryScript(TASK_NAME))
  if (!r.ok) {
    process.stdout.write(`读数失败(任务可能未注册): ${r.text}\n`)
    return 1
  }
  process.stdout.write(`${r.text}\n`)
  return 0
}

function doUnregister() {
  let r = poolRuntime.ps(
    `$ErrorActionPreference='Stop'; Unregister-ScheduledTask -TaskName ${poolRuntime.psQuote(TASK_NAME)} -Confirm:$false; Write-Output 'DELETED'`,
  )
  if (!r.ok) r = poolRuntime.ps(poolRuntime.comUnregisterScript(TASK_NAME))
  if (!r.ok) {
    process.stdout.write(`未删除(可能本就不存在): ${r.text}\n`)
    return 0
  }
  process.stdout.write(`✅ 已注销 ${TASK_NAME}\n`)
  return 0
}

function doRunNow() {
  let r = poolRuntime.ps(
    `$ErrorActionPreference='Stop'; Start-ScheduledTask -TaskName ${poolRuntime.psQuote(TASK_NAME)}; Write-Output 'STARTED'`,
  )
  if (!r.ok || !/STARTED/.test(r.text)) r = poolRuntime.ps(poolRuntime.comRunNowScript(TASK_NAME))
  if (!r.ok || !/STARTED/.test(r.text)) {
    process.stderr.write(`❌ 触发失败(任务未注册?): ${r.text}\n`)
    return 1
  }
  process.stdout.write(
    `✅ 已触发 ${TASK_NAME}(ensure 读数看 ${path.join(ROOT, '.ihui-agent', 'state', 'ai-service-residency.log')})\n`,
  )
  return 0
}

function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n\n${HELP}\n`)
    return 2
  }
  switch (parsed.options.action) {
    case 'help':
      process.stdout.write(`${HELP}\n`)
      return 0
    case 'register':
      return doRegister(parsed.options)
    case 'unregister':
      return doUnregister()
    case 'query':
      return doQuery()
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

export const __test__ = { buildSigninTaskArgument, TASK_NAME, HELP, parseArgs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
