// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'

import {
  listHrDepartments,
  createHrDepartment,
  listHrEmployees,
  createHrEmployee,
  getHrAttendanceRule,
  upsertHrAttendanceRule,
  hrCheckIn,
  hrCheckOut,
  runHrAbsentAttendance,
  listHrAttendanceRecords,
  getHrAttendanceStats,
  createHrLeave,
  approveHrLeave,
  listHrLeaves,
  DEFAULT_HR_BACKFILL_DAYS,
} from '../services/hr-attendance.js'
import {
  requireAnyPermission,
  requirePermission,
  requireAuth,
} from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { buildSchema } from '../utils/swagger.js'

/**
 * 人事考勤路由(2026-11-09 立,复用 @ihui/attendance-core 判定内核)。
 *
 * 权限两档:
 *   · hr:attendance:view  —— 读面(部门/员工/规则/记录/统计/请假列表)
 *   · hr:attendance:manage —— 写面(建档/规则 upsert/缺勤补录触发/请假审批)
 * 签到/签退/提交请假走 requireAuth(需登录),operatedBy 取登录态 userId。
 * 与教育端(edu-ai-management)的关系:判定四档与缺勤补录纯算法全在 core 单源,本文件不复制判据。
 */

const HR_VIEW = 'hr:attendance:view'
const HR_MANAGE = 'hr:attendance:manage'

const uuidSchema = z.string().uuid()
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须是 YYYY-MM-DD')

const departmentCreateSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
  leaderEmployeeId: z.string().uuid().optional(),
  sortOrder: z.number().int().optional(),
})

const employeeCreateSchema = z.object({
  userId: z.string().uuid().optional(),
  employeeNo: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  departmentId: z.string().uuid(),
  position: z.string().max(100).optional(),
  hireDate: dateSchema.optional(),
  phone: z.string().max(30).optional(),
  idNumber: z.string().max(30).optional(),
})

const ruleUpsertSchema = z.object({
  departmentId: z.string().uuid(),
  lateAfter: z.string().optional(),
  earlyBefore: z.string().optional(),
  absentAfter: z.string().optional(),
  workdays: z.number().int().min(1).max(127).optional(),
  enabled: z.boolean().optional(),
})

const checkInSchema = z.object({
  employeeId: z.string().uuid(),
  departmentId: z.string().uuid(),
  date: dateSchema,
  checkInMethod: z.enum(['self', 'qrcode', 'manual']),
  checkInTimeRaw: z.string().optional(),
  remark: z.string().optional(),
})

const checkOutSchema = z.object({
  employeeId: z.string().uuid(),
  departmentId: z.string().uuid(),
  date: dateSchema,
  checkOutTimeRaw: z.string(),
})

const backfillSchema = z.object({
  backfillDays: z.number().int().min(1).max(30).optional(),
})

const leaveCreateSchema = z.object({
  employeeId: z.string().uuid(),
  departmentId: z.string().uuid(),
  leaveType: z.string().min(1).max(30),
  startDate: dateSchema,
  endDate: dateSchema,
  totalDays: z.number().int().min(0),
  reason: z.string().min(1),
  attachment: z.string().max(500).optional(),
})

const leaveApproveSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  approveRemark: z.string().optional(),
})

// 列表类查询 schema(供 OpenAPI 暴露 query 参数;handler 内仍按宽松 Record 读取以兼容数字 coerce)
const attendanceListQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  date: dateSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

const leaveListQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.string().optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
})

function badReply(
  reply: FastifyReply,
  parsed: { error?: { issues: Array<{ message?: string }> } },
) {
  return reply.status(400).send(error(400, parsed.error?.issues[0]?.message ?? '参数错误'))
}

