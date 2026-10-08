// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-670 唯一的杀进程出口:杀之前必须现场复核进程身份(executablePath + commandLine)。
 *
 * 立因(2026-09-29 立项):self-healing 的端口修复此前直接对**客户端自报**的
 * forceKillPid 执行 `taskkill /PID <pid> /F` —— 端口探针从不识别持有者,pid 被复用/
 * 报错时杀掉的是无关的活进程(可能是 svchost),而响应回得像清理成功。
 *
 * 三条设计口径(三态纪律与 scripts/lib/proc-identity.mjs 同族 —— 那一层住在工具层,
 * apps/api 按架构契约不得向上摸它,故此处复刻它的纪律而非它的实现):
 *  - 期望特征比对不成立 ⇒ **拒杀**,并输出一条可诊断记录(点名 pid、期望特征、实得特征);
 *  - 现场信息取不到(进程不存在 / 探针失败)⇒ **未判定 ⇒ 不杀**(宁可不杀也不误杀);
 *  - 判定(judgeKillIdentity)与执行(本文件 spawn 终止命令)只在这一处 ——
 *    "两处算同一件事必漂移"是本仓记过最多次的失败型,调用方不得自行比对后再杀。
 *
 * 可注入:deps.inspect / deps.runKill / deps.isAlive,测试成对钉死判据时不派生任何真实进程。
 * Windows 上没有 ps:经 `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"` 取身份;
 * 探针命令 pwsh(PS7)优先、powershell.exe 绝对路径兜底 —— WDAC/应用控制策略主机拦截
 * node 派生的 powershell.exe(5.1)报 EPERM(本仓开发机实证),见 winProbeCommandCandidates;
 * 派生一律 windowsHide + timeout(AGENTS §5b / 守门 52、80)。
 *
 * G-998132(2026-09-30 立项):杀完的终态按 OS 事实判 —— 命令派发成功 ≠ killed:true。
 * 上游判据(processTreeTerminator.ts:165-176):终止命令报错**且**存活复核确认在场才算真失败;
 * 命令非零但进程确实没了 = 不误报失败;进程还在但命令成功 = 也不装成功。
 * 终止命令的派生出口返回 { ok, output }(ok=命令是否派发成功),不再把 err 折进输出字符串
 * (调用方拿不到"命令失败"这一维是本票点名的病灶);旧形注入(裸字符串)按未报失败处理,
 * 终局一律以 OS 存活复核结算。存活复核口异常 ⇒ 保守按"仍在"处理,不装成功。
 */
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, readlinkSync } from 'node:fs'
import { join } from 'node:path'
import { platform } from 'node:os'

export interface ProcIdentitySnapshot {
  executablePath: string | null
  commandLine: string | null
  /**
   * G-998126:进程创建时刻的微秒串(`windows-utc-us:<µs>`,由 Win32 CreationDate.Ticks
   * 归一)。机制对标上游 processTreeSnapshot.ts:146-184 —— 秒级 StartTime 在
   * "同一秒内被复用"这一档结构性失明,tick/微秒量纲才可分辨。取不到 ⇒ null(可选:
   * 旧快照构造方与 linux 探针不带该维)。
   */
  creationUtcUs?: string | null
}

/** 现测某 pid 的身份;进程不存在或取不到 ⇒ null(⇒ 未判定)。 */
export type ProcIdentityInspector = (pid: number) => Promise<ProcIdentitySnapshot | null>

export interface KillIdentityExpectation {
  /** executablePath 须不区分大小写包含该子串;不给 ⇒ 不判这一维(仍取回并记录)。 */
  executablePathIncludes?: string
  /** commandLine 须命中至少一个(不区分大小写);空/不给 ⇒ 不判这一维。 */
  commandLineAnyOf?: string[]
  /**
   * G-998126:创建时刻微秒串须**全等**(字符串比对,ticks 量级超出 JS 安全整数故不进数值域)。
   * 不给 ⇒ 不判这一维;给了而实得缺位 ⇒ 不成立(同 exe+cmdline 的同秒复用进程照样拒杀)。
   */
  creationUtcUs?: string
}

/** 派生终止命令的出口由本文件选定(bin/argv 不由调用方注入,防"注入命令"的第二真相)。 */
export interface KillCommandResult {
  /** 命令是否派发成功(非零退出/异常 = false);真终态另由 OS 存活复核结算。 */
  ok: boolean
  /** 可诊断输出。 */
  output: string
}

/** 旧形注入返回裸字符串 ⇒ 按"未报失败"处理;终局以 OS 存活复核结算(G-998132)。 */
export type KillExecutor = (bin: string, argv: string[]) => Promise<string | KillCommandResult>

