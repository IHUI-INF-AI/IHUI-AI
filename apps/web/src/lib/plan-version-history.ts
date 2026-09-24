// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plan 历史版本(按"轮")快照 / 对比纯逻辑(D93)。
 *
 * 版本单位 = 轮(turn/round):plan 结构(步骤清单 / 目标 / 范围 / 约束)每次变化记一版。
 * 存储 = 内存 Map + localStorage(`ihui-plan-versions:<planId>`),不新建表,
 * 不改动任何现有 store 的 state shape(含 stores/chat.ts)。
 */

import type { PlanDocument, PlanStep } from '@ihui/shared/plan/index'

/** 单步快照(只存对照所需的最小字段) */
export interface PlanVersionStepSnapshot {
  id: string
  title: string
  description: string
  status: PlanStep['status']
  priority: PlanStep['priority']
  order: number
}

/** 一轮版本快照 */
export interface PlanVersionSnapshot {
  /** 轮次号,从 1 起按记录顺序递增 */
  version: number
  createdAt: string
  label: string
  goal: string
  scope: string
  constraints: string
  steps: PlanVersionStepSnapshot[]
}

export type PlanStepChangeKind = 'added' | 'removed' | 'modified' | 'unchanged'

export interface PlanStepChange {
  kind: PlanStepChangeKind
  stepId: string
  title: string
  detail: string
}

export interface PlanVersionDiffSummary {
  added: number
  removed: number
  modified: number
  unchanged: number
}

export interface PlanVersionDiffResult {
  fromVersion: number
  toVersion: number
  goalChanged: boolean
  scopeChanged: boolean
  changes: PlanStepChange[]
  summary: PlanVersionDiffSummary
}

export const PLAN_VERSION_STORAGE_PREFIX = 'ihui-plan-versions:'
/** 单计划最多保留轮数,防止 localStorage 膨胀 */
export const PLAN_VERSION_MAX_KEPT = 30

type PlanStructureLike = Pick<PlanDocument, 'goal' | 'scope' | 'constraints' | 'steps'>

function toStepSnapshot(step: PlanStep): PlanVersionStepSnapshot {
  return {
    id: step.id,
    title: step.title,
    description: step.description,
    status: step.status,
    priority: step.priority,
    order: step.order,
  }
}

/** 为当前 plan 构造一轮快照(不落盘,调用方决定是否 append) */
export function snapshotPlan(
  plan: PlanStructureLike,
  version: number,
  label?: string,
): PlanVersionSnapshot {
  return {
    version,
    createdAt: new Date().toISOString(),
    label: label ?? `第 ${version} 轮`,
    goal: plan.goal,
    scope: plan.scope,
    constraints: plan.constraints,
    steps: plan.steps.map(toStepSnapshot),
  }
}

/** 结构签名:步骤增删改 + 目标/范围/约束变化都会改变签名 */
export function signatureOf(plan: PlanStructureLike): string {
  const normalized = {
    goal: plan.goal,
    scope: plan.scope,
    constraints: plan.constraints,
    steps: plan.steps.map((s) => [s.id, s.title, s.description, s.status, s.priority, s.order]),
  }
  return JSON.stringify(normalized)
}

/** 上一版与当前 plan 结构不一致即应记一版 */
export function shouldRecordVersion(
  prev: PlanVersionSnapshot | null,
  plan: PlanStructureLike,
): boolean {
  if (prev === null) return true
  const prevLike: PlanStructureLike = {
    goal: prev.goal,
    scope: prev.scope,
    constraints: prev.constraints,
    steps: prev.steps.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      status: s.status,
      priority: s.priority,
      order: s.order,
    })),
  }
  return signatureOf(prevLike) !== signatureOf(plan)
}

