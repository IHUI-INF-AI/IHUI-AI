/**
 * 商业化服务询价路由(AGENTS.md §24 配套,直接产生现金流)。
 *
 * 路径前缀:/api/service-inquiry(server.ts 通过 fastify.register 指定)
 *
 * 端点:
 * - POST /                           公开,提交询价表单(honeypot 防垃圾)
 * - GET  /admin/list                 admin,询价列表(分页/筛选)
 * - GET  /admin/:id                  admin,单条询价详情
 * - PATCH /admin/:id/status          admin,更新询价状态
 *
 * 存储:内存 Map(无数据库表,重启丢失;后续可迁移到 service_inquiries 表)。
 * 邮件通知:占位 console.log(后续接入 mail 服务)。
 *
 * 配套前端:apps/web/app/(main)/services/ServicesContent.tsx + InquiryForm.tsx
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../utils/response.js'

// =============================================================================
// 内存存储(模块级,单进程内有效;后续可迁移到 service_inquiries 表)
// =============================================================================

export type InquiryStatus = 'pending' | 'contacted' | 'quoted' | 'won' | 'lost'

export interface ServiceInquiry {
  id: string
  name: string
  company: string | null
  email: string
  phone: string | null
  serviceType: string
  budget: string
  description: string
  timeline: string
  status: InquiryStatus
  createdAt: string
  updatedAt: string
}

const inquiryStore = new Map<string, ServiceInquiry>()

// =============================================================================
// Zod schemas
// =============================================================================

const SERVICE_TYPES = ['deployment', 'training', 'custom', 'consulting', 'other'] as const
const BUDGETS = ['under5k', '5kTo20k', '20kTo50k', 'over50k'] as const
const TIMELINES = ['urgent', 'month', 'flexible'] as const
const STATUSES = ['pending', 'contacted', 'quoted', 'won', 'lost'] as const

const createInquirySchema = z.object({
  name: z.string().min(1, '请输入姓名').max(50),
  company: z.string().max(100).optional().nullable(),
  email: z.string().min(1, '请输入邮箱').email({ message: '邮箱格式不正确' }),
  phone: z.string().max(30).optional().nullable(),
  serviceType: z.enum(SERVICE_TYPES, { error: '请选择服务类型' }),
  budget: z.enum(BUDGETS, { error: '请选择预算范围' }),
  description: z.string().min(50, '需求描述至少 50 字').max(2000),
  timeline: z.enum(TIMELINES, { error: '请选择期望交付时间' }),
  // honeypot:正常用户不会填此字段,机器人会填;schema 接受任意值,handler 中静默拒绝
  website: z.string().optional(),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(STATUSES).optional(),
  serviceType: z.enum(SERVICE_TYPES).optional(),
})

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const updateStatusSchema = z.object({
  status: z.enum(STATUSES, { error: '无效的状态' }),
})

// =============================================================================
// 路由
// =============================================================================

export const serviceInquiryRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // POST / — 公开,提交询价表单
  // -------------------------------------------------------------------------
  server.post('/', async (request, reply) => {
    const body = parseOrThrow(createInquirySchema, request.body)

    // honeypot:website 字段非空 → 静默拒绝(返回成功避免暴露检测逻辑)
    if (body.website) {
      request.log.warn({ ip: request.ip }, 'honeypot triggered, silent reject')
      return reply.send(success({ id: randomUUID() }))
    }

    const now = new Date().toISOString()
    const inquiry: ServiceInquiry = {
      id: randomUUID(),
      name: body.name,
      company: body.company ?? null,
      email: body.email,
      phone: body.phone ?? null,
      serviceType: body.serviceType,
      budget: body.budget,
      description: body.description,
      timeline: body.timeline,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    inquiryStore.set(inquiry.id, inquiry)

    // 邮件通知占位(后续接入 mail 服务:business@aizhs.top)
    request.log.info(
      {
        id: inquiry.id,
        name: inquiry.name,
        email: inquiry.email,
        serviceType: inquiry.serviceType,
      },
      '[service-inquiry] 新询价提交,待发送邮件通知到 business@aizhs.top',
    )

    return reply.send(success({ id: inquiry.id }))
  })

  // -------------------------------------------------------------------------
  // admin 路由(需鉴权,roleId >= 1)
  // -------------------------------------------------------------------------
  server.register(async (adminServer) => {
    adminServer.addHook('preHandler', requireAdmin)

    // GET /admin/list — 询价列表(分页/筛选)
    adminServer.get('/admin/list', async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize, status, serviceType } = parsed.data
      let items = Array.from(inquiryStore.values())
      if (status) items = items.filter((i) => i.status === status)
      if (serviceType) items = items.filter((i) => i.serviceType === serviceType)
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      const total = items.length
      const start = (page - 1) * pageSize
      const paged = items.slice(start, start + pageSize)

      return reply.send(
        success({
          items: paged,
          total,
          page,
          pageSize,
        }),
      )
    })

    // GET /admin/:id — 单条询价详情
    adminServer.get('/admin/:id', async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const inquiry = inquiryStore.get(id)
      if (!inquiry) {
        return reply.status(404).send(error(404, '询价不存在'))
      }
      return reply.send(success(inquiry))
    })

    // PATCH /admin/:id/status — 更新询价状态
    adminServer.patch('/admin/:id/status', async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const body = parseOrThrow(updateStatusSchema, request.body)
      const inquiry = inquiryStore.get(id)
      if (!inquiry) {
        return reply.status(404).send(error(404, '询价不存在'))
      }
      inquiry.status = body.status
      inquiry.updatedAt = new Date().toISOString()
      inquiryStore.set(id, inquiry)
      return reply.send(success(inquiry))
    })
  })
}

export default serviceInquiryRoutes
