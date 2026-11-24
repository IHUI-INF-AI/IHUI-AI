// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-05 的真实安装面：把 registry 检查结果落到 `npm install -g`，再由
 * `graceful-restart.ts` 接“安装成功 → 优雅重启”。
 *
 * 边界纪律：
 *   - 只接受严格三段版本；不可解析一律 `unjudged`，不把“判不了”折成“可以装”；
 *   - 已是最新版 / 更旧版 ⇒ `refused`，绝不降级；
 *   - 安装失败或超时 ⇒ `refused`，不排重启；
 *   - 进程以参数数组启动，包名/版本先过白名单，不拼 shell 字符串。
 */

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  compareVersionsOrUnknown,
  parseVersionTriple,
  type UpdateHandoffPlan,
} from './updater.js'

export const NPM_INSTALL_TIMEOUT_MS = 120_000

/** `shell:true` 时命令串未加引号会把 `C:\Program Files\...` 拆成 `C:\Program`。 */
function shellQuoteCommand(command: string): string {
  return /\s/.test(command) ? `"${command}"` : command
}

export type InstallPlanReason =
  | 'install'
  | 'no-update'
  | 'version-unparsed'
  | 'current-unmeasured'
  | 'current-not-older'

export type InstallResultReason =
  | 'installed'
  | 'spawn-failed'
  | 'exit-nonzero'
  | 'timeout'
  | 'not-planned'

export interface NpmInstallPlan {
  disposition: 'install' | 'refused' | 'unjudged'
  reason: InstallPlanReason
  packageName: string
  version: string | null
  command: string
  args: string[]
}

export interface NpmInstallResult {
  disposition: 'install' | 'refused' | 'unjudged'
  reason: InstallResultReason | InstallPlanReason
  command: string
  args: string[]
  exitCode: number | null
  stdout: string
  stderr: string
}

type SpawnFn = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess

export interface InstallDeps {
  readonly spawn?: SpawnFn
  readonly platform?: NodeJS.Platform
  readonly env?: NodeJS.ProcessEnv
  readonly timeoutMs?: number
}

export function npmCommand(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string {
  if (env.IHUI_NPM_CLI && env.IHUI_NPM_CLI.trim()) return env.IHUI_NPM_CLI.trim()
  if (platform === 'win32') {
    // 不依赖 PATH：本机 PATH 可能先命中缺依赖的沙箱 npm（实测 make-fetch-happen 缺失），
    // 官方安装器的绝对路径优先；候选都不存在才回落 PATH。
    const programFiles = env.ProgramFiles || env.ProgramW6432 || 'C:\\Program Files'
    const candidates = [
      join(programFiles, 'nodejs', 'npm.cmd'),
      join(env.ProgramW6432 || programFiles, 'nodejs', 'npm.cmd'),
    ]
    const found = candidates.find((candidate) => existsSync(candidate))
    if (found) return found
  }
  return platform === 'win32' ? 'npm.cmd' : 'npm'
}

/**
 * 纯规划：只有“最新版严格高于当前版”才生成 install 计划。
 * 版本比较走 updater 的单一出口 `compareVersionsOrUnknown`。
 */
export function planNpmInstall(input: {
  currentVersion: unknown
  latestVersion: unknown
  packageName?: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
}): NpmInstallPlan {
  const packageName = input.packageName ?? 'ihui-cli'
  const platform = input.platform ?? process.platform
  const env = input.env ?? process.env
  const command = npmCommand(platform, env)
  const latestVersion = typeof input.latestVersion === 'string' ? input.latestVersion : null
  const currentVersion = typeof input.currentVersion === 'string' ? input.currentVersion : null
  const refused = (reason: InstallPlanReason, disposition: NpmInstallPlan['disposition'] = 'refused'): NpmInstallPlan => ({
    disposition,
    reason,
    packageName,
    version: latestVersion,
    command,
    args: [],
  })
  if (!latestVersion || parseVersionTriple(latestVersion) === null) return refused('version-unparsed', 'unjudged')
  if (!currentVersion || parseVersionTriple(currentVersion) === null) return refused('current-unmeasured', 'unjudged')
  const order = compareVersionsOrUnknown(currentVersion, latestVersion)
  if (order === null) return refused('version-unparsed', 'unjudged')
  if (order >= 0) return refused(order === 0 ? 'no-update' : 'current-not-older')
  return {
    disposition: 'install',
    reason: 'install',
    packageName,
    version: latestVersion,
    command,
    args: ['install', '-g', `${packageName}@${latestVersion}`],
  }
}

/**
 * 真实安装：Windows 下 `.cmd` 需由 shell 解析，故 `shell: platform === 'win32'`；
 * 参数值已经过严格版本白名单，不含空格/分号/引号。
 */
export function installNpmPlan(plan: NpmInstallPlan, deps: InstallDeps = {}): Promise<NpmInstallResult> {
  const empty: NpmInstallResult = {
    disposition: plan.disposition === 'install' ? 'refused' : plan.disposition,
    reason: 'not-planned',
    command: plan.command,
    args: plan.args,
    exitCode: null,
    stdout: '',
    stderr: '',
  }
  if (plan.disposition !== 'install') return Promise.resolve(empty)
  const spawnFn = deps.spawn ?? (spawn as unknown as SpawnFn)
  const platform = deps.platform ?? process.platform
  const timeoutMs = deps.timeoutMs ?? NPM_INSTALL_TIMEOUT_MS

  return new Promise<NpmInstallResult>((resolve) => {
    let child: ChildProcess
    try {
      child = spawnFn(platform === 'win32' ? shellQuoteCommand(plan.command) : plan.command, plan.args, {
        windowsHide: true,
        shell: platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (err) {
      resolve({
        ...empty,
        reason: 'spawn-failed',
        stderr: err instanceof Error ? err.message : String(err),
      })
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try { child.kill() } catch { /* 已退出 */ }
      resolve({ ...empty, reason: 'timeout', stdout, stderr })
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout = (stdout + chunk.toString()).slice(-64 * 1024)
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr = (stderr + chunk.toString()).slice(-64 * 1024)
    })
    child.once('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ ...empty, reason: 'spawn-failed', stderr: err.message })
    })
    child.once('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(
        code === 0
          ? { disposition: 'install', reason: 'installed', command: plan.command, args: plan.args, exitCode: 0, stdout, stderr }
          : { disposition: 'refused', reason: 'exit-nonzero', command: plan.command, args: plan.args, exitCode: code, stdout, stderr },
      )
    })
  })
}

/**
 * 安装结果 → 更新交接计划。安装成功是独立证据档，不伪装成摘要校验；
 * 但仍必须经由 `UpdateHandoffPlan` 才能进 RestartCoordinator 的唯一放行判据。
 */
export function handoffFromInstall(result: NpmInstallResult): UpdateHandoffPlan {
  if (result.disposition === 'install' && result.reason === 'installed') {
    return { disposition: 'apply', action: 'apply', reason: 'install-verified' }
  }
  return { disposition: 'refused', action: 'stay', reason: 'install-failed' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
