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
  type AgentTraceKpi,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