/** 存活复核口:该 pid 现测是否仍在场(信号 0 探测,不杀伤)。 */
export type PidLivenessProbe = (pid: number) => Promise<boolean>

/**
 * 默认存活复核:`process.kill(pid, 0)` 只探存在性不发信号;EPERM = 在场但无权发信号
 * ⇒ 按在场处理(保守:无权确认消失 ≠ 消失)。其余错误(ESRCH 等)⇒ 不在场。
 */
export const defaultPidLivenessProbe: PidLivenessProbe = async (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export interface KillVerifiedDeps {
  inspect?: ProcIdentityInspector
  runKill?: KillExecutor
  /** 杀后 OS 事实复核口(缺省 defaultPidLivenessProbe);终态结算以此为准,不信命令回执。 */
  isAlive?: PidLivenessProbe
}

export type KillVerifiedOutcome =
  | {
      killed: true
      pid: number
      command: string
      output: string
      /** G-998132:命令回执与 OS 事实冲突时的可诊断说明(命令报失败但 OS 复核确认已不在)。 */
      observation?: string
    }
  | {
      killed: false
      pid: number
      reason: 'invalid-pid' | 'identity-mismatch' | 'undetermined' | 'kill-verify-failed'
      /** 可诊断记录:点名 pid、期望特征、实得特征。 */
      record: string
    }

function describeExpectation(e: KillIdentityExpectation): string {
  const parts: string[] = []
  if (e.executablePathIncludes) parts.push(`executablePath 须含 "${e.executablePathIncludes}"`)
  if (e.commandLineAnyOf && e.commandLineAnyOf.length > 0) {
    parts.push(`commandLine 须命中 ${JSON.stringify(e.commandLineAnyOf)} 之一`)
  }
  if (e.creationUtcUs !== undefined) parts.push(`creationUtcUs 须全等 "${e.creationUtcUs}"`)
  return parts.length > 0 ? parts.join(' ∧ ') : '(未设特征 ⇒ 仅要求进程在场)'
}

/** 纯判定(导给测试钉成对判据):期望维不给 ⇒ 该维放过;给了而实得缺位 ⇒ 不成立。 */
export function judgeKillIdentity(
  snapshot: ProcIdentitySnapshot,
  expectation: KillIdentityExpectation,
): { ok: true } | { ok: false; why: string } {
  const misses: string[] = []
  if (expectation.executablePathIncludes) {
    const needle = expectation.executablePathIncludes.toLowerCase()
    const have = snapshot.executablePath?.toLowerCase() ?? ''
    if (!have.includes(needle)) {
      misses.push(
        `executablePath 实得 ${JSON.stringify(snapshot.executablePath)} 未含 "${expectation.executablePathIncludes}"`,
      )
    }
  }
  if (expectation.commandLineAnyOf && expectation.commandLineAnyOf.length > 0) {
    const have = snapshot.commandLine?.toLowerCase() ?? ''
    const hit = expectation.commandLineAnyOf.some((m) => have.includes(m.toLowerCase()))
    if (!hit) {
      misses.push(
        `commandLine 实得 ${JSON.stringify(snapshot.commandLine)} 未命中 ${JSON.stringify(expectation.commandLineAnyOf)} 之一`,
      )
    }
  }
  if (expectation.creationUtcUs !== undefined) {
    // G-998126:同 exe + 同 cmdline 的"同秒复用"进程,只有这一维能分辨。
    // 字符串全等比对;实得缺位(null)= 量纲取不到 ⇒ 不成立,不得放行。
    if (snapshot.creationUtcUs !== expectation.creationUtcUs) {
      misses.push(
        `creationUtcUs 实得 ${JSON.stringify(snapshot.creationUtcUs)} 须全等 ${JSON.stringify(expectation.creationUtcUs)}`,
      )
    }
  }
  return misses.length > 0 ? { ok: false, why: misses.join(';') } : { ok: true }
}

const WIN_PROBE_NONE = 'IHUI-PROC-NONE'

/** 解析 Windows 探针输出(纯函数):进程不在 ⇒ null;profile 噪声行按前缀自然忽略。 */
export function parseProcProbeOutput(raw: string): ProcIdentitySnapshot | null {
  let executablePath: string | null = null
  let commandLine: string | null = null
  let creationUtcUs: string | null = null
  let seen = false
  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const l = line.trim()
    if (l === WIN_PROBE_NONE) return null
    if (l.startsWith('IHUI-EP=')) {
      seen = true
      const v = l.slice('IHUI-EP='.length).trim()
      executablePath = v === '' ? null : v
    } else if (l.startsWith('IHUI-CL=')) {
      seen = true
      const v = l.slice('IHUI-CL='.length).trim()
      commandLine = v === '' ? null : v
    } else if (l.startsWith('IHUI-CU=')) {
      // G-998126:CreationDate.Ticks 归一的微秒串(格式 windows-utc-us:<µs>);缺位/噪音 ⇒ null
      seen = true
      const v = l.slice('IHUI-CU='.length).trim()
      creationUtcUs = /^windows-utc-us:\d+$/.test(v) ? v : null
    }
  }
  return seen ? { executablePath, commandLine, creationUtcUs } : null
}

