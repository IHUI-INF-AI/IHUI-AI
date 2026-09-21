// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 任务进度状态条派生层 —— 跨端单一真相源(web / extension / miniapp-taro / mobile-rn / cli 共用)。
 *
 * 职责边界:这里只做"从原始事件数据 → 状态条视图模型"的纯函数推导,不含任何平台 API、
 * 不含文案(文案由各端 i18n 渲染)、不含样式。各端只写薄渲染层。
 *
 * 数据源:ai-service 的 `plan_updated` SSE 事件(packages/shared/src/utils/sse-parse.ts 解析)
 * 与消息级 toolCalls。
 */
import type { PlanStep, PlanStepStatus } from '@ihui/types/ai'
import type { ToolCall } from '@ihui/types/chat'

/** 会改动工作区文件的写类工具白名单(与后端 FILE_MODIFY_TOOLS 对齐) */
export const FILE_WRITE_TOOLS: ReadonlySet<string> = new Set([
  'write_file',
  'apply_diff',
  'edit_file',
  'file_edit',
  'create_file',
  'delete_file',
  'patch',
  'replace_in_file',
])

const PATH_ARG_KEYS = ['path', 'file_path', 'filePath', 'file', 'filename'] as const
const NEW_CONTENT_KEYS = ['newText', 'newContent', 'content'] as const
const OLD_CONTENT_KEYS = ['oldText', 'oldContent'] as const
const DIFF_RESULT_KEYS = ['diff', 'diff_text', 'unified_diff', 'patch'] as const

function readStringArg(args: Record<string, unknown> | undefined, keys: readonly string[]): string {
  if (!args) return ''
  for (const key of keys) {
    const value = args[key]
    if (typeof value === 'string') return value
  }
  return ''
}

/** 取工具调用参数里的文件路径(多键名兼容,trim 后非空才算命中) */
export function pickFilePath(args: Record<string, unknown> | undefined): string {
  return readStringArg(args, PATH_ARG_KEYS).trim()
}

/** 末段文件名(统一 Windows 反斜杠后再切,跨端展示用) */
export function fileBasename(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const slash = normalized.lastIndexOf('/')
  return slash === -1 ? normalized : normalized.slice(slash + 1)
}

function countLines(text: string): number {
  return text ? text.split('\n').length : 0
}

function extractDiffText(result: unknown): string {
  if (typeof result === 'string') return result
  if (result && typeof result === 'object') {
    return readStringArg(result as Record<string, unknown>, DIFF_RESULT_KEYS)
  }
  return ''
}

/** 单个文件的变更统计;added/removed 为 -1 表示拿不到行数(渲染层应显示占位而非 0) */
export interface FileChangeStat {
  path: string
  name: string
  added: number
  removed: number
}

/**
 * 从工具调用列表折叠出"本轮改了哪些文件、各多少行"。
 * 同一文件多次写入只保留首次命中(与消息级时间顺序一致)。
 */
export function computeFileChanges(toolCalls: readonly ToolCall[] | undefined): FileChangeStat[] {
  const out: FileChangeStat[] = []
  if (!toolCalls) return out
  const seen = new Set<string>()
  for (const call of toolCalls) {
    if (!FILE_WRITE_TOOLS.has(call.toolName)) continue
    if (call.status !== 'success' || call.error) continue
    const path = pickFilePath(call.args)
    if (!path || seen.has(path)) continue
    seen.add(path)

    const newContent = readStringArg(call.args, NEW_CONTENT_KEYS)
    const oldContent = readStringArg(call.args, OLD_CONTENT_KEYS)
    let added = -1
    let removed = -1
    if (newContent !== '' || oldContent !== '') {
      added = countLines(newContent)
      removed = countLines(oldContent)
    } else {
      const diff = extractDiffText(call.result)
      if (diff) {
        // 排除 +++ / --- 文件头,只数真实增删行
        const diffAdded = (diff.match(/^\+(?!\+\+)/gm) ?? []).length
        const diffRemoved = (diff.match(/^-(?!--)/gm) ?? []).length
        if (diffAdded + diffRemoved > 0) {
          added = diffAdded
          removed = diffRemoved
        }
      }
    }
    out.push({ path, name: fileBasename(path), added, removed })
  }
  return out
}

/**
 * 从"已知新旧内容"的 diff 条目折叠文件变更统计。
 * SSE 的 changes 事件直接携带 old_content/new_content,比工具入参可靠,
 * 各端拿到即可用本函数得到真实的 +x/-y。
 */
export interface DiffEntry {
  path: string
  oldContent: string
  newContent: string
}

export function computeFileChangesFromDiff(entries: readonly DiffEntry[]): FileChangeStat[] {
  const seen = new Set<string>()
  const out: FileChangeStat[] = []
  for (const entry of entries) {
    if (!entry.path || seen.has(entry.path)) continue
    seen.add(entry.path)
    out.push({
      path: entry.path,
      name: fileBasename(entry.path),
      added: countLines(entry.newContent),
      removed: countLines(entry.oldContent),
    })
  }
  return out
}