export const hrAttendanceRoutes: FastifyPluginAsync = async (fastify) => {
  // ── 部门主数据 ──
  fastify.get(
    '/departments',
    {
      preHandler: requireAnyPermission([HR_VIEW, HR_MANAGE]),
      schema: buildSchema({
        summary: '部门列表',
        description: '列出全部人事部门。',
        tags: ['HR'],
      }),
    },
    async (_request, reply) => {
      const list = await listHrDepartments()
      return reply.send(success({ list }))
    },
  )

  fastify.post(
    '/departments',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '新建部门',
        description: '新建人事部门,支持父级、负责人、排序。',
        tags: ['HR'],
        body: departmentCreateSchema,
      }),
    },
    async (request, reply) => {
      const parsed = departmentCreateSchema.safeParse(request.body)
      if (!parsed.success) return badReply(reply, parsed)
      const department = await createHrDepartment(parsed.data)
      return reply.status(201).send(success({ department }))
    },
  )

  // ── 员工主数据 ──
  fastify.get(
    '/employees',
    {
      preHandler: requireAnyPermission([HR_VIEW, HR_MANAGE]),
      schema: buildSchema({
        summary: '员工列表',
        description: '按部门/在职状态筛选员工。',
        tags: ['HR'],
        querystring: z.object({
          departmentId: z.string().uuid().optional(),
          status: z.string().optional(),
        }),
      }),
    },
    async (request, reply) => {
      const q = request.query as { departmentId?: string; status?: string }
      const list = await listHrEmployees({ departmentId: q.departmentId, status: q.status })
      return reply.send(success({ list }))
    },
  )

  fastify.post(
    '/employees',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '新建员工',
        description: '新建员工档案(工号唯一)。重复工号返回 409,关联部门/账户不存在返回 400。',
        tags: ['HR'],
        body: employeeCreateSchema,
      }),
    },
    async (request, reply) => {
      const parsed = employeeCreateSchema.safeParse(request.body)
      if (!parsed.success) return badReply(reply, parsed)
      try {
        const employee = await createHrEmployee(parsed.data)
        return reply.status(201).send(success({ employee }))
      } catch (e) {
        const msg = String((e as { message?: string })?.message ?? '')
        if (msg.includes('uq_hr_emp_no')) return reply.status(409).send(error(409, '工号已存在'))
        if (msg.includes('fk_') || msg.includes('foreign key')) {
          return reply.status(400).send(error(400, '关联的部门或账户不存在'))
        }
        throw e
      }
    },
  )

  // ── 考勤规则 ──
  fastify.get(
    '/attendance/rule',
    {
      preHandler: requireAnyPermission([HR_VIEW, HR_MANAGE]),
      schema: buildSchema({
        summary: '读取考勤规则',
        description:
          '按部门读取考勤规则(迟到/早退/缺勤判定时刻、工作日掩码、是否启用)。departmentId 必填。',
        tags: ['HR'],
        querystring: z.object({ departmentId: z.string().uuid().describe('部门 UUID') }),
      }),
    },
    async (request, reply) => {
      const q = request.query as { departmentId?: string }
      if (!q.departmentId) return reply.status(400).send(error(400, 'departmentId 必填'))
      const rule = await getHrAttendanceRule(q.departmentId)
      return reply.send(success({ rule }))
    },
  )

  fastify.put(
    '/attendance/rule',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '更新考勤规则',
        description:
          '按部门 upsert 考勤规则(工作日掩码 workdays 为位运算 1-127,如周一=1、周二=2)。',
        tags: ['HR'],
        body: ruleUpsertSchema,
      }),
    },
    async (request, reply) => {
      const parsed = ruleUpsertSchema.safeParse(request.body)
      if (!parsed.success) return badReply(reply, parsed)
      try {
        const rule = await upsertHrAttendanceRule(parsed.data)
        return reply.send(success({ rule }))
      } catch (e) {
        if (e instanceof AppError)
          return reply.status(e.statusCode).send(error(e.statusCode, e.message, e.errorCode))
        throw e
      }
    },
  )

  // ── 签到 / 签退(员工自助,需登录)──
  fastify.post(
    '/attendance/check-in',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: '员工签到',
        description:
          '员工自助签到。校验是否在职名册(404)、是否当日或合法历史业务日(400)、是否重复打卡(409)。checkInMethod 枚举 self/qrcode/manual。',
        tags: ['HR'],
        body: checkInSchema,
      }),
    },
    async (request, reply) => {
      const parsed = checkInSchema.safeParse(request.body)
      if (!parsed.success) return badReply(reply, parsed)
      const res = await hrCheckIn({ ...parsed.data, operatedBy: request.userId ?? 'system' })
      if (!res.ok) {
        const map: Record<string, [number, string]> = {
          not_employed: [404, '该员工不在本部门在职名册'],
          duplicate: [409, '今日已有考勤记录'],
          bad_date: [400, '签到日期必须是当日或合法的历史业务日'],
          bad_time: [400, '签到时刻非法'],
          failed: [500, '签到失败'],
        }
        const [code, msg] = map[res.reason] ?? [500, '签到失败']
        return reply.status(code).send(error(code, msg))
      }
      return reply.status(201).send(success({ record: res.record }))
    },
  )

  fastify.post(
    '/attendance/check-out',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: '员工签退',
        description: '员工自助签退。需已有签到记录(404),签退时刻非法返回 400。',
        tags: ['HR'],
        body: checkOutSchema,
      }),
    },
    async (request, reply) => {
      const parsed = checkOutSchema.safeParse(request.body)
      if (!parsed.success) return badReply(reply, parsed)
      const res = await hrCheckOut({ ...parsed.data, operatedBy: request.userId ?? 'system' })
      if (!res.ok) {
        const map: Record<string, [number, string]> = {
          bad_time: [400, '签退时刻非法'],
          no_record: [404, '尚无签到记录,无法签退'],
        }
        const [code, msg] = map[res.reason] ?? [500, '签退失败']
        return reply.status(code).send(error(code, msg))
      }
      return reply.send(success({ record: res.record }))
    },
  )

  // ── 缺勤补录(管理端手动触发,等价于 scheduler-worker 的 cron 一轮)──
  fastify.post(
    '/attendance/backfill',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '缺勤补录',
        description:
          '管理端手动触发缺勤批量补录,等价于定时任务一轮。backfillDays 缺省 3 天(1-30)。',
        tags: ['HR'],
        body: backfillSchema,
      }),
    },
    async (request, reply) => {
      const parsed = backfillSchema.safeParse(request.body)
      if (!parsed.success) return badReply(reply, parsed)
      const result = await runHrAbsentAttendance(new Date(), {
        backfillDays: parsed.data.backfillDays ?? DEFAULT_HR_BACKFILL_DAYS,
      })
      return reply.send(success({ result }))
    },
  )

  // ── 考勤记录列表 ──
  fastify.get(
    '/attendance/records',
    {
      preHandler: requireAnyPermission([HR_VIEW, HR_MANAGE]),
      schema: buildSchema({
        summary: '考勤记录列表',
        description: '按员工/部门/日期区间查询考勤明细记录。',
        tags: ['HR'],
        querystring: attendanceListQuerySchema,
      }),
    },
    async (request, reply) => {
      const q = request.query as Record<string, string | undefined>
      const { list, total } = await listHrAttendanceRecords({
        employeeId: q.employeeId,
        departmentId: q.departmentId,
        date: q.date,
        startDate: q.startDate,
        endDate: q.endDate,
        limit: q.limit ? Number(q.limit) : 50,
        offset: q.offset ? Number(q.offset) : 0,
      })
      return reply.send(success({ list, total }))
    },
  )

  // ── 考勤统计 ──
  fastify.get(
    '/attendance/stats',
    {
      preHandler: requireAnyPermission([HR_VIEW, HR_MANAGE]),
      schema: buildSchema({
        summary: '考勤统计',
        description: '按部门/时间区间汇总考勤统计。',
        tags: ['HR'],
        querystring: z.object({
          departmentId: z.string().uuid().optional(),
          startDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          endDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        }),
      }),
    },
    async (request, reply) => {
      const q = request.query as Record<string, string | undefined>
      const stats = await getHrAttendanceStats({
        departmentId: q.departmentId,
        startDate: q.startDate,
        endDate: q.endDate,
      })
      return reply.send(success({ stats }))
    },
  )

  // ── 请假(路径 A · 单步简化版,仅限临时/小额场景;正式流程走 /api/hr-approval/*)──
  fastify.get(
    '/leave',
    {
      preHandler: requireAnyPermission([HR_VIEW, HR_MANAGE]),
      schema: buildSchema({
        summary: '请假单列表',
        description: '按员工/部门/状态/日期区间查询请假单(路径 A 单步审批版)。',
        tags: ['HR'],
        querystring: leaveListQuerySchema,
      }),
    },
    async (request, reply) => {
      const q = request.query as Record<string, string | undefined>
      const list = await listHrLeaves({
        employeeId: q.employeeId,
        departmentId: q.departmentId,
        status: q.status,
        startDate: q.startDate,
        endDate: q.endDate,
      })
      return reply.send(success({ list }))
    },
  )

  fastify.post(
    '/leave',
    {
      preHandler: requireAuth,
      schema: buildSchema({
        summary: '提交请假单',
        description: '员工自助提交请假单(路径 A 单步审批版;正式多级审批流走 /api/hr-approval/*)。',
        tags: ['HR'],
        body: leaveCreateSchema,
      }),
    },
    async (request, reply) => {
      const parsed = leaveCreateSchema.safeParse(request.body)
      if (!parsed.success) return badReply(reply, parsed)
      const leave = await createHrLeave(parsed.data)
      return reply.status(201).send(success({ leave }))
    },
  )

  fastify.put(
    '/leave/:id/approve',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '请假单审批',
        description:
          '路径 A 单步审批(通过/驳回)。非权威流程,正式请假请走 /api/hr-approval/leave/:id/decide。',
        tags: ['HR'],
        params: z.object({ id: z.string().uuid().describe('请假单 UUID') }),
        body: leaveApproveSchema,
      }),
    },
    async (request, reply) => {
      const idParsed = uuidSchema.safeParse((request.params as { id: string }).id)
      if (!idParsed.success) return reply.status(400).send(error(400, 'leave id 非法'))
      const parsed = leaveApproveSchema.safeParse(request.body)
      if (!parsed.success) return badReply(reply, parsed)
      const updated = await approveHrLeave(
        idParsed.data,
        request.userId ?? 'system',
        parsed.data.decision,
        parsed.data.approveRemark,
      )
      if (!updated) return reply.status(404).send(error(404, '请假单不存在或已审批'))
      return reply.send(success({ leave: updated }))
    },
  )
}
