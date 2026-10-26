// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plan 历史版本(按"轮")快照 / 对比纯逻辑 —— 与 web 端
 * apps/web/src/lib/plan-version-history.ts(D93)同源语义的框架无关移植版。
 *
 * 版本单位 = 轮(turn/round):plan 结构(步骤清单/目标/范围/约束)每次变化记一版。
 * 存储 = 调用方注入的 PlanStorage(AsyncStorage),键 `ihui-plan-versions:<planId>`,
 * 与 web 端 localStorage 同键同形状(快照 JSON 结构一致,数据可互读)。
 *
 * 与 web 版差异(有意为之):
 * - modifiedFields 返回字段键('title'|'description'|...)而非中文字面量,
 *   由共享屏经 t() 取词渲染,满足五语要求;
 * - snapshotPlan 的 label 变为可选(RN 端展示标签由屏层按 version 现取 i18n)。
 */
import type { PlanDocument, PlanStep } from '@ihui/shared/plan'

/** 单步快照(只存对照所需的最小字段,与 web 端同形)。 */
export interface PlanVersionStepSnapshot {
  id: string
  title: string
  description: string
  status: PlanStep['status']
  priority: PlanStep['priority']
  order: number
}

/** 一轮版本快照(与 web 端同形;label 可选,RN 展示走 t('planPage.roundLabel'))。 */
export interface PlanVersionSnapshot {
  /** 轮次号,从 1 起按记录顺序递增 */
  version: number
  createdAt: string
  label?: string
  goal: string
  scope: string
  constraints: string
  steps: PlanVersionStepSnapshot[]
}

export type PlanStepChangeKind = 'added' | 'removed' | 'modified' | 'unchanged'

/** 字段键(屏层映射为 planPage.diffField* 文案)。 */
export type PlanStepFieldKey = 'title' | 'description' | 'status' | 'priority' | 'order'

export interface PlanStepChange {
  kind: PlanStepChangeKind
  stepId: string
  title: string
  fields: PlanStepFieldKey[]
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
/** 单计划最多保留轮数,防止本地存储膨胀(与 web 端同值)。 */
export const PLAN_VERSION_MAX_KEPT = 30

/** 版本历史持久化键(声明:仅用此键,不碰其他 store 的键)。 */
export function planVersionStorageKey(planId: string): string {
  return `${PLAN_VERSION_STORAGE_PREFIX}${planId}`
}

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

/** 为当前 plan 构造一轮快照(不落盘,调用方决定是否 append)。 */
export function snapshotPlan(
  plan: PlanStructureLike,
  version: number,
  label?: string,
): PlanVersionSnapshot {
  return {
    version,
    createdAt: new Date().toISOString(),
    label,
    goal: plan.goal,
    scope: plan.scope,
    constraints: plan.constraints,
    steps: plan.steps.map(toStepSnapshot),
  }
}

/** 结构签名:步骤增删改 + 目标/范围/约束变化都会改变签名。 */
export function signatureOf(plan: PlanStructureLike): string {
  const normalized = {
    goal: plan.goal,
    scope: plan.scope,
    constraints: plan.constraints,
    steps: plan.steps.map((s) => [s.id, s.title, s.description, s.status, s.priority, s.order]),
  }
  return JSON.stringify(normalized)
}

function snapshotToStructure(snap: PlanVersionSnapshot): PlanStructureLike {
  return {
    goal: snap.goal,
    scope: snap.scope,
    constraints: snap.constraints,
    steps: snap.steps.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      status: s.status,
      priority: s.priority,
      order: s.order,
    })),
  }
}

/** 上一版与当前 plan 结构不一致即应记一版。 */
export function shouldRecordVersion(
  prev: PlanVersionSnapshot | null,
  plan: PlanStructureLike,
): boolean {
  if (prev === null) return true
  return signatureOf(snapshotToStructure(prev)) !== signatureOf(plan)
}

/** 追加一版(去重相邻同签名 + 截断上限),返回新历史(不变更入参)。 */
export function appendVersion(
  history: PlanVersionSnapshot[],
  snapshot: PlanVersionSnapshot,
): PlanVersionSnapshot[] {
  const last = history.length > 0 ? history[history.length - 1] : undefined
  if (last !== undefined) {
    if (signatureOf(snapshotToStructure(last)) === signatureOf(snapshotToStructure(snapshot))) {
      return history
    }
  }
  const next = [...history, snapshot]
  return next.length > PLAN_VERSION_MAX_KEPT
    ? next.slice(next.length - PLAN_VERSION_MAX_KEPT)
    : next
}

function modifiedFields(
  a: PlanVersionStepSnapshot,
  b: PlanVersionStepSnapshot,
): PlanStepFieldKey[] {
  const fields: PlanStepFieldKey[] = []
  if (a.title !== b.title) fields.push('title')
  if (a.description !== b.description) fields.push('description')
  if (a.status !== b.status) fields.push('status')
  if (a.priority !== b.priority) fields.push('priority')
  if (a.order !== b.order) fields.push('order')
  return fields
}

/** 跨版本 diff:按步骤 id 对齐,目标/范围变化单独标记(与 web 端同算法)。 */
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
      changes.push({ kind: 'removed', stepId: step.id, title: step.title, fields: [] })
    } else {
      const fields = modifiedFields(step, peer)
      changes.push({
        kind: fields.length === 0 ? 'unchanged' : 'modified',
        stepId: step.id,
        title: peer.title,
        fields,
      })
    }
  }
  for (const step of to.steps) {
    if (!fromMap.has(step.id)) {
      changes.push({ kind: 'added', stepId: step.id, title: step.title, fields: [] })
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

/** 反序列化防御(与 web 端 isValidSnapshot 同口径)。 */
export function isValidVersionSnapshot(value: unknown): value is PlanVersionSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v['version'] === 'number' && Array.isArray(v['steps'])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
