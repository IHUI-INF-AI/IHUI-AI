// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P2：Workspace Agent 任务轨迹落盘与回放（2026-11-27）。
 *
 * 内存态 `AgentLoopRuntime.tasks` 在 API 重启后消失；本模块把终态任务追加到
 * `<IHUI_STORE_ROOT>/workspace-agent-tasks/tasks-YYYY-MM-DD.jsonl`，提供只读回放入口。
 * 默认开启（测试环境默认关闭，避免单测污染真实 `~/.ihui`；归档专项测试显式置 on），
 * `IHUI_AGENT_TASK_ARCHIVE=off|0|false` 可关闭（本地单用户产品默认保留轨迹）。
 *
 * 边界：
 * - local-only：不落数据库、不跨机同步，只给本机 API/UI 回放；
 * - best-effort：写失败只返回错误，不改任务终态；
 * - 单条任务过大时压步骤内容到 4,000 字符，并标 `archiveTruncated`，不静默丢整条。
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const AGENT_TASK_ARCHIVE_MAX_BYTES = 1_000_000
export const AGENT_TASK_ARCHIVE_STEP_PREVIEW = 4_000

export interface AgentTaskArchiveLike {
  taskId: string
  userId: string
  status: string
  startedAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface AgentTaskArchiveResult {
  ok: boolean
  path?: string
  bytes?: number
  error?: string
}

function storeRoot(explicit?: string): string {
  return explicit?.trim() || process.env.IHUI_STORE_ROOT?.trim() || join(homedir(), '.ihui')
}

function archiveDir(root?: string): string {
  return join(storeRoot(root), 'workspace-agent-tasks')
}

function archiveEnabled(): boolean {
  const value = (process.env.IHUI_AGENT_TASK_ARCHIVE ?? '').trim().toLowerCase()
  if (value === 'off' || value === '0' || value === 'false') return false
  if (value === 'on' || value === '1' || value === 'true') return true
  // 测试默认关闭，避免单测把轨迹写进真实 ~/.ihui；要测落盘的文件显式置 on。
  return process.env.NODE_ENV !== 'test'
}

function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

const SENSITIVE_ARCHIVE_KEY =
  /^(authorization|cookie|cookies|token|access_token|refresh_token|api_key|apikey|secret|password|passwd|credential|private_key)$/i

function redactArchiveValue(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[TRUNCATED_DEPTH]'
  if (Array.isArray(value)) return value.map((item) => redactArchiveValue(item, depth + 1))
  if (!value || typeof value !== 'object') return value
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_ARCHIVE_KEY.test(key)
      ? '[REDACTED]'
      : redactArchiveValue(item, depth + 1)
  }
  return output
}

function shrinkForArchive(task: AgentTaskArchiveLike): AgentTaskArchiveLike {
  const redacted = redactArchiveValue(task) as AgentTaskArchiveLike
  const serialized = JSON.stringify(redacted)
  if (Buffer.byteLength(serialized, 'utf8') <= AGENT_TASK_ARCHIVE_MAX_BYTES) {
    return redacted
  }
  const steps = Array.isArray(redacted['steps']) ? redacted['steps'] : []
  return {
    ...redacted,
    steps: steps.map((step) => {
      if (!step || typeof step !== 'object') return step
      const record = step as Record<string, unknown>
      const content = typeof record['content'] === 'string' ? record['content'] : ''
      return {
        ...record,
        content: content.slice(0, AGENT_TASK_ARCHIVE_STEP_PREVIEW),
      }
    }),
    result:
      typeof task['result'] === 'string'
        ? task['result'].slice(0, AGENT_TASK_ARCHIVE_STEP_PREVIEW)
        : '',
    archiveTruncated: true,
  }
}

/** 终态任务追加一行 JSONL；写失败不抛出。 */
export function archiveAgentTask(
  task: object,
  options: { storeRoot?: string; now?: Date } = {},
): AgentTaskArchiveResult {
  if (!archiveEnabled()) return { ok: false, error: 'archive-disabled' }
  try {
    const dir = archiveDir(options.storeRoot)
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const record = shrinkForArchive(task as unknown as AgentTaskArchiveLike)
    const line = JSON.stringify(record) + '\n'
    const path = join(dir, `tasks-${dayKey(options.now)}.jsonl`)
    appendFileSync(path, line, { encoding: 'utf8', mode: 0o600 })
    return { ok: true, path, bytes: Buffer.byteLength(line, 'utf8') }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

function readLines(path: string): string[] {
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/** 按日期倒序、行倒序读取；同 taskId 只保留最新一条，可按 userId 过滤。 */
export function listAgentTaskArchive(
  options: {
    limit?: number
    userId?: string
    storeRoot?: string
  } = {},
): AgentTaskArchiveLike[] {
  const dir = archiveDir(options.storeRoot)
  if (!existsSync(dir)) return []
  const limit = Math.max(1, Math.min(500, options.limit ?? 50))
  const files = readdirSync(dir)
    .filter((name) => /^tasks-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
    .sort()
    .reverse()

  const seen = new Set<string>()
  const tasks: AgentTaskArchiveLike[] = []
  for (const file of files) {
    const lines = readLines(join(dir, file))
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        const parsed = JSON.parse(lines[i]!) as AgentTaskArchiveLike
        if (!parsed || typeof parsed.taskId !== 'string' || !parsed.taskId) continue
        if (options.userId && parsed.userId !== options.userId) continue
        if (seen.has(parsed.taskId)) continue
        seen.add(parsed.taskId)
        tasks.push(parsed)
        if (tasks.length >= limit) return tasks
      } catch {
        // 单行损坏不影响其余回放
      }
    }
  }
  return tasks
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
