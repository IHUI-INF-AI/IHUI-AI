// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * KPI 取数与 findings 判据(纯函数:数组进,读数出;零 IO、零 DOM、零平台 API)。
 *
 * 为什么量不到要单列一档而不折算成 0:阶段耗时缺测时,"总耗时 = 0"会被读成"这趟很快",
 * 而真相是"没量到"。本层把缺测量成独立计数,并让它自己出一条 finding(AGENTS §0.3 同族口径)。
 */
import type { ToolCallStatus } from '../chat/tool-activity'
import {
  TRACE_FINDING_DEFAULTS,
  type AgentTrace,
  type AgentTraceKpi,
  type AgentTraceMessage,
  type AgentTraceStep,
  type TraceFinding,
  type TraceFindingId,
  type TraceFindingSeverity,
  type TraceFindingThresholds,
} from './agent-trace-types'

/** KPI 里的四个状态计数键(收窄到 number 档,否则 `kpi[key] += 1` 在类型层不成立) */
type TraceCountKey = 'runningCount' | 'successCount' | 'errorCount' | 'cancelledCount'

/**
 * 状态 → KPI 桶。键集由上游 ToolCallStatus 的 `Record<…>` 穷举性钉住:
 * 词表加档时这里编译期即红,比再抄一份字符串名单安全(§0.6)。
 */
const STATUS_BUCKETS: Record<ToolCallStatus, TraceCountKey> = {
  running: 'runningCount',
  success: 'successCount',
  error: 'errorCount',
  cancelled: 'cancelledCount',
}

/** 一条 finding 的强度档位;表驱动而非散在分支里,便于逐条测与逐条改 */
const FINDING_SEVERITIES: Record<TraceFindingId, TraceFindingSeverity> = {
  failuresPresent: 'high',
  slowestStepDominant: 'medium',
  unmeasuredSteps: 'medium',
  emptyTrace: 'high',
  measuredTotalOverBudget: 'low',
}

/** 只有有限非负数才算"量到了";负数/NaN/Infinity/缺字段同归缺测档 */
export function isMeasuredDuration(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** 外部 JSON 里的一步 ⇒ AgentTraceStep;读不出的返回 null 交调用方计数(不猜成 running) */
export function normalizeAgentTraceStep(raw: unknown): AgentTraceStep | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const { toolName, status } = record
  if (typeof toolName !== 'string' || toolName.trim() === '') return null
  if (typeof status !== 'string' || !(status in STATUS_BUCKETS)) return null
  const step: AgentTraceStep = { toolName, status: status as ToolCallStatus }
  if (typeof record.durationMs === 'number') step.durationMs = record.durationMs
  return step
}

export function computeAgentTraceKpi(steps: readonly AgentTraceStep[]): AgentTraceKpi {
  const kpi: AgentTraceKpi = {
    stepCount: steps.length,
    successCount: 0,
    errorCount: 0,
    cancelledCount: 0,
    runningCount: 0,
    measuredStepCount: 0,
    unmeasuredStepCount: 0,
    measuredTotalMs: 0,
    slowestStepIndex: null,
    slowestToolName: null,
    slowestMs: null,
    slowestShare: null,
  }

  steps.forEach((step, index) => {
    kpi[STATUS_BUCKETS[step.status]] += 1
    if (!isMeasuredDuration(step.durationMs)) {
      kpi.unmeasuredStepCount += 1
      return
    }
    kpi.measuredStepCount += 1
    kpi.measuredTotalMs += step.durationMs
    if (kpi.slowestMs === null || step.durationMs > kpi.slowestMs) {
      kpi.slowestMs = step.durationMs
      kpi.slowestStepIndex = index
      kpi.slowestToolName = step.toolName
    }
  })

  // 占比只在"有量到的步"上成立;全缺测时留 null,不用 0% 冒充"没有瓶颈"
  if (kpi.slowestMs !== null && kpi.measuredTotalMs > 0) {
    kpi.slowestShare = kpi.slowestMs / kpi.measuredTotalMs
  }
  return kpi
}

/** 阈值合并:允许只覆盖其中一档,未覆盖的取默认档;非有限数一律回落默认(判据不因传错参而静默变形) */
export function resolveTraceThresholds(
  overrides?: Partial<TraceFindingThresholds>,
): TraceFindingThresholds {
  const base: TraceFindingThresholds = { ...TRACE_FINDING_DEFAULTS }
  if (!overrides) return base
  for (const key of Object.keys(base) as (keyof TraceFindingThresholds)[]) {
    const value = overrides[key]
    if (typeof value === 'number' && Number.isFinite(value)) base[key] = value
  }
  return base
}

