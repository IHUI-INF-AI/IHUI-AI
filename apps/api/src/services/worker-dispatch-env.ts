// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 超级智能体派发侧的工人环境隔离（**护栏，不是沙箱**）。
 *
 * 目录隔离已由 worker-workspace.ts 落地；本模块补上环境这一半：
 *  - 每次派发只上行白名单键，并强制写死 git 的三道隔离开关；
 *  - 派发前检查目标目录本地 git config，出现 credential.* / http.*extraheader
 *    就拒绝启动（这些配置会把凭据注入到工人执行的 git 操作里）。
 *
 * 诚实声明：同一 OS 用户下，工人仍可用绝对路径、自有进程或读取宿主文件绕过
 * 这些限制。它防的是「无意继承」与「显式配置注入」，不是恶意逃逸。
 *
 * 白名单与 ai-service `WORKER_ENV_ALLOWED_KEYS` 一一对应，改动必须两侧同步。
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** 请求 env 允许上行的键；与 ai-service 的 `WORKER_ENV_ALLOWED_KEYS` 保持一致。 */
export const WORKER_ENV_ALLOWED_KEYS = [
  'GIT_CONFIG_NOSYSTEM',
  'GIT_ASKPASS',
  'GIT_TERMINAL_PROMPT',
] as const

/** 永不继承的键：凭据 + git 配置注入面。 */
export const WORKER_ENV_BLOCKED_KEYS = new Set<string>([
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GIT_CONFIG_COUNT',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_GLOBAL',
])

const WORKER_ENV_BLOCKED_PREFIXES = ['GIT_AUTHOR_', 'GIT_COMMITTER_'] as const

/** 强制写死的隔离开关：不读系统 gitconfig、不弹凭据、不交互。 */
export const WORKER_GIT_ENV: Readonly<Record<string, string>> = Object.freeze({
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_ASKPASS: '',
  GIT_TERMINAL_PROMPT: '0',
})

function isBlockedWorkerEnvKey(key: string): boolean {
  const upper = key.toUpperCase()
  if (WORKER_ENV_BLOCKED_KEYS.has(upper)) return true
  return WORKER_ENV_BLOCKED_PREFIXES.some((prefix) => upper.startsWith(prefix))
}

/**
 * 构造本工人上行环境：只保留白名单键并剔除黑名单，再强制覆盖三道 git 开关。
 * 每次派发都现算，不把环境快照持久化到派单记录里。
 */
export function buildWorkerDispatchEnv(
  hostEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const allowed = new Set<string>(WORKER_ENV_ALLOWED_KEYS)
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(hostEnv)) {
    if (typeof value !== 'string') continue
    if (!allowed.has(key)) continue
    if (isBlockedWorkerEnvKey(key)) continue
    out[key] = value
  }
  return { ...out, ...WORKER_GIT_ENV }
}

function buildGitProbeEnv(hostEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(hostEnv)) {
    if (typeof value !== 'string') continue
    if (isBlockedWorkerEnvKey(key)) continue
    out[key] = value
  }
  return { ...out, ...WORKER_GIT_ENV }
}

/** 命中即拒绝的本地 git config 键（凭据注入面）。 */
const GIT_CONFIG_DENY_PATTERNS = [/^credential\./i, /^http\..*extraheader$/i]

export class WorkerGitConfigRejectedError extends Error {
  readonly keys: string[]

  constructor(keys: string[]) {
    super(`工人目录 git config 含凭据注入配置，拒绝启动：${keys.join(', ')}`)
    this.name = 'WorkerGitConfigRejectedError'
    this.keys = keys
  }
}

export interface GitConfigProbeResult {
  stdout: string
  stderr: string
  code: number
}

export type GitConfigProbe = (directory: string) => Promise<GitConfigProbeResult>

/** 默认探针：只跑 `git config --local --list`，探针自身也不继承凭据键。 */
export const defaultGitConfigProbe: GitConfigProbe = async (directory) => {
  try {
    const { stdout, stderr } = await execFileAsync(
      'git',
      ['-C', directory, 'config', '--local', '--list'],
      { timeout: 5_000, windowsHide: true, env: buildGitProbeEnv() },
    )
    return { stdout, stderr, code: 0 }
  } catch (error) {
    const failure = error as {
      stdout?: string | Buffer
      stderr?: string | Buffer
      code?: number | string
    }
    return {
      stdout: failure.stdout?.toString() ?? '',
      stderr: failure.stderr?.toString() ?? '',
      code: typeof failure.code === 'number' ? failure.code : 1,
    }
  }
}

/**
 * 工人启动前的 git config 闸门。
 *
 * - 命中 credential.* / http.*extraheader → 抛 WorkerGitConfigRejectedError（只记键名）；
 * - 目标不是 git 仓库 → 没有本地配置，放行；
 * - git 缺失/超时/其他失败 → 抛错（fail-closed，不把「没检查」当「检查通过」）。
 */
export async function assertWorkerGitConfigSafe(
  directory: string,
  probe: GitConfigProbe = defaultGitConfigProbe,
): Promise<void> {
  const result = await probe(directory)
  if (result.code !== 0) {
    // 非 git 仓库 = 没有本地配置可注入;git 在不同平台/版本下措辞不同,两种都认。
    if (
      /not a git repository|--local can only be used inside a git repository/i.test(result.stderr)
    ) {
      return
    }
    throw new Error(
      `工人目录 git config 检查失败（code=${result.code}）：${result.stderr.trim().slice(0, 200)}`,
    )
  }
  const offending = new Set<string>()
  for (const line of result.stdout.split(/\r?\n/)) {
    const key = line.split('=', 1)[0]?.trim() ?? ''
    if (key.length === 0) continue
    if (GIT_CONFIG_DENY_PATTERNS.some((pattern) => pattern.test(key))) offending.add(key)
  }
  if (offending.size > 0) throw new WorkerGitConfigRejectedError([...offending].sort())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
