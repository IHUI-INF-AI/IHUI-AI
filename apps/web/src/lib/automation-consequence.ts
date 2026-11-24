// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D61 自动化执行后果预演(与 D30 强协同)。
 *
 * 建/改 automation 前先算后果:输入 automation 草稿 + 系统状态,
 * 确定性输出七态之一(判断中 / 已指派待激活 / 将创建运行 /
 * 已有排队或运行中 / 暂不可执行 / 仅保存指派 / 无法预览)。
 *
 * 设计约束:
 * - 纯函数:同输入必同输出,内部禁用 Date.now()/Math.random(),
 *   调用方经 `nowIso` 注入时钟。
 * - D30 对齐(只读复述,不 import 后端代码):
 *   tick 到期条件 `status=active ∧ (once: scheduledAt<=now ∧ lastRunAt IS NULL
 *   | recurring: nextRunAt<=now)`;会话规则"绑定 conversationId 优先,
 *   否则 auto_<id>"。本函数不碰 session,只预演"会不会产生运行"。
 * - 预演时间 UTC 口径近似值,真实调度以服务端时区为准。
 * - i18n 键清单交主 agent 落词,本文件只输出 reasonKey。
 */

export type AutomationConsequenceState =
  | 'evaluating'
  | 'assigned-pending-activation'
  | 'will-create-run'
  | 'already-queued-or-running'
  | 'temporarily-unexecutable'
  | 'save-assignment-only'
  | 'unpreviewable'

export type AutomationConsequenceScheduleType = 'once' | 'recurring'

export type AutomationConsequenceStatus = 'active' | 'paused'

/** D30 认领来源:issue / 扫描告警 / 失败测试 / 手工;null = 未绑定认领来源 */
export type AutomationClaimSource = 'issue' | 'scan-alert' | 'failed-test' | 'manual'

export interface AutomationConsequenceDraft {
  name: string
  prompt: string
  scheduleType: AutomationConsequenceScheduleType
  /** once 口径 ISO(含时区偏移);recurring 下忽略 */
  scheduledAt: string | null
  /** recurring 口径 MVP rrule;once 下忽略 */
  rrule: string | null
  status: AutomationConsequenceStatus
  /** 已绑定 D30 认领来源则填来源,手工计划填 'manual',未绑定填 null */
  claimSource: AutomationClaimSource | null
  /** once 已执行过则填上次执行 ISO(对应后端 lastRunAt),否则 null */
  lastRunAt: string | null
}

export interface AutomationConsequenceSystem {
  /** D30 认领归因还在判断中(来源未落定) */
  claimEvaluating: boolean
  /** 该认领已指派给本 automation 草稿 */
  claimAssigned: boolean
  /** 指派可激活(来源有效 + 配额/权限允许) */
  claimActivatable: boolean
  /** 同一 automation 已有排队或运行中的执行 */
  hasQueuedOrRunning: boolean
  /** 调度器/执行器可用(ai-service agent-runtime 可达且调度 tick 正常) */
  schedulerAvailable: boolean
  /** 当前时间 ISO(调用方注入,保证确定性) */
  nowIso: string
}

export interface AutomationConsequence {
  state: AutomationConsequenceState
  /** automations.consequence.* 词表键(键清单交主 agent,本文件不写 messages) */
  reasonKey: string
  /** 预演下次运行时间(UTC ISO);不产生运行的态一律 null */
  nextRunAt: string | null
}

/** 七态 → 词表键(automations 命名空间,主 agent 落词用) */
export const AUTOMATION_CONSEQUENCE_REASON_KEYS: Record<AutomationConsequenceState, string> = {
  evaluating: 'consequence.evaluating',
  'assigned-pending-activation': 'consequence.assignedPendingActivation',
  'will-create-run': 'consequence.willCreateRun',
  'already-queued-or-running': 'consequence.alreadyQueuedOrRunning',
  'temporarily-unexecutable': 'consequence.temporarilyUnexecutable',
  'save-assignment-only': 'consequence.saveAssignmentOnly',
  unpreviewable: 'consequence.unpreviewable',
}

