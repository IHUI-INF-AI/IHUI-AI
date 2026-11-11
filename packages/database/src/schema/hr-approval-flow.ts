// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { pgTable, uuid, varchar, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { hrLeaveRequest } from './hr-ai-management.js'

/**
 * 人事请假审批流(HR-3,2026-11-11 立)。
 *
 * 两张表:
 *   · hr_approval_flow   审批规则(假别 × 天数区间 → 有序审批链),由管理端维护;
 *   · hr_approval_instance 审批实例(一次请假申请提交后落一条,链快照固化到提交时刻,
 *     规则后续改动不影响已在飞的实例)。
 *
 * 区间语义:[min_days, max_days) —— min 含、max 不含;max_days 为 NULL 表示无上界。
 * 命中规则 = 假别相同 ∧ status='active' ∧ 未软删 ∧ min_days<=total_days ∧ (max_days 为空 ∨ total_days<max_days),
 * 多条命中取 min_days 最大者(最具体规则优先)。
 *
 * approver_ids 为有序审批链(string[] = 审批人 user id);approver_proxy_id 是可选代理
 * (链中任一步允许该代理代替当前审批人放行)。timeout_hours 到点未决 → 由
 * escalateTimedOut 升级到 escalation_approver_id(无则留在原步、仅记 byTimeout 轨迹)。
 */

/** 审批规则表 (hr_approval_flow)。status: active/disabled。 */
export const hrApprovalFlow = pgTable(
  'hr_approval_flow',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 假别,词表同 hr_leave_request.leave_type */
    leaveType: varchar('leave_type', { length: 30 }).notNull(),
    /** 最少天数(含) */
    minDays: integer('min_days').default(0).notNull(),
    /** 最多天数(不含);NULL = 无上界 */
    maxDays: integer('max_days'),
    /** 有序审批链(审批人 user id 列表),提交时刻固化到实例的 chain_snapshot */
    approverIds: jsonb('approver_ids').$type<string[]>().notNull(),
    /** 可选代理审批人(链中任一步可代替当前审批人放行) */
    approverProxyId: uuid('approver_proxy_id'),
    /** 审批时限(小时),到点未决触发超时升级 */
    timeoutHours: integer('timeout_hours').default(24).notNull(),
    /** 超时升级目标(审批人 user id);NULL = 仅记 byTimeout 轨迹、不换人 */
    escalationApproverId: uuid('escalation_approver_id'),
    /** active/disabled */
    status: varchar('status', { length: 20 }).default('active').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    typeMinIdx: index('ix_hr_approval_flow_type_min').on(t.leaveType, t.minDays),
    statusIdx: index('ix_hr_approval_flow_status').on(t.status),
  }),
)

/** 单步审批记录(存入 hr_approval_instance.steps jsonb 数组)。 */
export interface HrApprovalStep {
  /** 步序(0 起,对应 chain_snapshot 下标) */
  step: number
  /** 本步审批人 user id */
  approverId: string
  /** approved / rejected / escalated */
  action: 'approved' | 'rejected' | 'escalated'
  /** 决策时刻 */
  decidedAt: string
  /** 审批意见(可选) */
  remark?: string
  /** 是否超时触发(escalateTimedOut 写入) */
  byTimeout?: boolean
}

/** 审批实例表 (hr_approval_instance)。status: pending/approved/rejected/escalated。 */
export const hrApprovalInstance = pgTable(
  'hr_approval_instance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 关联的请假申请;申请删除则级联清理实例 */
    leaveRequestId: uuid('leave_request_id')
      .notNull()
      .references(() => hrLeaveRequest.id, { onDelete: 'cascade' }),
    /** 当前步(0 起,指向 chain_snapshot 下标) */
    currentStep: integer('current_step').default(0).notNull(),
    /** 提交时刻的审批链快照(规则后续改动不影响在飞实例) */
    chainSnapshot: jsonb('chain_snapshot').$type<string[]>().notNull(),
    /** pending/approved/rejected/escalated */
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    /** 逐级审批轨迹 */
    steps: jsonb('steps').$type<HrApprovalStep[]>().default([]).notNull(),
    /** 本步审批截止时刻(超时升级判据) */
    dueAt: timestamp('due_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    /** 终态时刻(通过/驳回时回写;升级不写) */
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusStepIdx: index('ix_hr_approval_inst_status_step').on(t.status, t.currentStep),
    leaveReqIdx: index('ix_hr_approval_inst_leave_req').on(t.leaveRequestId),
  }),
)

export type HrApprovalFlow = typeof hrApprovalFlow.$inferSelect
export type NewHrApprovalFlow = typeof hrApprovalFlow.$inferInsert
export type HrApprovalInstance = typeof hrApprovalInstance.$inferSelect
export type NewHrApprovalInstance = typeof hrApprovalInstance.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
