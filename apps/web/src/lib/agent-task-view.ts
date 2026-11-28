// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent-task-view — AI 任务中心的纯展示逻辑。
 *
 * 这里只做「把协议字段翻译成用户能看懂的结构」，不依赖 React / i18n：
 * - 工具调用 → 读文件 / 写文件 / 跑命令 / 搜文件
 * - 任务状态 → 结果 / 失败 / 进行中
 * - 技术字段（taskId、原始 JSON、tool 名称）留在 `technical detail` 里，不占主视线
 */

export interface AgentStepView {
  iteration: number
  type: string
  content: string
  tool?: string
  approval?: {
    state: 'pending' | 'allowed' | 'denied'
    requestId?: string
  }
}

export interface AgentTaskView {
  taskId: string
  /** 发起该任务的聊天会话；存在时任务中心可直接回到原会话继续 */
  conversationId?: string
  goal: string
  status: string
  iterations: number
  startedAt?: string
  updatedAt?: string
  workspacePath?: string
  result?: string | null
  error?: string | null
  errorCode?: string
  steps?: AgentStepView[]
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export type StepKind = 'think' | 'read' | 'write' | 'command' | 'list' | 'search' | 'tool' | 'done'

const TOOL_KIND: Record<string, StepKind> = {
  read_file: 'read',
  write_file: 'write',
  edit_file: 'write',
  run_command: 'command',
  list_dir: 'list',
  grep: 'search',
  glob: 'search',
}

/** 把工具名压成用户能理解的 8 类动作。 */
export function stepKind(step: AgentStepView): StepKind {
  if (step.type === 'tool_result') return 'done'
  if (step.type === 'llm') return 'think'
  if (step.type === 'tool_call') return TOOL_KIND[step.tool ?? ''] ?? 'tool'
  return 'tool'
}

function parseContent(content: string): unknown {
  const trimmed = content.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringField(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/** 只留路径最后一段，避免把 C:\Users\... 这种长路径塞进主视线。 */
export function displayPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

/** 超长命令、搜索词、工具返回在列表里只显示一段，完整内容进技术详情。 */
export function truncateText(text: string, max = 120): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, Math.max(0, max - 1))}…`
}

/**
 * 从工具调用的 JSON 参数里提取用户能看懂的目标：
 * - write_file/read_file: `path` 最后一段
 * - run_command: 命令文本
 * - grep/glob: pattern
 * - list_dir: 目录名
 */
export function stepTarget(step: AgentStepView): string | null {
  if (step.type !== 'tool_call') return null
  const record = asRecord(parseContent(step.content))
  if (!record) return null

  const path = stringField(record, ['path', 'file_path', 'filePath', 'dir', 'directory'])
  if (path) return displayPath(path)

  const command = stringField(record, ['command', 'cmd'])
  if (command) return truncateText(command, 64)

  const pattern = stringField(record, ['pattern', 'query', 'glob'])
  if (pattern) return truncateText(pattern, 64)

  return null
}

/** 任务详情里的主摘要：先给用户「现在怎么样」，而不是工具名。 */
export function taskOutcome(
  task: AgentTaskView,
):
  | { kind: 'result'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'canceled' }
  | { kind: 'running'; phase: 'preparing' | 'thinking' | 'tool'; target?: string } {
  if (task.status === 'completed') {
    return { kind: 'result', text: task.result?.trim() ?? '' }
  }
  if (task.status === 'failed') {
    const text = [task.errorCode, task.error].filter(Boolean).join(' — ')
    return { kind: 'error', text }
  }
  if (task.status === 'canceled') return { kind: 'canceled' }

  const last = latestProgressStep(task)
  if (!last) return { kind: 'running', phase: 'preparing' }
  if (last.type === 'llm') return { kind: 'running', phase: 'thinking' }
  if (last.type === 'tool_call') {
    return { kind: 'running', phase: 'tool', target: stepTarget(last) ?? undefined }
  }
  return { kind: 'running', phase: 'tool' }
}

/** 任务列表的二次摘要：去掉重复的技术字段。 */
export function taskStepCount(task: AgentTaskView): number {
  return (task.steps ?? []).filter(
    (step) => step.type === 'tool_call' || step.type === 'tool_result',
  ).length
}

export function latestProgressStep(task: AgentTaskView): AgentStepView | undefined {
  return [...(task.steps ?? [])].reverse().find((step) => step.type !== 'tool_result')
}

export function pendingApprovalStep(task: AgentTaskView): AgentStepView | undefined {
  return (task.steps ?? []).find((step) => step.approval?.state === 'pending')
}

/** 固定 MM-DD HH:mm，避免相对时间在不同机器/刷新节奏下跳来跳去。 */
export function formatTaskTime(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 工作区路径 → 展示名；优先用最后一段，根目录兜底为路径本身。 */
export function workspaceLabel(path?: string): string {
  if (!path) return ''
  return displayPath(path) || path
}

/**
 * 服务端自动准备的默认工作区，最后一段是用户 ID，直接展示会变成一串 UUID。
 * 普通用户应看到「AI 默认工作区」，由调用方用 i18n 文案替换。
 */
export function isDefaultWorkspacePath(path?: string): boolean {
  if (!path) return false
  return /\/\.ihui\/agent-workspaces\/[^/]+\/?$/.test(path.replace(/\\/g, '/'))
}

/** 供技术详情渲染：原始轨迹转可读 JSON。 */
export function stepsJson(task: AgentTaskView): string {
  return JSON.stringify(task.steps ?? [], null, 2)
}
