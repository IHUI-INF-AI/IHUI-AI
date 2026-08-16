import type { AgentOverview } from '@/hooks/use-agent-progress'

/** AgentOverview 类型别名(2026-07-28 立,Phase 20 P1-2 单元测试用) */
export type OverviewShape = AgentOverview

/**
 * 把 AgentOverview + token 统计序列化为 Markdown 摘要(2026-07-28 立,Phase 20 P1-2)
 *
 * 输出格式:
 * ```
 * # 任务总览
 *
 * - 状态: 已完成
 * - 会话耗时: 12.3s
 * - 步骤: 5/6
 * - 子代理: 2 活跃 · 3 总
 * - 工具: 8 成功 · 1 失败
 * - Token: 12k
 * - 速率: 156/s
 * - 预计: 30s
 * - 上下文: 12%
 * ```
 *
 * 纯函数,无副作用,便于单测。参数全可选(零数据时返回空字符串)。
 */
export interface OverviewSummaryInput {
  overview: AgentOverview
  isStreaming: boolean
  totalTokens?: number
  tokenRate?: number
  etaMs?: number | null
  contextUsage?: number
  /** 会话开始时间(可选,传则渲染耗时) */
  sessionStart?: string | null
  /** 当前累计耗时(毫秒,可直接覆盖 sessionStart 计算) */
  nowMs?: number
}

const STATUS_LABEL: Record<AgentOverview['status'], string> = {
  idle: '空闲',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  interrupted: '已中断',
}

/**
 * 状态文字(导出便于单测 + 复用,2026-07-28 立)
 * - streaming=true 时追加 " (流式中)" 后缀
 */
export function formatStatusText(status: AgentOverview['status'], isStreaming: boolean): string {
  return `${STATUS_LABEL[status]}${isStreaming ? ' (流式中)' : ''}`
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(1)}s`
  const min = sec / 60
  if (min < 60) return `${min.toFixed(1)}m`
  const hr = min / 60
  return `${hr.toFixed(1)}h`
}

function formatTokenK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

/** 计算会话耗时(毫秒)。无 sessionStart 时返回 0。 */
export function calcSessionDurationMs(
  sessionStart: string | null | undefined,
  nowMs: number,
): number {
  if (!sessionStart) return 0
  const startMs = Date.parse(sessionStart)
  if (Number.isNaN(startMs)) return 0
  return Math.max(0, nowMs - startMs)
}

/** 拼接统计行(空值自动跳过)— durationMs 可选,缺省时从 sessionStart 派生 */
export function buildStatLines(input: OverviewSummaryInput, durationMs?: number): string[] {
  const {
    overview,
    sessionStart,
    nowMs = Date.now(),
    totalTokens,
    tokenRate,
    etaMs,
    contextUsage,
  } = input
  const effectiveDuration = durationMs ?? calcSessionDurationMs(sessionStart, nowMs)
  const lines: string[] = []
  if (overview.totalSteps > 0) {
    lines.push(`- 步骤: ${overview.completedSteps}/${overview.totalSteps}`)
  }
  if (overview.totalSubagents > 0) {
    const parts = [`${overview.activeSubagents} 活跃`]
    parts.push(`${overview.totalSubagents} 总`)
    if (overview.deadSubagents > 0) parts.push(`${overview.deadSubagents} 死亡`)
    lines.push(`- 子代理: ${parts.join(' · ')}`)
  }
  if (overview.totalTerminals > 0) {
    lines.push(`- 终端: ${overview.runningTerminals} 运行中 · ${overview.totalTerminals} 总`)
  }
  if (overview.totalChanges > 0) {
    lines.push(`- 变更: ${overview.totalChanges} 文件`)
  }
  if (effectiveDuration > 0) {
    lines.push(`- 会话耗时: ${formatDurationMs(effectiveDuration)}`)
  }
  if (totalTokens !== undefined && totalTokens > 0) {
    lines.push(`- Token: ${formatTokenK(totalTokens)}`)
  }
  if (tokenRate !== undefined && tokenRate > 0) {
    lines.push(`- 速率: ${tokenRate}/s`)
  }
  if (etaMs !== undefined && etaMs !== null && etaMs > 0) {
    lines.push(`- 预计: ${formatDurationMs(etaMs)}`)
  }
  if (contextUsage !== undefined && contextUsage > 0) {
    lines.push(`- 上下文: ${Math.round(contextUsage)}%`)
  }
  return lines
}

/** 主导出函数:把 overview + 统计序列化为 Markdown 字符串 */
export function buildOverviewSummaryMarkdown(input: OverviewSummaryInput): string {
  const { overview, isStreaming, sessionStart, nowMs = Date.now() } = input
  const durationMs = calcSessionDurationMs(sessionStart, nowMs)
  const lines: string[] = ['# 任务总览', '']
  const statusText = `${STATUS_LABEL[overview.status]}${isStreaming ? ' (流式中)' : ''}`
  lines.push(`- 状态: ${statusText}`)
  if (overview.error) {
    lines.push(`- 错误: ${overview.error}`)
  }
  lines.push(...buildStatLines(input, durationMs))
  return lines.join('\n')
}
