// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, isNull, desc, inArray } from 'drizzle-orm'
import {
  hrApprovalFlow,
  hrApprovalInstance,
  hrLeaveRequest,
  type HrApprovalFlow,
  type HrApprovalInstance,
  type HrApprovalStep,
  type HrLeaveRequest,
} from '@ihui/database'
import { env } from 'node:process'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { createNotification } from '../db/notification-queries.js'
import {
  buildHrApprovalNotifyData,
  getWechatMiniOpenId,
  isHrApprovalSubscribeConfigured,
  sendSubscribeMessage,
} from './wechat-subscribe-message.js'

/**
 * 人事请假审批流服务(HR-3,2026-11-11 立)。
 *
 * 规则命中:假别相同 ∧ active ∧ 未软删 ∧ min_days<=total_days ∧(max_days 空 ∨ total_days<max_days),
 * 多条命中取 min_days 最大者(最具体规则优先)。max_days 为 NULL = 无上界。
 *
 * 实例生命周期:提交落 pending(current_step=0 + 链快照 + due_at)→ 逐级 approve 推进
 * → 末步通过回写 hr_leave_request=approved / 任一步 rejected 终止并回写 rejected
 * → 到点未决由 escalateTimedOut 升级(把 escalation_approver_id 追加为快照新的一级并记 byTimeout)。
 *
 * 说明:表值/类型从 schema 源模块相对导入,使本文件在 barrel 尚未注册新表时即可独立运行与测试。
 */

/** 审批路由/状态错误。code: NO_FLOW=无匹配规则或链为空;INVALID_LEAVE=请假单非法或实例状态非法;NOT_FOUND=实例不存在。 */
export class ApprovalRouteError extends Error {
  code: 'NO_FLOW' | 'INVALID_LEAVE' | 'NOT_FOUND'
  constructor(code: 'NO_FLOW' | 'INVALID_LEAVE' | 'NOT_FOUND', message: string) {
    super(message)
    this.name = 'ApprovalRouteError'
    this.code = code
  }
}

/** 提交/升级时按 timeout_hours 折算本步截止时刻。 */
function computeDueAt(now: Date, timeoutHours: number): Date {
  return new Date(now.getTime() + timeoutHours * 3_600_000)
}

/** 审批结果(附通知是否成功发出,通知失败不影响主流程)。 */
export interface ApprovalMutationResult {
  instance: HrApprovalInstance
  notified: boolean
}

/**
 * 按假别 × 天数区间路由审批规则。命中 min_days 最大者;无命中返回 undefined。
 */
export async function routeApprovalFlow(
  leaveType: string,
  totalDays: number,
): Promise<HrApprovalFlow | undefined> {
  const candidates = await db
    .select()
    .from(hrApprovalFlow)
    .where(
      and(
        eq(hrApprovalFlow.leaveType, leaveType),
        eq(hrApprovalFlow.status, 'active'),
        isNull(hrApprovalFlow.deletedAt),
      ),
    )
  const matched = candidates.filter(
    (f) => f.minDays <= totalDays && (f.maxDays === null || totalDays < f.maxDays),
  )
  if (matched.length === 0) return undefined
  // 最具体规则优先:min_days 最大者(max_days 已在上面按区间语义过滤)
  return matched.reduce((best, cur) => (cur.minDays > best.minDays ? cur : best))
}

/**
 * 提交请假审批:校验请假单存在 → 路由规则 → 校验链非空 → 落实例(链快照 + due_at)。
 * 通知首位审批人(站内信),失败仅记日志、不影响提交。
 */
export async function submitApproval(input: {
  leaveRequestId: string
}): Promise<ApprovalMutationResult> {
  const leaveRows = await db
    .select()
    .from(hrLeaveRequest)
    .where(eq(hrLeaveRequest.id, input.leaveRequestId))
  const leave: HrLeaveRequest | undefined = leaveRows[0]
  if (!leave) throw new ApprovalRouteError('INVALID_LEAVE', `请假单不存在: ${input.leaveRequestId}`)

  const flow = await routeApprovalFlow(leave.leaveType, leave.totalDays)
  if (!flow || flow.approverIds.length === 0) {
    throw new ApprovalRouteError(
      'NO_FLOW',
      `未匹配到审批规则: ${leave.leaveType}/${leave.totalDays}天`,
    )
  }

  const now = new Date()
  const inserted = await db
    .insert(hrApprovalInstance)
    .values({
      leaveRequestId: input.leaveRequestId,
      currentStep: 0,
      chainSnapshot: [...flow.approverIds],
      status: 'pending',
      steps: [],
      dueAt: computeDueAt(now, flow.timeoutHours),
      submittedAt: now,
    })
    .returning()
  const instance = inserted[0]
  if (!instance) throw new ApprovalRouteError('NO_FLOW', '审批实例落库失败')

  const notified = await notifyStepApprover(
    instance,
    instance.chainSnapshot[0],
    '请假审批待处理',
    now,
  )
  return { instance, notified }
}

