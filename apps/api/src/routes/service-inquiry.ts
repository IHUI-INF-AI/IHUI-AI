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
 * 存储:service_inquiries 表(Drizzle ORM,持久化)。
 * 邮件通知:sendEmail 异步发送到 business@aizhs.top。
 *
 * 配套前端:apps/web/app/(main)/services/ServicesContent.tsx + InquiryForm.tsx
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { serviceInquiries } from '@ihui/database'
import { db } from '../db/index.js'
import { sendEmail } from '../services/email-service.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../utils/response.js'
import { eq, and, desc, sql } from 'drizzle-orm'

// =============================================================================
// 类型定义
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
// 数据库辅助函数
// =============================================================================

/** 将数据库行转换为 ServiceInquiry 响应对象 */
function rowToInquiry(row: {
  id: string
  name: string
  company: string | null
  email: string
  phone: string | null
  serviceType: string
  budget: string
  description: string
  timeline: string
  status: string
  createdAt: Date
  updatedAt: Date
}): ServiceInquiry {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    serviceType: row.serviceType,
    budget: row.budget,
    description: row.description,
    timeline: row.timeline,
    status: row.status as InquiryStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

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

    const [row] = await db
      .insert(serviceInquiries)
      .values({
        name: body.name,
        company: body.company ?? null,
        email: body.email,
        phone: body.phone ?? null,
        serviceType: body.serviceType,
        budget: body.budget,
        description: body.description,
        timeline: body.timeline,
      })
      .returning()

    // row 应始终存在(returning 带新插入行),加守卫满足类型系统
    const inquiry = rowToInquiry(row!)

    // 异步发送邮件通知(不阻塞响应)
    sendEmail({
      to: 'business@aizhs.top',
      subject: `新询价通知 - ${inquiry.serviceType}`,
      html: `
        <h1>新询价提交</h1>
        <p>姓名: ${inquiry.name}</p>
        <p>邮箱: ${inquiry.email}</p>
        <p>服务类型: ${inquiry.serviceType}</p>
        <p>需求描述: ${inquiry.description}</p>
      `,
      scene: 'notification',
    }).catch((err) => {
      request.log.error({ err: (err as Error).message }, '[service-inquiry] 邮件发送失败')
    })

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

      // 构建筛选条件
      const filters: ReturnType<typeof eq>[] = []
      if (status) filters.push(eq(serviceInquiries.status, status))
      if (serviceType) filters.push(eq(serviceInquiries.serviceType, serviceType))
      const where = filters.length > 0 ? and(...filters) : undefined

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(serviceInquiries)
        .where(where)

      const total = Number(countResult?.count ?? 0)
      const rows = await db
        .select()
        .from(serviceInquiries)
        .where(where)
        .orderBy(desc(serviceInquiries.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)

      return reply.send(
        success({
          items: rows.map(rowToInquiry),
          total,
          page,
          pageSize,
        }),
      )
    })

    // GET /admin/:id — 单条询价详情
    adminServer.get('/admin/:id', async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const [row] = await db
        .select()
        .from(serviceInquiries)
        .where(eq(serviceInquiries.id, id))
        .limit(1)

      if (!row) {
        return reply.status(404).send(error(404, '询价不存在'))
      }
      return reply.send(success(rowToInquiry(row)))
    })

    // PATCH /admin/:id/status — 更新询价状态
    adminServer.patch('/admin/:id/status', async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const body = parseOrThrow(updateStatusSchema, request.body)

      const [row] = await db
        .update(serviceInquiries)
        .set({ status: body.status, updatedAt: sql`now()` })
        .where(eq(serviceInquiries.id, id))
        .returning()

      if (!row) {
        return reply.status(404).send(error(404, '询价不存在'))
      }
      return reply.send(success(rowToInquiry(row)))
    })
  })
}

export default serviceInquiryRoutes
