// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 远程沙箱后端（2026-11-20，对标 deepseek-tui 的 `sandbox_backend=remote` + `sandbox_url` + `sandbox_api_key`）。
 *
 * 本仓的 `SandboxExecutor` 只有本机执行（进程/令牌/白名单）。远程后端属**显式 opt-in**：
 * - 默认关闭；只有 `IHUI_SANDBOX_BACKEND=remote` 且 url / apiKey 都齐备才启用；
 * - 缺任何一项 ⇒ 关闭并给出 reason（fail-closed，绝不"半开"）；
 * - 只做 HTTP 客户端：不落凭据、不读对方环境、不改变本机白名单；
 * - 超时 / 非 2xx / 响应非 JSON 一律结构化失败（exitCode 126/127），不抛到调用方。
 *
 * 为什么要这层：本机沙箱在 Windows 上依赖 Job 对象与令牌，跨平台/跨机器隔离能力有限；
 * 对照件的答案是把执行面外移。这里复现的是「外移」这一设计，不搬运对方任何代码。
 */
import { truncateBothEnds } from './output-budget.js'

export type RemoteSandboxBackend = 'local' | 'remote'

export interface RemoteSandboxConfig {
  url: string
  apiKey: string
  timeoutMs: number
  maxOutputChars: number
}

export interface RemoteSandboxResolution {
  enabled: boolean
  reason: string
  config?: RemoteSandboxConfig
}

export const REMOTE_SANDBOX_DEFAULT_TIMEOUT_MS = 30_000
export const REMOTE_SANDBOX_MAX_TIMEOUT_MS = 120_000
export const REMOTE_SANDBOX_DEFAULT_MAX_OUTPUT = 64_000
export const REMOTE_SANDBOX_MAX_OUTPUT = 256_000

function positiveInt(raw: string | undefined, fallback: number, cap: number): number {
  const n = Number(raw ?? Number.NaN)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), cap)
}

/** 解析配置。任何一项不齐 ⇒ enabled=false（调用方回落本机执行）。 */
export function resolveRemoteSandbox(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): RemoteSandboxResolution {
  const backend = (env['IHUI_SANDBOX_BACKEND'] ?? 'local').trim().toLowerCase()
  if (backend !== 'remote') {
    return { enabled: false, reason: 'IHUI_SANDBOX_BACKEND 不是 remote（默认本机执行）' }
  }
  const url = (env['IHUI_SANDBOX_URL'] ?? '').trim()
  const apiKey = (env['IHUI_SANDBOX_API_KEY'] ?? '').trim()
  if (!url) return { enabled: false, reason: 'IHUI_SANDBOX_URL 未配置' }
  if (!apiKey) return { enabled: false, reason: 'IHUI_SANDBOX_API_KEY 未配置' }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { enabled: false, reason: 'IHUI_SANDBOX_URL 不是合法 URL' }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { enabled: false, reason: 'IHUI_SANDBOX_URL 协议必须是 http(s)' }
  }
  return {
    enabled: true,
    reason: 'remote',
    config: {
      url: url.replace(/\/+$/, ''),
      apiKey,
      timeoutMs: positiveInt(
        env['IHUI_SANDBOX_TIMEOUT_MS'],
        REMOTE_SANDBOX_DEFAULT_TIMEOUT_MS,
        REMOTE_SANDBOX_MAX_TIMEOUT_MS,
      ),
      maxOutputChars: positiveInt(
        env['IHUI_SANDBOX_MAX_OUTPUT'],
        REMOTE_SANDBOX_DEFAULT_MAX_OUTPUT,
        REMOTE_SANDBOX_MAX_OUTPUT,
      ),
    },
  }
}

export interface RemoteSandboxRequest {
  command: string
  workspacePath: string
  cwd?: string
  mode: string
  timeoutMs?: number
}

export interface RemoteSandboxResult {
  stdout: string
  stderr: string
  exitCode: number | null
  backend: 'remote'
  truncated: boolean
}

/** 失败一律以 exitCode 表达（126=策略/协议拒绝，127=执行面不可达），便于上层统一判定。 */
export async function executeRemoteSandbox(
  config: RemoteSandboxConfig,
  request: RemoteSandboxRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<RemoteSandboxResult> {
  const timeoutMs = Math.min(
    Math.max(request.timeoutMs ?? config.timeoutMs, 1_000),
    REMOTE_SANDBOX_MAX_TIMEOUT_MS,
  )
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const fail = (stderr: string, exitCode: number): RemoteSandboxResult => ({
    stdout: '',
    stderr,
    exitCode,
    backend: 'remote',
    truncated: false,
  })
  try {
    const response = await fetchImpl(`${config.url}/exec`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
        'x-ihui-sandbox-backend': 'remote',
      },
      body: JSON.stringify({
        command: request.command,
        workspacePath: request.workspacePath,
        cwd: request.cwd ?? request.workspacePath,
        mode: request.mode,
        timeoutMs,
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      return fail(`远程沙箱拒绝执行: HTTP ${response.status}`, 126)
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      return fail('远程沙箱响应不是 JSON', 127)
    }
    if (!payload || typeof payload !== 'object') {
      return fail('远程沙箱响应结构非法', 127)
    }
    const body = payload as Record<string, unknown>
    const stdoutRaw = typeof body['stdout'] === 'string' ? body['stdout'] : ''
    const stderrRaw = typeof body['stderr'] === 'string' ? body['stderr'] : ''
    const exitRaw = body['exitCode']
    const exitCode =
      typeof exitRaw === 'number' && Number.isInteger(exitRaw)
        ? exitRaw
        : exitRaw === null
          ? null
          : 127
    let truncated = false
    const stdout = truncateBothEnds(stdoutRaw, config.maxOutputChars)
    if (stdout.truncated) truncated = true
    const stderr = truncateBothEnds(stderrRaw, config.maxOutputChars)
    if (stderr.truncated) truncated = true
    return { stdout: stdout.text, stderr: stderr.text, exitCode, backend: 'remote', truncated }
  } catch (error) {
    const aborted = (error as { name?: string } | null)?.name === 'AbortError'
    return fail(
      aborted
        ? `远程沙箱执行超时(${timeoutMs}ms)`
        : `远程沙箱不可达: ${(error as Error | null)?.message ?? 'unknown'}`,
      127,
    )
  } finally {
    clearTimeout(timer)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