/** 追加一版(去重相邻同签名 + 截断上限),返回新历史(不变更入参) */
export function appendVersion(
  history: PlanVersionSnapshot[],
  snapshot: PlanVersionSnapshot,
): PlanVersionSnapshot[] {
  const last = history.length > 0 ? history[history.length - 1] : undefined
  if (last !== undefined) {
    const lastLike: PlanStructureLike = {
      goal: last.goal,
      scope: last.scope,
      constraints: last.constraints,
      steps: last.steps.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        status: s.status,
        priority: s.priority,
        order: s.order,
      })),
    }
    const snapLike: PlanStructureLike = {
      goal: snapshot.goal,
      scope: snapshot.scope,
      constraints: snapshot.constraints,
      steps: snapshot.steps.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        status: s.status,
        priority: s.priority,
        order: s.order,
      })),
    }
    if (signatureOf(lastLike) === signatureOf(snapLike)) return history
  }
  const next = [...history, snapshot]
  return next.length > PLAN_VERSION_MAX_KEPT
    ? next.slice(next.length - PLAN_VERSION_MAX_KEPT)
    : next
}

function modifiedFields(a: PlanVersionStepSnapshot, b: PlanVersionStepSnapshot): string[] {
  const fields: string[] = []
  if (a.title !== b.title) fields.push('标题')
  if (a.description !== b.description) fields.push('描述')
  if (a.status !== b.status) fields.push('状态')
  if (a.priority !== b.priority) fields.push('优先级')
  if (a.order !== b.order) fields.push('排序')
  return fields
}

/** 跨版本 diff:按步骤 id 对齐,目标/范围变化单独标记 */
export function diffPlanVersions(
  from: PlanVersionSnapshot,
  to: PlanVersionSnapshot,
): PlanVersionDiffResult {
  const fromMap = new Map(from.steps.map((s) => [s.id, s]))
  const toMap = new Map(to.steps.map((s) => [s.id, s]))
  const changes: PlanStepChange[] = []

  for (const step of from.steps) {
    const peer = toMap.get(step.id)
    if (peer === undefined) {
      changes.push({ kind: 'removed', stepId: step.id, title: step.title, detail: '本轮已删除' })
    } else {
      const fields = modifiedFields(step, peer)
      if (fields.length === 0) {
        changes.push({ kind: 'unchanged', stepId: step.id, title: step.title, detail: '无变化' })
      } else {
        changes.push({
          kind: 'modified',
          stepId: step.id,
          title: peer.title,
          detail: `变化字段:${fields.join('、')}`,
        })
      }
    }
  }
  for (const step of to.steps) {
    if (!fromMap.has(step.id)) {
      changes.push({ kind: 'added', stepId: step.id, title: step.title, detail: '本轮新增' })
    }
  }

  const summary: PlanVersionDiffSummary = {
    added: changes.filter((c) => c.kind === 'added').length,
    removed: changes.filter((c) => c.kind === 'removed').length,
    modified: changes.filter((c) => c.kind === 'modified').length,
    unchanged: changes.filter((c) => c.kind === 'unchanged').length,
  }
  return {
    fromVersion: from.version,
    toVersion: to.version,
    goalChanged: from.goal !== to.goal,
    scopeChanged: from.scope !== to.scope || from.constraints !== to.constraints,
    changes,
    summary,
  }
}

/** localStorage 键(声明:持久化仅用此键,不碰其他 store 的键) */
function storageKeyFor(planId: string): string {
  return `${PLAN_VERSION_STORAGE_PREFIX}${planId}`
}

/** SSR 安全的内存兜底(Window 不可用 / localStorage 抛错时用) */
const memoryFallback = new Map<string, PlanVersionSnapshot[]>()

function isValidSnapshot(value: unknown): value is PlanVersionSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v['version'] === 'number' && Array.isArray(v['steps'])
}

/** 读取某计划的版本历史(SSR 下返回内存兜底,无记录返回空数组 = 空态) */
export function loadPlanVersions(planId: string): PlanVersionSnapshot[] {
  if (typeof window === 'undefined') return memoryFallback.get(storageKeyFor(planId)) ?? []
  try {
    const raw = window.localStorage.getItem(storageKeyFor(planId))
    if (raw === null) return memoryFallback.get(storageKeyFor(planId)) ?? []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidSnapshot)
  } catch {
    return memoryFallback.get(storageKeyFor(planId)) ?? []
  }
}

/** 持久化某计划的版本历史(同步写内存兜底,localStorage 失败不抛错) */
export function savePlanVersions(planId: string, history: PlanVersionSnapshot[]): void {
  memoryFallback.set(storageKeyFor(planId), history)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKeyFor(planId), JSON.stringify(history))
  } catch {
    // 配额不足或隐私模式:内存兜底已写,本轮可用,下轮重建
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