/** findings 判据(逐条可测):空轨迹 → 失败步 → 单步占比 → 缺测步 → 总耗时超阈 */
export function evaluateAgentTraceFindings(
  kpi: AgentTraceKpi,
  overrides?: Partial<TraceFindingThresholds>,
): TraceFinding[] {
  const t = resolveTraceThresholds(overrides)
  const findings: TraceFinding[] = []

  if (kpi.stepCount <= t.emptyTraceStepCount) {
    findings.push(
      makeFinding('emptyTrace', { stepCount: kpi.stepCount, threshold: t.emptyTraceStepCount }),
    )
  }
  // 阈值 0 = **关这一档**(契约见 agent-trace-types 的字段注:「0 档 = 关判据」)。
  // 原来写成 `count >= 0` 让它恒触发 —— 声明说能关、实现关不掉,是最坏的一种不一致。
  if (t.failedStepCountToFlag > 0 && kpi.errorCount >= t.failedStepCountToFlag) {
    findings.push(
      makeFinding('failuresPresent', {
        errorCount: kpi.errorCount,
        cancelledCount: kpi.cancelledCount,
        threshold: t.failedStepCountToFlag,
      }),
    )
  }
  // 单步轨迹的占比恒等于 1,判它"独占"是噪声而非事实 ⇒ 至少两步才出这一档
  if (kpi.slowestShare !== null && kpi.stepCount >= 2 && kpi.slowestShare > t.slowestShareToFlag) {
    findings.push(
      makeFinding('slowestStepDominant', {
        toolName: kpi.slowestToolName ?? '',
        slowestMs: kpi.slowestMs ?? 0,
        sharePercent: roundPercent(kpi.slowestShare),
        thresholdPercent: roundPercent(t.slowestShareToFlag),
      }),
    )
  }
  // 同上:0 = 关这一档,否则 `0 >= 0` 会对"全部步都有耗时"的干净轨迹也报缺测。
  if (t.unmeasuredStepCountToFlag > 0 && kpi.unmeasuredStepCount >= t.unmeasuredStepCountToFlag) {
    findings.push(
      makeFinding('unmeasuredSteps', {
        unmeasuredStepCount: kpi.unmeasuredStepCount,
        stepCount: kpi.stepCount,
        threshold: t.unmeasuredStepCountToFlag,
      }),
    )
  }
  if (kpi.measuredStepCount > 0 && kpi.measuredTotalMs > t.measuredTotalMsToFlag) {
    findings.push(
      makeFinding('measuredTotalOverBudget', {
        measuredTotalMs: kpi.measuredTotalMs,
        ceilingMs: t.measuredTotalMsToFlag,
      }),
    )
  }
  return findings
}

function makeFinding(id: TraceFindingId, params: Record<string, string | number>): TraceFinding {
  return { id, severity: FINDING_SEVERITIES[id], params }
}

/** 比例 → 百分数(两位小数足够区分档位;浮点尾数进 HTML 会变成无人能读的长串) */
export function roundPercent(ratio: number): number {
  return Math.round(ratio * 10_000) / 100
}

const SPAN_ID = /^[a-z0-9][a-z0-9_-]{0,40}$/

export type TraceLaneBar = {
  id: string
  fromId: string | null
  leftPct: number
  widthPct: number
}

export type TraceLaneLayout = {
  disposition: 'laid-out' | 'unjudged'
  reason:
    | 'laid-out'
    | 'window-unmeasured'
    | 'spans-unmeasured'
    | 'span-unreadable'
    | 'span-outside'
    | 'edge-unknown'
    | 'window-empty'
  lanes: { lane: string; spans: TraceLaneBar[] }[] | null
}

function finiteMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function lanePct(part: number, whole: number): number {
  return Math.round((part / whole) * 1000) / 10
}

/**
 * 按已量到的时间窗把分段排进进程道。
 * 越出窗口不裁进图里；前序点名对不上就不画，避免半张瀑布看起来像完整启动。
 */
export function layoutTraceLanes(input: {
  originMs: unknown
  horizonMs: unknown
  spans: unknown
}): TraceLaneLayout {
  const blank = (reason: TraceLaneLayout['reason']): TraceLaneLayout => ({
    disposition: 'unjudged',
    reason,
    lanes: null,
  })
  const origin = finiteMs(input.originMs)
  const horizon = finiteMs(input.horizonMs)
  if (origin === null || horizon === null) return blank('window-unmeasured')
  if (horizon <= origin) return blank('window-empty')
  if (input.spans === null || input.spans === undefined) return blank('spans-unmeasured')
  if (!Array.isArray(input.spans)) return blank('spans-unmeasured')
  const window = horizon - origin
  const pending: {
    id: string
    lane: string
    fromId: string | null
    leftPct: number
    widthPct: number
  }[] = []
  const ids = new Set<string>()
  for (const item of input.spans) {
    if (item === null || typeof item !== 'object' || Array.isArray(item))
      return blank('span-unreadable')
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || !SPAN_ID.test(row.id)) return blank('span-unreadable')
    if (typeof row.lane !== 'string' || !SPAN_ID.test(row.lane)) return blank('span-unreadable')
    if (ids.has(row.id)) return blank('span-unreadable')
    const start = finiteMs(row.startMs)
    const end = finiteMs(row.endMs)
    if (start === null || end === null || end < start) return blank('span-unreadable')
    if (start < origin || end > horizon) return blank('span-outside')
    let fromId: string | null = null
    if (row.fromId !== undefined && row.fromId !== null) {
      if (typeof row.fromId !== 'string' || !SPAN_ID.test(row.fromId) || row.fromId === row.id) {
        return blank('edge-unknown')
      }
      fromId = row.fromId
    }
    ids.add(row.id)
    pending.push({
      id: row.id,
      lane: row.lane,
      fromId,
      leftPct: lanePct(start - origin, window),
      widthPct: lanePct(end - start, window),
    })
  }
  for (const span of pending) {
    if (span.fromId !== null && !ids.has(span.fromId)) return blank('edge-unknown')
  }
  const lanes: { lane: string; spans: TraceLaneBar[] }[] = []
  for (const span of pending) {
    let lane = lanes.find((item) => item.lane === span.lane)
    if (!lane) {
      lane = { lane: span.lane, spans: [] }
      lanes.push(lane)
    }
    lane.spans.push({
      id: span.id,
      fromId: span.fromId,
      leftPct: span.leftPct,
      widthPct: span.widthPct,
    })
  }
  return { disposition: 'laid-out', reason: 'laid-out', lanes }
}