/** 七态清单(用例/UI 穷举断言用,防新增态漏用例) */
export const AUTOMATION_CONSEQUENCE_STATES: readonly AutomationConsequenceState[] = [
  'evaluating',
  'assigned-pending-activation',
  'will-create-run',
  'already-queued-or-running',
  'temporarily-unexecutable',
  'save-assignment-only',
  'unpreviewable',
]

// =============================================================================
// MVP rrule 解析 + UTC 下次运行(与后端 agent-automation-scheduler 同语义,
// FREQ=HOURLY/DAILY/WEEKLY + BYHOUR/BYMINUTE/BYDAY,WEEKLY 必须显式 BYDAY)
// =============================================================================

const WEEKDAY_MAP: Record<string, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 0,
}

interface PreviewRruleParts {
  freq: 'HOURLY' | 'DAILY' | 'WEEKLY'
  byHour: number
  byMinute: number
  byDays: readonly number[] | null
}

function parsePreviewRruleParts(rrule: string): PreviewRruleParts | null {
  const parts: Record<string, string> = {}
  for (const seg of rrule.split(';')) {
    const idx = seg.indexOf('=')
    if (idx <= 0) continue
    parts[seg.slice(0, idx).trim().toUpperCase()] = seg.slice(idx + 1).trim()
  }
  const freqRaw = parts['FREQ']?.toUpperCase()
  if (freqRaw !== 'HOURLY' && freqRaw !== 'DAILY' && freqRaw !== 'WEEKLY') return null

  let byHour = 0
  const byHourRaw = parts['BYHOUR']
  if (byHourRaw !== undefined) {
    const h = Number(byHourRaw)
    if (!Number.isInteger(h) || h < 0 || h > 23) return null
    byHour = h
  }
  let byMinute = 0
  const byMinuteRaw = parts['BYMINUTE']
  if (byMinuteRaw !== undefined) {
    const m = Number(byMinuteRaw)
    if (!Number.isInteger(m) || m < 0 || m > 59) return null
    byMinute = m
  }

  let byDays: readonly number[] | null = null
  const byDayRaw = parts['BYDAY']
  if (byDayRaw !== undefined) {
    const days: number[] = []
    for (const token of byDayRaw.split(',')) {
      const wd = WEEKDAY_MAP[token.trim().toUpperCase()]
      if (wd === undefined) return null
      days.push(wd)
    }
    if (days.length === 0) return null
    byDays = days
  }

  if (freqRaw === 'WEEKLY' && byDays === null) return null
  return { freq: freqRaw, byHour, byMinute, byDays }
}

function atUtc(base: Date, hour: number, minute: number): Date {
  const d = new Date(base.getTime())
  d.setUTCHours(hour, minute, 0, 0)
  return d
}

/**
 * 预演下次运行(UTC 口径,严格晚于 now)。
 * 解析失败返回 null(调用方判"暂不可执行",与后端 create 400
 * 'rrule 无法计算出下次执行时间'同语义)。
 */
export function computePreviewNextRun(
  scheduleType: AutomationConsequenceScheduleType,
  scheduledAt: string | null,
  rrule: string | null,
  nowIso: string,
): string | null {
  const nowMs = Date.parse(nowIso)
  if (Number.isNaN(nowMs)) return null
  const now = new Date(nowMs)

  if (scheduleType === 'once') {
    if (!scheduledAt) return null
    const t = Date.parse(scheduledAt)
    return Number.isNaN(t) ? null : new Date(t).toISOString()
  }

  if (!rrule) return null
  const parts = parsePreviewRruleParts(rrule)
  if (!parts) return null

  if (parts.freq === 'HOURLY') {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  }
  if (parts.freq === 'DAILY') {
    const today = atUtc(now, parts.byHour, parts.byMinute)
    if (today.getTime() > now.getTime()) return today.toISOString()
    return new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
  }
  for (let offset = 0; offset <= 8; offset++) {
    const candidate = atUtc(now, parts.byHour, parts.byMinute)
    candidate.setUTCDate(candidate.getUTCDate() + offset)
    if (candidate.getTime() <= now.getTime()) continue
    if (parts.byDays !== null && parts.byDays.includes(candidate.getUTCDay())) {
      return candidate.toISOString()
    }
  }
  return null
}