/** 文件变更聚合摘要;linesKnown=false 时增删行数不可信(部分工具不回传内容) */
export interface FileChangeSummary {
  files: number
  added: number
  removed: number
  linesKnown: boolean
}

export function summarizeFileChanges(changes: readonly FileChangeStat[]): FileChangeSummary {
  let added = 0
  let removed = 0
  let linesKnown = false
  for (const change of changes) {
    if (change.added >= 0) {
      added += change.added
      linesKnown = true
    }
    if (change.removed >= 0) removed += change.removed
  }
  return { files: changes.length, added, removed, linesKnown }
}

/** 状态条整体态势 */
export type TaskStatusKind = 'running' | 'completed' | 'failed' | 'interrupted' | 'idle'

/** 状态条里的单个步骤视图项 */
export interface TaskStatusStepView {
  id: string
  title: string
  status: PlanStepStatus
  /** 序号(1 起),用于 "步骤 {n}: {step}" 这类 aria 文案 */
  index: number
}

export interface TaskStatusBarInput {
  /** plan_updated 权威快照(消息级或会话级均可,调用方决定取哪一份) */
  planSteps: readonly PlanStep[]
  /** 已折叠好的文件变更;不传则由 toolCalls 现场折叠 */
  fileChanges?: readonly FileChangeStat[]
  toolCalls?: readonly ToolCall[]
  isStreaming: boolean
  /** 端侧已推导出的"当前在做什么"(如 "调用 web_search" / "子代理 validator"),优先作为标题 */
  currentTaskLabel?: string
  /** 会话态势(来自 overview.status),用于区分完成/失败/中断 */
  overviewStatus?: TaskStatusKind
}

/** 状态条视图模型 —— 渲染层只读这些字段,不再自行推导 */
export interface TaskStatusBarViewModel {
  kind: TaskStatusKind
  /** 主标题:此刻最该被看到的一句话 */
  headline: string
  /** 当前步骤序号(1 起;0 表示尚未开始或无步骤) */
  stepCurrent: number
  stepTotal: number
  /** 已完成占比 0-100 */
  percent: number
  changedFiles: number
  addedLines: number
  removedLines: number
  linesKnown: boolean
  steps: TaskStatusStepView[]
  /** 是否有可展开明细(步骤或文件变更任一非空) */
  hasDetail: boolean
  /** 是否处于活动态(渲染 spinner / 高亮) */
  active: boolean
}

function firstStepInStatus(steps: readonly PlanStep[], status: PlanStepStatus): number {
  return steps.findIndex((step) => step.status === status)
}

/**
 * 推导状态条视图模型。
 *
 * 返回 null 的语义是"这一帧没有任何值得占位显示的信息":无步骤、无文件变更、且不在流式
 * 执行中。渲染层据此整体不挂载节点,保证空闲时输入框上方零视觉噪音。
 */
export function deriveTaskStatusBar(input: TaskStatusBarInput): TaskStatusBarViewModel | null {
  const steps = input.planSteps
  const fileChanges = input.fileChanges ?? computeFileChanges(input.toolCalls)
  const summary = summarizeFileChanges(fileChanges)
  const total = steps.length
  const completed = steps.filter((step) => step.status === 'completed').length
  const hasFailed =
    steps.some((step) => step.status === 'failed') || steps.some((step) => step.error === true)
  const hasRunningStep = firstStepInStatus(steps, 'in_progress') >= 0

  const streaming = input.isStreaming
  if (!streaming && total === 0 && summary.files === 0) return null

  // 态势优先级:实时流 > 会话终态 > 步骤级推断。
  // 会话被中断/失败时步骤可能仍残留 in_progress,若让步骤级推断优先,状态条会永久
  // 转圈显示"运行中",这是最误导人的一种错法。
  const sessionTerminal =
    input.overviewStatus && input.overviewStatus !== 'idle' && input.overviewStatus !== 'running'
      ? input.overviewStatus
      : null
  let kind: TaskStatusKind
  if (streaming) kind = 'running'
  else if (sessionTerminal) kind = sessionTerminal
  else if (hasRunningStep) kind = 'running'
  else if (hasFailed) kind = 'failed'
  else if (total > 0 && completed === total) kind = 'completed'
  else kind = 'idle'

  const inProgressIdx = firstStepInStatus(steps, 'in_progress')
  const stepCurrent = inProgressIdx >= 0 ? inProgressIdx + 1 : completed
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  const runningStep = inProgressIdx >= 0 ? steps[inProgressIdx] : undefined
  const headline =
    (streaming && input.currentTaskLabel) ||
    runningStep?.step ||
    steps.find((step) => step.status === 'pending')?.step ||
    steps[total - 1]?.step ||
    ''

  return {
    kind,
    headline,
    stepCurrent,
    stepTotal: total,
    percent,
    changedFiles: summary.files,
    addedLines: summary.added,
    removedLines: summary.removed,
    linesKnown: summary.linesKnown,
    hasDetail: total > 0 || summary.files > 0,
    active: kind === 'running',
    steps: steps.map((step, idx) => ({
      id: step.id ?? `step-${idx}`,
      title: step.step,
      status: step.status,
      index: idx + 1,
    })),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
