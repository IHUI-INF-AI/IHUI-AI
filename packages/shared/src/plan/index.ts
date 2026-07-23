/**
 * Plan 模式跨端共享类型(2026-07-24 立,对标 TRAE Work Plan 模式单一计划文档)。
 *
 * Plan 模式与 Spec 模式的差异:
 *  - Plan:单一计划文档(目标 + 修改范围 + 步骤),适用于中小型功能与模块级重构
 *  - Spec:三文件组(spec.md + tasks.md + checklist.md),适用于系统级重构与高质量项目
 *
 * 本模块定义 Plan 单文档数据模型,API 端点待后续补齐(目前 web 端可先用本地状态管理)。
 */

/** Plan 步骤状态 */
export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped'

/** Plan 优先级 */
export type PlanPriority = 'low' | 'medium' | 'high' | 'critical'

/** Plan 步骤 */
export interface PlanStep {
  id: string
  title: string
  description: string
  status: PlanStepStatus
  priority: PlanPriority
  order: number
  estimatedMinutes?: number
  completedAt?: string
  blockedReason?: string
  affectedFiles?: string[]
  verifyCommands?: string[]
}

/** Plan 文档 */
export interface PlanDocument {
  id: string
  title: string
  goal: string
  scope: string
  constraints: string
  steps: PlanStep[]
  status: 'draft' | 'active' | 'completed' | 'archived'
  createdAt: string
  updatedAt: string
  completedAt?: string
  authorId?: string
  tags?: string[]
}

/** 创建 Plan 请求 */
export interface PlanCreateInput {
  title: string
  goal: string
  scope: string
  constraints: string
  steps?: Array<Omit<PlanStep, 'id' | 'order'>>
  tags?: string[]
}

/** 更新 Plan 步骤请求 */
export interface PlanStepUpdateInput {
  status?: PlanStepStatus
  title?: string
  description?: string
  priority?: PlanPriority
  blockedReason?: string
  completedAt?: string
}

/** Plan 列表查询 */
export interface PlanListQuery {
  status?: PlanDocument['status']
  tag?: string
  limit?: number
  offset?: number
}

/** Plan 列表响应 */
export interface PlanListResponse {
  plans: PlanDocument[]
  total: number
}

/** Plan 进度统计 */
export interface PlanProgressStats {
  total: number
  completed: number
  inProgress: number
  blocked: number
  pending: number
  completionPercent: number
}

/** 步骤状态元数据(供 UI 选择器使用) */
export const PLAN_STEP_STATUS_OPTIONS: Array<{ value: PlanStepStatus; label: string; color: string }> = [
  { value: 'pending', label: '待处理', color: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: '进行中', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'blocked', label: '阻塞', color: 'bg-rose-100 text-rose-700' },
  { value: 'skipped', label: '跳过', color: 'bg-amber-100 text-amber-700' },
]

/** 优先级元数据 */
export const PLAN_PRIORITY_OPTIONS: Array<{ value: PlanPriority; label: string; color: string }> = [
  { value: 'low', label: '低', color: 'bg-slate-100 text-slate-700' },
  { value: 'medium', label: '中', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: '高', color: 'bg-amber-100 text-amber-700' },
  { value: 'critical', label: '紧急', color: 'bg-rose-100 text-rose-700' },
]