// =============================================================================
// 主入口:草稿 + 系统状态 → 七态(优先级自上而下,首个命中即返回)
// =============================================================================

function toResult(
  state: AutomationConsequenceState,
  nextRunAt: string | null = null,
): AutomationConsequence {
  return { state, reasonKey: AUTOMATION_CONSEQUENCE_REASON_KEYS[state], nextRunAt }
}

/**
 * 建/改 automation 前算后果(纯函数,确定性)。
 *
 * 优先级:
 * 1. 草稿/时钟非法,或"已指派却无认领来源"自相矛盾 → 无法预览
 * 2. 认领归因未落定 → 判断中
 * 3. 已有排队或运行中(幂等保护) → 已有排队或运行中
 * 4. 调度器不可用 → 暂不可执行
 * 5. recurring 算不出下次时间 → 暂不可执行
 * 6. once 已执行过(tick 的 lastRunAt IS NULL 永不成立),或已指派但不可激活
 *    → 仅保存指派
 * 7. paused:有指派 → 已指派待激活;无指派 → 仅保存指派
 * 8. 其余 → 将创建运行
 */
export function predictAutomationConsequence(
  draft: AutomationConsequenceDraft,
  system: AutomationConsequenceSystem,
): AutomationConsequence {
  const nowMs = Date.parse(system.nowIso)
  const nameOk = draft.name.trim().length > 0
  const promptOk = draft.prompt.trim().length > 0
  const typeOk = draft.scheduleType === 'once' || draft.scheduleType === 'recurring'
  const statusOk = draft.status === 'active' || draft.status === 'paused'
  const onceOk =
    draft.scheduleType !== 'once' ||
    (draft.scheduledAt !== null && !Number.isNaN(Date.parse(draft.scheduledAt)))
  const recurringOk =
    draft.scheduleType !== 'recurring' ||
    (draft.rrule !== null && parsePreviewRruleParts(draft.rrule) !== null)
  const lastRunOk = draft.lastRunAt === null || !Number.isNaN(Date.parse(draft.lastRunAt))
  const assignmentCoherent = !system.claimAssigned || draft.claimSource !== null

  if (
    Number.isNaN(nowMs) ||
    !nameOk ||
    !promptOk ||
    !typeOk ||
    !statusOk ||
    !onceOk ||
    !recurringOk ||
    !lastRunOk ||
    !assignmentCoherent
  ) {
    return toResult('unpreviewable')
  }

  if (system.claimEvaluating) return toResult('evaluating')

  if (system.hasQueuedOrRunning) return toResult('already-queued-or-running')

  if (!system.schedulerAvailable) return toResult('temporarily-unexecutable')

  const nextRunAt = computePreviewNextRun(
    draft.scheduleType,
    draft.scheduledAt,
    draft.rrule,
    system.nowIso,
  )
  // recurring 必有 nextRunAt(上已验 rrule 可解析,此处为防御性收口);
  // once 必有 scheduledAt(上已验)。双保险:算不出即暂不可执行。
  if (nextRunAt === null) return toResult('temporarily-unexecutable')

  const onceAlreadyRan = draft.scheduleType === 'once' && draft.lastRunAt !== null
  if (onceAlreadyRan || (system.claimAssigned && !system.claimActivatable)) {
    return toResult('save-assignment-only')
  }

  if (draft.status === 'paused') {
    return system.claimAssigned
      ? toResult('assigned-pending-activation', nextRunAt)
      : toResult('save-assignment-only')
  }

  return toResult('will-create-run', nextRunAt)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