/**
 * 拖入的载荷能不能换掉当前报告。
 * 任一在场的段落读不出来，整份留下；不拿空图替换已经画好的那份。
 */
export function admitDroppedTrace(
  previous: AgentTrace,
  raw: unknown,
): { disposition: 'keep' | 'replace'; reason: string; trace: AgentTrace | null } {
  const keep = (reason: string) => ({ disposition: 'keep' as const, reason, trace: null })
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    return keep('payload-unreadable')
  const row = raw as Record<string, unknown>
  const hasSteps = Object.prototype.hasOwnProperty.call(row, 'toolCalls')
  const hasSpans = Object.prototype.hasOwnProperty.call(row, 'spans')
  if (!hasSteps && !hasSpans) return keep('payload-unmeasured')

  let toolCalls = previous.toolCalls
  if (hasSteps) {
    if (!Array.isArray(row.toolCalls)) return keep('steps-unmeasured')
    const parsed: AgentTraceStep[] = []
    for (const item of row.toolCalls) {
      if (item === null || typeof item !== 'object' || Array.isArray(item))
        return keep('step-unreadable')
      const step = normalizeAgentTraceStep(item)
      if (!step) return keep('step-unreadable')
      if (Object.prototype.hasOwnProperty.call(item, 'durationMs')) {
        const duration = (item as { durationMs?: unknown }).durationMs
        if (
          duration !== null &&
          duration !== undefined &&
          !isMeasuredDuration(duration as number)
        ) {
          return keep('duration-unmeasured')
        }
      }
      parsed.push(step)
    }
    toolCalls = parsed
  }

  let spanOriginMs = previous.spanOriginMs
  let spanHorizonMs = previous.spanHorizonMs
  let spans = previous.spans
  if (hasSpans) {
    const layout = layoutTraceLanes({
      originMs: row.spanOriginMs,
      horizonMs: row.spanHorizonMs,
      spans: row.spans,
    })
    if (layout.disposition !== 'laid-out' || layout.lanes === null) return keep(layout.reason)
    spanOriginMs = row.spanOriginMs as number
    spanHorizonMs = row.spanHorizonMs as number
    spans = row.spans as AgentTrace['spans']
  }

  let title = previous.title
  if (Object.prototype.hasOwnProperty.call(row, 'title')) {
    if (typeof row.title !== 'string' || row.title.trim() === '') return keep('title-unreadable')
    title = row.title
  }
  let exportedAt = previous.exportedAt
  if (Object.prototype.hasOwnProperty.call(row, 'exportedAt')) {
    if (typeof row.exportedAt !== 'string' || row.exportedAt.trim() === '')
      return keep('exported-unreadable')
    exportedAt = row.exportedAt
  }
  let messages = previous.messages
  if (Object.prototype.hasOwnProperty.call(row, 'messages')) {
    if (!Array.isArray(row.messages)) return keep('messages-unreadable')
    const parsedMessages: AgentTraceMessage[] = []
    for (const item of row.messages) {
      if (item === null || typeof item !== 'object' || Array.isArray(item))
        return keep('messages-unreadable')
      const message = item as { role?: unknown; content?: unknown }
      if (typeof message.role !== 'string' || message.role.trim() === '')
        return keep('messages-unreadable')
      const next: AgentTraceMessage = { role: message.role }
      if (typeof message.content === 'string') next.content = message.content
      parsedMessages.push(next)
    }
    messages = parsedMessages
  }

  return {
    disposition: 'replace',
    reason: 'measured',
    trace: {
      ...previous,
      title,
      toolCalls,
      exportedAt,
      messages,
      spanOriginMs,
      spanHorizonMs,
      spans,
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