/** 通知某审批人:站内信(主,权威留痕)+ 微信订阅消息(辅,尽力外发)。
 *  任何异常只记 warn,绝不打断审批主流程。返回站内信是否落库(权威触达凭据)。 */
async function notifyStepApprover(
  instance: HrApprovalInstance,
  approverId: string | undefined,
  title: string,
  now: Date,
): Promise<boolean> {
  if (!approverId) return false
  const content = `审批实例 ${instance.id} 第 ${instance.currentStep + 1} 步待你处理`

  // ① 站内信(主通道:权威留痕,return true/false 据此)
  let inAppOk = false
  try {
    await createNotification({
      userId: approverId,
      type: 'hr_leave_approval',
      title,
      content,
      data: { instanceId: instance.id, step: instance.currentStep },
    })
    inAppOk = true
  } catch (err) {
    logger.warn('审批站内信发送失败(不影响主流程)', {
      instanceId: instance.id,
      approverId,
      err: err instanceof Error ? err.message : String(err),
      at: now.toISOString(),
    })
  }

  // ② 微信订阅消息(辅通道:HR-3,2026-11-11 立;尽力外发,失败只记 warn)
  //    未配置 HR 审批模板 ⇒ 优雅降级只走站内信,不视为错误。
  if (isHrApprovalSubscribeConfigured()) {
    try {
      const openId = await getWechatMiniOpenId(approverId)
      if (openId) {
        const res = await sendSubscribeMessage(
          openId,
          buildHrApprovalNotifyData({ title, content, at: now }),
          '/pkg-hr/approval', // 审批待办小程序页(与 edu 的 /pkg-user/bill/index 同构:尽力跳转)
          env.WX_MINI_HR_APPROVAL_TMPL_ID,
        )
        if (!res.ok) {
          // 43101=用户未订阅/授权已耗尽,属预期;其余记 warn 便于运营看清零触达原因
          logger.warn('审批微信订阅消息未送达(不影响主流程)', {
            instanceId: instance.id,
            approverId,
            errcode: res.errcode,
            errmsg: res.errmsg,
          })
        }
      }
      // 无 openid ⇒ 该审批人未绑小程序,只走站内信,记 debug 不刷 warn
    } catch (err) {
      logger.warn('审批微信订阅消息发送异常(不影响主流程)', {
        instanceId: instance.id,
        approverId,
        err: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return inAppOk
}

/**
 * 审批决策:校验实例非终态 → 校验当前步审批人或代理 → 通过则进下一步(末步则回写请假单 approved),
 * 驳回则终止并回写 rejected。通知下一级审批人(若有)。
 */
export async function decideApproval(input: {
  instanceId: string
  approverId: string
  action: 'approved' | 'rejected'
  remark?: string
}): Promise<ApprovalMutationResult> {
  const rows = await db
    .select()
    .from(hrApprovalInstance)
    .where(eq(hrApprovalInstance.id, input.instanceId))
  const instance: HrApprovalInstance | undefined = rows[0]
  if (!instance) throw new ApprovalRouteError('NOT_FOUND', `审批实例不存在: ${input.instanceId}`)
  if (instance.status === 'approved' || instance.status === 'rejected') {
    throw new ApprovalRouteError('INVALID_LEAVE', `审批已结束: ${instance.status}`)
  }

  const chain = instance.chainSnapshot
  const step = instance.currentStep
  const currentApprover = chain[step]
  // 代理审批人:重新路由当前规则取 approver_proxy_id(规则改动不影响已固化的链,只影响代理判定)
  const leaveRows = await db
    .select()
    .from(hrLeaveRequest)
    .where(eq(hrLeaveRequest.id, instance.leaveRequestId))
  const leave: HrLeaveRequest | undefined = leaveRows[0]
  const flow = leave ? await routeApprovalFlow(leave.leaveType, leave.totalDays) : undefined
  const proxy = flow?.approverProxyId ?? null
  if (input.approverId !== currentApprover && input.approverId !== proxy) {
    throw new ApprovalRouteError('INVALID_LEAVE', `非当前步审批人: 期望 ${currentApprover ?? '?'}`)
  }

  const now = new Date()
  const timeoutHours = flow?.timeoutHours ?? 24
  const steps: HrApprovalStep[] = [...instance.steps]

  if (input.action === 'rejected') {
    steps.push({
      step,
      approverId: input.approverId,
      action: 'rejected',
      decidedAt: now.toISOString(),
      ...(input.remark ? { remark: input.remark } : {}),
    })
    const updated = await db
      .update(hrApprovalInstance)
      .set({ status: 'rejected', steps, decidedAt: now, dueAt: null, updatedAt: now })
      .where(eq(hrApprovalInstance.id, instance.id))
      .returning()
    await writeBackLeave(instance.leaveRequestId, 'rejected', input.approverId, input.remark, now)
    return { instance: updated[0] ?? { ...instance, status: 'rejected', steps }, notified: false }
  }

  // 通过:记录本步
  steps.push({
    step,
    approverId: input.approverId,
    action: 'approved',
    decidedAt: now.toISOString(),
    ...(input.remark ? { remark: input.remark } : {}),
  })
  const next = step + 1
  if (next >= chain.length) {
    // 末步通过 → 终态 approved + 回写请假单
    const updated = await db
      .update(hrApprovalInstance)
      .set({ status: 'approved', steps, decidedAt: now, dueAt: null, updatedAt: now })
      .where(eq(hrApprovalInstance.id, instance.id))
      .returning()
    await writeBackLeave(instance.leaveRequestId, 'approved', input.approverId, input.remark, now)
    return { instance: updated[0] ?? { ...instance, status: 'approved', steps }, notified: false }
  }

  // 中间步通过 → 推进到下一步,刷新 due_at,通知下一级
  const dueAt = computeDueAt(now, timeoutHours)
  const updated = await db
    .update(hrApprovalInstance)
    .set({ currentStep: next, status: 'pending', steps, dueAt, updatedAt: now })
    .where(eq(hrApprovalInstance.id, instance.id))
    .returning()
  const nextInstance = updated[0] ?? { ...instance, currentStep: next, steps, dueAt }
  const notified = await notifyStepApprover(nextInstance, chain[next], '请假审批待处理', now)
  return { instance: nextInstance, notified }
}

/** 回写请假单审批状态(approve_at / approver_id / approve_remark)。 */
async function writeBackLeave(
  leaveRequestId: string,
  status: 'approved' | 'rejected',
  approverId: string,
  remark: string | undefined,
  now: Date,
): Promise<void> {
  await db
    .update(hrLeaveRequest)
    .set({
      status,
      approverId,
      approveRemark: remark ?? null,
      approveAt: now,
      updatedAt: now,
    })
    .where(eq(hrLeaveRequest.id, leaveRequestId))
}

/**
 * 超时升级:扫 pending 且 due_at < now 的实例。
 * 有 escalation 目标 → 把目标追加为快照新一级、current_step 指向它、status=escalated、记 byTimeout 步;
 * 无 escalation 目标 → 只在当前步记一条 byTimeout 轨迹并顺延 due_at(留在原步)。
 */
export async function escalateTimedOut(input: { now?: Date } = {}): Promise<{ escalated: number }> {
  const now = input.now ?? new Date()
  const overdue = await db
    .select()
    .from(hrApprovalInstance)
    .where(and(eq(hrApprovalInstance.status, 'pending'), isNull(hrApprovalInstance.decidedAt)))
  const due = overdue.filter((i) => i.dueAt !== null && i.dueAt.getTime() < now.getTime())
  let escalated = 0
  for (const inst of due) {
    const leaveRows = await db
      .select()
      .from(hrLeaveRequest)
      .where(eq(hrLeaveRequest.id, inst.leaveRequestId))
    const leave: HrLeaveRequest | undefined = leaveRows[0]
    const flow = leave ? await routeApprovalFlow(leave.leaveType, leave.totalDays) : undefined
    const escTarget = flow?.escalationApproverId ?? null
    const steps: HrApprovalStep[] = [...inst.steps]
    const chain = [...inst.chainSnapshot]

    if (escTarget) {
      const newStep = chain.length
      chain.push(escTarget)
      steps.push({
        step: newStep,
        approverId: escTarget,
        action: 'escalated',
        decidedAt: now.toISOString(),
        byTimeout: true,
      })
      await db
        .update(hrApprovalInstance)
        .set({
          chainSnapshot: chain,
          currentStep: newStep,
          status: 'escalated',
          steps,
          dueAt: computeDueAt(now, flow?.timeoutHours ?? 24),
          updatedAt: now,
        })
        .where(eq(hrApprovalInstance.id, inst.id))
      escalated += 1
      await notifyStepApprover(
        { ...inst, currentStep: newStep },
        escTarget,
        '请假审批超时升级',
        now,
      )
    } else {
      steps.push({
        step: inst.currentStep,
        approverId: inst.chainSnapshot[inst.currentStep] ?? '',
        action: 'escalated',
        decidedAt: now.toISOString(),
        byTimeout: true,
      })
      await db
        .update(hrApprovalInstance)
        .set({ steps, dueAt: computeDueAt(now, flow?.timeoutHours ?? 24), updatedAt: now })
        .where(eq(hrApprovalInstance.id, inst.id))
    }
  }
  return { escalated }
}

/**
 * 列出某审批人当前待处理的实例(pending/escalated 且链当前步指向该审批人)。
 * jsonb 链按当前步取人无法纯 SQL 过滤,故按状态拉取后在应用层按 chain[current_step] 过滤再分页。
 */
export async function listMyPendingApprovals(input: {
  approverId: string
  limit?: number
  offset?: number
}): Promise<{ list: HrApprovalInstance[]; total: number }> {
  const limit = input.limit ?? 20
  const offset = input.offset ?? 0
  const rows = await db
    .select()
    .from(hrApprovalInstance)
    .where(inArray(hrApprovalInstance.status, ['pending', 'escalated']))
    .orderBy(desc(hrApprovalInstance.submittedAt))
  const mine = rows.filter((i) => i.chainSnapshot[i.currentStep] === input.approverId)
  return { list: mine.slice(offset, offset + limit), total: mine.length }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
