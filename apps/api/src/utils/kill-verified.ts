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
 * 可注入:deps.inspect / deps.runKill,测试成对钉死判据时不派生任何真实进程。
 * Windows 上没有 ps:经 `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"` 取身份;
 * 派生一律 windowsHide + timeout(AGENTS §5b / 守门 52、80)。
 */
import { execFile } from 'node:child_process'
import { readFileSync, readlinkSync } from 'node:fs'
import { platform } from 'node:os'

export interface ProcIdentitySnapshot {
  executablePath: string | null
  commandLine: string | null
}

/** 现测某 pid 的身份;进程不存在或取不到 ⇒ null(⇒ 未判定)。 */
export type ProcIdentityInspector = (pid: number) => Promise<ProcIdentitySnapshot | null>

export interface KillIdentityExpectation {
  /** executablePath 须不区分大小写包含该子串;不给 ⇒ 不判这一维(仍取回并记录)。 */
  executablePathIncludes?: string
  /** commandLine 须命中至少一个(不区分大小写);空/不给 ⇒ 不判这一维。 */
  commandLineAnyOf?: string[]
}

/** 派生终止命令的出口由本文件选定(bin/argv 不由调用方注入,防"注入命令"的第二真相)。 */
export type KillExecutor = (bin: string, argv: string[]) => Promise<string>

export interface KillVerifiedDeps {
  inspect?: ProcIdentityInspector
  runKill?: KillExecutor
}

export type KillVerifiedOutcome =
  | { killed: true; pid: number; command: string; output: string }
  | {
      killed: false
      pid: number
      reason: 'invalid-pid' | 'identity-mismatch' | 'undetermined'
      /** 可诊断记录:点名 pid、期望特征、实得特征。 */
      record: string
    }

function describeExpectation(e: KillIdentityExpectation): string {
  const parts: string[] = []
  if (e.executablePathIncludes) parts.push(`executablePath 须含 "${e.executablePathIncludes}"`)
  if (e.commandLineAnyOf && e.commandLineAnyOf.length > 0) {
    parts.push(`commandLine 须命中 ${JSON.stringify(e.commandLineAnyOf)} 之一`)
  }
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
  return misses.length > 0 ? { ok: false, why: misses.join(';') } : { ok: true }
}

const WIN_PROBE_NONE = 'IHUI-PROC-NONE'

/** 解析 Windows 探针输出(纯函数):进程不在 ⇒ null;profile 噪声行按前缀自然忽略。 */
export function parseProcProbeOutput(raw: string): ProcIdentitySnapshot | null {
  let executablePath: string | null = null
  let commandLine: string | null = null
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
    }
  }
  return seen ? { executablePath, commandLine } : null
}

function runPowerShellProbe(pid: number): Promise<string> {
  const script =
    `$ErrorActionPreference='Stop';` +
    `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}";` +
    `if($null -eq $p){'${WIN_PROBE_NONE}'}else{` +
    `'IHUI-EP='+[string]$p.ExecutablePath;'IHUI-CL='+[string]$p.CommandLine}`
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 15_000, shell: false, windowsHide: true, maxBuffer: 1 << 20 },
      (err, out) => (err ? rejectPromise(err) : resolvePromise(out)),
    )
  })
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
      return { executablePath, commandLine: commandLine === '' ? null : commandLine }
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
        resolvePromise(
          err
            ? `${String(err.message)}\n${String(out)}\n${String(errOut)}`.trim().slice(-1000)
            : String(out || errOut || 'done').slice(-1000),
        )
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
        `实得:executablePath=${JSON.stringify(snapshot.executablePath)} commandLine=${JSON.stringify(snapshot.commandLine)};` +
        verdict.why,
    }
  }
  const isWin = platform() === 'win32'
  const bin = isWin ? 'taskkill' : 'kill'
  const argv = isWin ? ['/PID', String(pid), '/F'] : ['-9', String(pid)]
  const runKill = deps.runKill ?? defaultKillExecutor
  const output = await runKill(bin, argv)
  return {
    killed: true,
    pid,
    command: isWin ? `taskkill /PID ${pid} /F` : `kill -9 ${pid}`,
    output,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
