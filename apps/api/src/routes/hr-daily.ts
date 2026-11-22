// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'

import {
  listAttendanceDaily,
  listLeaveBalances,
  submitPunchFix,
  approvePunchFix,
} from '../services/hr-daily.js'
import { requirePermission } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { buildSchema } from '../utils/swagger.js'

/**
 * 人事考勤日结 / 假期额度 / 补卡端点(HR-2 第 1 期,2026-11-11 立)。
 *
 * 权限:全部端点要求 hr:attendance:manage(读也需要 manage —— 日结含全部门员工工时明细,
 * 属敏感人事数据;补卡审批更是直接写考勤记录)。
 * 端点:
 *   GET  /daily                 —— 日结查询(员工 / 部门 / 月份)
 *   GET  /leave-balance         —— 假期额度查询(员工 / 假期类型 / 年度)
 *   POST /punch-fix             —— 补卡申请提交
 *   PUT  /punch-fix/:id/approve —— 补卡审批(通过后回写考勤记录)
 */

const HR_MANAGE = 'hr:attendance:manage'

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────

const dailyQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  /** 月份 YYYY-MM */
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, '月份必须是 YYYY-MM')
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const leaveBalanceQuerySchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.string().min(1).max(30).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

const punchFixBodySchema = z.object({
  employeeId: z.string().uuid(),
  departmentId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须是 YYYY-MM-DD'),
  punchType: z.enum(['check_in', 'check_out']),
  /** 补卡时刻 ISO 8601(缺省=null,审批时再补) */
  punchTime: z.iso.datetime().optional(),
  reason: z.string().min(1, '补卡事由不能为空').max(500),
})

const punchFixApproveBodySchema = z.object({
  /** true=通过(回写考勤),false=驳回 */
  approve: z.boolean(),
  approveRemark: z.string().max(500).optional(),
})

function badReply(
  reply: FastifyReply,
  parsed: { error?: { issues: Array<{ message?: string }> } },
) {
  return reply.status(400).send(error(400, parsed.error?.issues[0]?.message ?? '参数错误'))
}

// ─────────────────────────────────────────────────────────────────────────────
// 路由
// ─────────────────────────────────────────────────────────────────────────────

export const hrDailyRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /daily —— 日结查询
  fastify.get(
    '/daily',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '考勤日结查询',
        description: '按员工/部门/月份查询考勤日结(含工时明细)。属敏感人事数据,需 manage 权限。',
        tags: ['HR'],
        querystring: dailyQuerySchema,
      }),
    },
    async (request, reply) => {
      const parsed = dailyQuerySchema.safeParse(request.query ?? {})
      if (!parsed.success) return badReply(reply, parsed)
      const { list, total } = await listAttendanceDaily({
        employeeId: parsed.data.employeeId,
        departmentId: parsed.data.departmentId,
        month: parsed.data.month,
        limit: parsed.data.limit ?? 50,
        offset: parsed.data.offset ?? 0,
      })
      return reply.send(success({ list, total }))
    },
  )

  // GET /leave-balance —— 假期额度查询
  fastify.get(
    '/leave-balance',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '假期额度查询',
        description: '按员工/假期类型/年度查询假期余额。',
        tags: ['HR'],
        querystring: leaveBalanceQuerySchema,
      }),
    },
    async (request, reply) => {
      const parsed = leaveBalanceQuerySchema.safeParse(request.query ?? {})
      if (!parsed.success) return badReply(reply, parsed)
      const list = await listLeaveBalances({
        employeeId: parsed.data.employeeId,
        leaveType: parsed.data.leaveType,
        year: parsed.data.year,
      })
      return reply.send(success({ list }))
    },
  )

  // POST /punch-fix —— 补卡申请提交
  fastify.post(
    '/punch-fix',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '提交补卡申请',
        description: '员工漏打卡后提交补卡申请,审批通过后回写考勤记录。',
        tags: ['HR'],
        body: punchFixBodySchema,
      }),
    },
    async (request, reply) => {
      const parsed = punchFixBodySchema.safeParse(request.body)
      if (!parsed.success) return badReply(reply, parsed)
      try {
        const fix = await submitPunchFix({
          employeeId: parsed.data.employeeId,
          departmentId: parsed.data.departmentId,
          date: parsed.data.date,
          punchType: parsed.data.punchType,
          punchTime: parsed.data.punchTime ? new Date(parsed.data.punchTime) : undefined,
          reason: parsed.data.reason,
        })
        return reply.status(201).send(success({ punchFix: fix }))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return reply.status(400).send(error(400, msg))
      }
    },
  )

  // PUT /punch-fix/:id/approve —— 补卡审批
  fastify.put(
    '/punch-fix/:id/approve',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '补卡审批',
        description: '审批补卡申请,通过后回写考勤记录。需 manage 权限。',
        tags: ['HR'],
        params: z.object({ id: z.string().uuid().describe('补卡申请 UUID') }),
        body: punchFixApproveBodySchema,
      }),
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return reply.status(400).send(error(400, '无效的补卡申请 id'))
      }
      const parsed = punchFixApproveBodySchema.safeParse(request.body ?? {})
      if (!parsed.success) return badReply(reply, parsed)
      try {
        const approverId = (request as unknown as { user?: { id?: string } }).user?.id ?? ''
        const outcome = await approvePunchFix({
          punchFixId: id,
          approverId,
          approveRemark: parsed.data.approveRemark,
          approve: parsed.data.approve,
        })
        return reply.send(success(outcome))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return reply.status(400).send(error(400, msg))
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
