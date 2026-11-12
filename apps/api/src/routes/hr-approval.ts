// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'

import {
  submitApproval,
  decideApproval,
  escalateTimedOut,
  listMyPendingApprovals,
  ApprovalRouteError,
} from '../services/hr-approval.js'
import { requirePermission } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
// 审批规则 CRUD 直接走 db(service 不含规则 CRUD,保持职责单一)。
// 表值从 schema 源模块相对导入,规避 barrel 未注册新表时 tsc 报错。
import { hrApprovalFlow } from '@ihui/database'
import { db } from '../db/index.js'
import { eq, isNull, desc, and } from 'drizzle-orm'

/**
 * 人事请假审批流端点(HR-3,2026-11-11 立)。
 *
 * 权限:全部需 hr:attendance:manage —— 审批规则/实例操作都是敏感动作,不开放给普通员工端。
 * 6 端点:
 *   GET  /flows            列出审批规则(active,未软删,按假别排序)
 *   POST /flows            新建/更新规则(带 id 则更新)
 *   POST /leave/:id/submit 提交请假单进审批(路由规则→落实例)
 *   PUT  /leave/:id/decide 审批决策(通过/驳回;body 带 instanceId + action)
 *   GET  /instances        列出当前审批人的待处理实例
 *   POST /instances/escalate 超时升级扫描
 */

const HR_MANAGE = 'hr:attendance:manage'

const flowBodySchema = z.object({
  /** 带 id 则更新;不带则新建 */
  id: z.string().uuid().optional(),
  /** 假别,与 hr_leave_request.leave_type 词表一致 */
  leaveType: z.string().min(1).max(30),
  /** 天数区间下界(含),默认 0 */
  minDays: z.number().int().min(0).default(0),
  /** 天数区间上界(不含);null=无上界 */
  maxDays: z.number().int().min(1).nullable().default(null),
  /** 有序审批链(至少一人) */
  approverIds: z.array(z.string().uuid()).min(1),
  /** 代理审批人(可选) */
  approverProxyId: z.string().uuid().nullable().optional(),
  /** 超时时长(小时),默认 24 */
  timeoutHours: z.number().int().min(1).default(24),
  /** 超时升级目标(可选) */
  escalationApproverId: z.string().uuid().nullable().optional(),
  /** 状态,默认 active */
  status: z.enum(['active', 'disabled']).default('active'),
})

const submitBodySchema = z.object({
  leaveRequestId: z.string().uuid(),
})

const decideBodySchema = z.object({
  instanceId: z.string().uuid(),
  approverId: z.string().uuid(),
  action: z.enum(['approved', 'rejected']),
  remark: z.string().max(500).optional(),
})

const listInstancesQuerySchema = z.object({
  approverId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const escalateBodySchema = z.object({
  /** 可选:指定扫描时刻(ISO),缺省=当下 */
  now: z.iso.datetime().optional(),
})

function badReply(
  reply: FastifyReply,
  parsed: { error?: { issues: Array<{ message?: string }> } },
) {
  return reply.status(400).send(error(400, parsed.error?.issues[0]?.message ?? '参数错误'))
}

function approvalErrorReply(reply: FastifyReply, err: unknown) {
  if (err instanceof ApprovalRouteError) {
    return reply.status(400).send(error(400, `${err.code}: ${err.message}`))
  }
  throw err
}

export const hrApprovalRoutes: FastifyPluginAsync = async (fastify) => {
  // 列出审批规则(active,未软删,按假别 + min_days 排序)
  fastify.get('/flows', { preHandler: requirePermission(HR_MANAGE) }, async (_request, reply) => {
    const list = await db
      .select()
      .from(hrApprovalFlow)
      .where(and(eq(hrApprovalFlow.status, 'active'), isNull(hrApprovalFlow.deletedAt)))
      .orderBy(hrApprovalFlow.leaveType, desc(hrApprovalFlow.minDays))
    return reply.send(success({ list }))
  })

  // 新建/更新审批规则(带 id 则更新;不带则新建)
  fastify.post('/flows', { preHandler: requirePermission(HR_MANAGE) }, async (request, reply) => {
    const parsed = flowBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) return badReply(reply, parsed)
    const d = parsed.data
    try {
      if (d.id) {
        // 更新
        const now = new Date()
        const updated = await db
          .update(hrApprovalFlow)
          .set({
            leaveType: d.leaveType,
            minDays: d.minDays,
            maxDays: d.maxDays,
            approverIds: d.approverIds,
            approverProxyId: d.approverProxyId ?? null,
            timeoutHours: d.timeoutHours,
            escalationApproverId: d.escalationApproverId ?? null,
            status: d.status,
            updatedAt: now,
          })
          .where(eq(hrApprovalFlow.id, d.id))
          .returning()
        return reply.send(success({ flow: updated[0] }))
      }
      // 新建
      const inserted = await db
        .insert(hrApprovalFlow)
        .values({
          leaveType: d.leaveType,
          minDays: d.minDays,
          maxDays: d.maxDays,
          approverIds: d.approverIds,
          approverProxyId: d.approverProxyId ?? null,
          timeoutHours: d.timeoutHours,
          escalationApproverId: d.escalationApproverId ?? null,
          status: d.status,
        })
        .returning()
      return reply.status(201).send(success({ flow: inserted[0] }))
    } catch (err) {
      return approvalErrorReply(reply, err)
    }
  })

  // 提交请假单进审批(路由规则→落实例)
  fastify.post(
    '/leave/:id/submit',
    { preHandler: requirePermission(HR_MANAGE) },
    async (request, reply) => {
      const leaveId = (request.params as { id: string }).id
      const parsed = submitBodySchema.safeParse({ leaveRequestId: leaveId })
      if (!parsed.success) return badReply(reply, parsed)
      try {
        const result = await submitApproval(parsed.data)
        return reply.send(success({ instance: result.instance, notified: result.notified }))
      } catch (err) {
        return approvalErrorReply(reply, err)
      }
    },
  )

  // 审批决策(通过/驳回)
  fastify.put(
    '/leave/:id/decide',
    { preHandler: requirePermission(HR_MANAGE) },
    async (request, reply) => {
      const leaveId = (request.params as { id: string }).id
      const parsed = decideBodySchema.safeParse(
        Object.assign({}, request.body as object, { instanceId: leaveId }),
      )
      if (!parsed.success) return badReply(reply, parsed)
      try {
        const result = await decideApproval(parsed.data)
        return reply.send(success({ instance: result.instance, notified: result.notified }))
      } catch (err) {
        return approvalErrorReply(reply, err)
      }
    },
  )

  // 列出某审批人的待处理实例
  fastify.get(
    '/instances',
    { preHandler: requirePermission(HR_MANAGE) },
    async (request, reply) => {
      const q = listInstancesQuerySchema.safeParse(request.query ?? {})
      if (!q.success) return badReply(reply, q)
      const result = await listMyPendingApprovals({
        approverId: q.data.approverId,
        limit: q.data.limit ?? 20,
        offset: q.data.offset ?? 0,
      })
      return reply.send(success({ list: result.list, total: result.total }))
    },
  )

  // 超时升级扫描
  fastify.post(
    '/instances/escalate',
    { preHandler: requirePermission(HR_MANAGE) },
    async (request, reply) => {
      const parsed = escalateBodySchema.safeParse(request.body ?? {})
      if (!parsed.success) return badReply(reply, parsed)
      try {
        const result = await escalateTimedOut({
          now: parsed.data.now ? new Date(parsed.data.now) : undefined,
        })
        return reply.send(success({ escalated: result.escalated }))
      } catch (err) {
        return approvalErrorReply(reply, err)
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
