// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * - 耗时: 12.3s
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
  /** 取词函数(由渲染侧注入,见 Translator) */
  t: Translator
}

/**
 * 取词函数:本模块是纯函数集合,**禁止**模块级调用 `useTranslations`(Hook 只能在组件内调用),
 * 故展示文案一律由调用方(组件里的 `useTranslations('ai.pane')`)注入。
 */
export type Translator = (key: string) => string

/** 状态 → 语言包键名(命名空间 ai.pane,渲染侧与序列化侧共用同一份键表) */
export const STATUS_LABEL_KEY: Record<AgentOverview['status'], string> = {
  idle: 'overview.statusIdle',
  running: 'overview.statusRunning',
  completed: 'overview.statusCompleted',
  failed: 'overview.statusFailed',
  interrupted: 'overview.statusInterrupted',
}

/**
 * 流式中变体的**整键**(2026-09-22 立):原先「状态标签 + 流式中后缀」的字符串拼接属于
 * 跨语言拼词(英文等语序/标点与中文不同),现按状态各给一个完整键,不做任何字符串拼接。
 */
export const STATUS_LABEL_STREAMING_KEY: Record<AgentOverview['status'], string> = {
  idle: 'overview.statusIdleStreaming',
  running: 'overview.statusRunningStreaming',
  completed: 'overview.statusCompletedStreaming',
  failed: 'overview.statusFailedStreaming',
  interrupted: 'overview.statusInterruptedStreaming',
}

/**
 * 状态文字(导出便于单测 + 复用,2026-07-28 立;2026-09-22 取词下放到渲染侧)
 * - streaming=true 时走独立的流式中整键,不再追加后缀
 */
export function formatStatusText(
  status: AgentOverview['status'],
  isStreaming: boolean,
  t: Translator,
): string {
  return t(isStreaming ? STATUS_LABEL_STREAMING_KEY[status] : STATUS_LABEL_KEY[status])
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

/** 拼接统计行(空值自动跳过)— durationMs 可选,缺省时从 sessionStart 派生;标签一律经注入的 translator 取词 */
export function buildStatLines(input: OverviewSummaryInput, durationMs?: number): string[] {
  const {
    overview,
    sessionStart,
    nowMs = Date.now(),
    totalTokens,
    tokenRate,
    etaMs,
    contextUsage,
    t,
  } = input
  const effectiveDuration = durationMs ?? calcSessionDurationMs(sessionStart, nowMs)
  const lines: string[] = []
  if (overview.totalSteps > 0) {
    lines.push(`- ${t('overview.steps')}: ${overview.completedSteps}/${overview.totalSteps}`)
  }
  if (overview.totalSubagents > 0) {
    const parts = [`${overview.activeSubagents} ${t('overview.active')}`]
    parts.push(`${overview.totalSubagents} ${t('overview.total')}`)
    if (overview.deadSubagents > 0) parts.push(`${overview.deadSubagents} ${t('overview.dead')}`)
    lines.push(`- ${t('overview.subagents')}: ${parts.join(' · ')}`)
  }
  if (overview.totalTerminals > 0) {
    lines.push(
      `- ${t('overview.terminals')}: ${overview.runningTerminals} ${t('overview.running')} · ${overview.totalTerminals} ${t('overview.total')}`,
    )
  }
  if (overview.totalChanges > 0) {
    lines.push(`- ${t('overview.changes')}: ${overview.totalChanges} ${t('overview.files')}`)
  }
  if (effectiveDuration > 0) {
    lines.push(`- ${t('overview.duration')}: ${formatDurationMs(effectiveDuration)}`)
  }
  if (totalTokens !== undefined && totalTokens > 0) {
    lines.push(`- ${t('overview.token')}: ${formatTokenK(totalTokens)}`)
  }
  if (tokenRate !== undefined && tokenRate > 0) {
    lines.push(`- ${t('overview.rate')}: ${tokenRate}/s`)
  }
  if (etaMs !== undefined && etaMs !== null && etaMs > 0) {
    lines.push(`- ${t('overview.eta')}: ${formatDurationMs(etaMs)}`)
  }
  if (contextUsage !== undefined && contextUsage > 0) {
    lines.push(`- ${t('overview.context')}: ${Math.round(contextUsage)}%`)
  }
  return lines
}

/** 主导出函数:把 overview + 统计序列化为 Markdown 字符串 */
export function buildOverviewSummaryMarkdown(input: OverviewSummaryInput): string {
  const { overview, isStreaming, sessionStart, nowMs = Date.now(), t } = input
  const durationMs = calcSessionDurationMs(sessionStart, nowMs)
  const lines: string[] = [`# ${t('overview.title')}`, '']
  const statusText = formatStatusText(overview.status, isStreaming, t)
  lines.push(`- ${t('overview.status')}: ${statusText}`)
  if (overview.error) {
    // overview.error 是后端原始错误文本:只取词标签,值本身不翻译、不包装
    lines.push(`- ${t('overview.error')}: ${overview.error}`)
  }
  lines.push(...buildStatLines(input, durationMs))
  return lines.join('\n')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