/**
 * win32 CIM 探针命令偏好序(全部绝对路径 —— 本探针参与"杀进程前身份复核"安全链,
 * PATH 解析可被顶替 ⇒ 身份比对可被伪造,故不落 PATH 短名)。pwsh(PS7)优先:
 * 部分 Windows 主机的 WDAC/应用控制策略拦截 node 派生的 powershell.exe(5.1)而
 * 放行 PS7(本仓开发机实证 spawn EPERM;mcp-credentials.ts 的 DPAPI 引擎链同款结论);
 * powershell.exe 绝对路径兜底覆盖未装 PS7 的常规镜像。存在性预筛 + 仅 spawn 即时
 * 失败(EPERM/ENOENT/EACCES)回退下一候选;超时/非零退出不回退 —— 探针失败 ⇒
 * 未判定 ⇒ 不杀(宁可不杀也不误杀),也不放大单 pid 探针时长。
 */
function winProbeCommandCandidates(): string[] {
  const list: string[] = []
  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  for (const candidate of [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    localAppData === '' ? '' : join(localAppData, 'Microsoft', 'WindowsApps', 'pwsh.exe'),
  ]) {
    if (candidate !== '' && existsSync(candidate)) list.push(candidate)
  }
  list.push('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
  return list
}

async function runPowerShellProbe(pid: number): Promise<string> {
  // G-998126:补一发 CreationDate.Ticks 归一的微秒串 —— 秒级 StartTime 分辨不了
  // "同一秒内被复用"的进程,tick/微秒量纲才可分辨(机制对标上游 processTreeSnapshot.ts)。
  // .NET Ticks(100ns,自 0001-01-01)减去纪元差后整串留在 PowerShell 侧算,
  // 6.4e17 量级不进 JS 数值域。
  const NET_TICKS_TO_UNIX = '621355968000000000'
  const script =
    `$ErrorActionPreference='Stop';` +
    `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}";` +
    `if($null -eq $p){'${WIN_PROBE_NONE}'}else{` +
    `'IHUI-EP='+[string]$p.ExecutablePath;` +
    `'IHUI-CL='+[string]$p.CommandLine;` +
    `if($null -ne $p.CreationDate){'IHUI-CU=windows-utc-us:'+([long](([long]$p.CreationDate.Ticks - ${NET_TICKS_TO_UNIX})/10))}}`
  let lastError: unknown = new Error('win32 CIM 探针命令偏好序为空')
  for (const command of winProbeCommandCandidates()) {
    try {
      return await new Promise<string>((resolvePromise, rejectPromise) => {
        execFile(
          command,
          ['-NoProfile', '-NonInteractive', '-Command', script],
          { timeout: 15_000, shell: false, windowsHide: true, maxBuffer: 1 << 20 },
          (err, out) => (err ? rejectPromise(err) : resolvePromise(out)),
        )
      })
    } catch (error) {
      lastError = error
      const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined
      if (code === 'EPERM' || code === 'ENOENT' || code === 'EACCES') continue
      throw error
    }
  }
  throw lastError
}

/** 默认探针:win32 走 Get-CimInstance;linux 走 /proc;其余平台量不到 ⇒ null(未判定)。 */
export const defaultProcInspector: ProcIdentityInspector = async (pid) => {
  const os = platform()
  if (os === 'win32') {
    try {
      return parseProcProbeOutput(await runPowerShellProbe(pid))
    } catch {
      return null
    }
  }
  if (os === 'linux') {
    try {
      let executablePath: string | null = null
      try {
        executablePath = readlinkSync(`/proc/${pid}/exe`)
      } catch {
        executablePath = null
      }
      const commandLine = readFileSync(`/proc/${pid}/cmdline`, 'latin1')
        .replace(/\0+$/, '')
        .split('\0')
        .join(' ')
      return {
        executablePath,
        commandLine: commandLine === '' ? null : commandLine,
        // linux 侧 /proc/<pid>/stat field 22(boot-tick)量纲不同,不在本探针归一 ⇒ null
        creationUtcUs: null,
      }
    } catch {
      return null
    }
  }
  return null
}

const defaultKillExecutor: KillExecutor = (bin, argv) =>
  new Promise((resolvePromise) => {
    execFile(
      bin,
      argv,
      { timeout: 15_000, shell: false, windowsHide: true },
      (err, out, errOut) => {
        const text = (
          err
            ? `${String(err.message)}\n${String(out)}\n${String(errOut)}`
            : String(out || errOut || 'done')
        )
          .trim()
          .slice(-1000)
        // G-998132:err 不再折进输出字符串 —— ok 维必须显式交给结算层
        resolvePromise({ ok: !err, output: text })
      },
    )
  })

/**
 * 唯一杀进程出口:现场取身份 ⇒ 纯判定 ⇒ 成立才派生终止命令。
 * 任何要杀进程的调用方都走这里;判定与派生不得在调用方各写一份。
 */
export async function killProcessVerified(
  pid: number,
  expectation: KillIdentityExpectation,
  deps: KillVerifiedDeps = {},
): Promise<KillVerifiedOutcome> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return { killed: false, pid, reason: 'invalid-pid', record: `pid 不可用(${String(pid)})⇒ 不杀` }
  }
  const inspect = deps.inspect ?? defaultProcInspector
  let snapshot: ProcIdentitySnapshot | null
  let probeError = ''
  try {
    snapshot = await inspect(pid)
  } catch (e) {
    snapshot = null
    probeError = `;探针异常:${e instanceof Error ? e.message : String(e)}`
  }
  if (snapshot === null) {
    return {
      killed: false,
      pid,
      reason: 'undetermined',
      record: `pid ${pid} 现场身份取不到(进程不存在或探针失败${probeError})⇒ 未判定 ⇒ 不杀。期望:${describeExpectation(expectation)}`,
    }
  }
  const verdict = judgeKillIdentity(snapshot, expectation)
  if (!verdict.ok) {
    return {
      killed: false,
      pid,
      reason: 'identity-mismatch',
      record:
        `pid ${pid} 身份复核不成立 ⇒ 拒杀(未派生任何终止命令)。` +
        `期望:${describeExpectation(expectation)};` +
        `实得:executablePath=${JSON.stringify(snapshot.executablePath)} commandLine=${JSON.stringify(snapshot.commandLine)} creationUtcUs=${JSON.stringify(snapshot.creationUtcUs)};` +
        verdict.why,
    }
  }
  const isWin = platform() === 'win32'
  const bin = isWin ? 'taskkill' : 'kill'
  const argv = isWin ? ['/PID', String(pid), '/F'] : ['-9', String(pid)]
  const runKill = deps.runKill ?? defaultKillExecutor
  const isAlive = deps.isAlive ?? defaultPidLivenessProbe
  const dispatched = await runKill(bin, argv)
  // G-998132:命令回执只算"派发维度",终态一律按 OS 存活复核结算 ——
  // 命令非零但进程确实没了 = 不误报失败;进程还在但命令成功 = 也不装成功。
  const commandOk =
    typeof dispatched === 'object' && dispatched !== null && typeof dispatched.ok === 'boolean'
      ? dispatched.ok
      : true // 旧形(裸字符串)未报失败维度 ⇒ 按"未报失败"处理,终局仍看 OS 复核
  const output = typeof dispatched === 'string' ? dispatched : dispatched.output
  let alive: boolean
  let probeNote = ''
  try {
    alive = await isAlive(pid)
  } catch (e) {
    // 复核口自身异常 ⇒ 未判定 ⇒ 保守按"仍在"处理,不装成功
    alive = true
    probeNote = `;存活复核口异常(${e instanceof Error ? e.message : String(e)})⇒ 按仍在处理`
  }
  if (!alive) {
    return {
      killed: true,
      pid,
      command: isWin ? `taskkill /PID ${pid} /F` : `kill -9 ${pid}`,
      output,
      ...(commandOk
        ? {}
        : {
            observation: `pid ${pid} 终止命令报失败(${output})但 OS 存活复核确认已不在 ⇒ 结算为已不在,不误报失败`,
          }),
    }
  }
  return {
    killed: false,
    pid,
    reason: 'kill-verify-failed',
    record:
      `pid ${pid} 终止命令已派发(命令${commandOk ? '报成功' : '报失败'})但 OS 存活复核仍确认在场${probeNote} ⇒ 不装成功。` +
      `命令输出:${output}`,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
