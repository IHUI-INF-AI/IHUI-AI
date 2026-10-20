// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Google Play 封闭测试招募名单路由。
 *
 * 路径前缀:/api/play-testers(index.ts 通过 fastify.register 指定)
 *
 * 端点:
 * - POST /register       公开,提交测试邮箱(honeypot 防垃圾 + 幂等去重)
 * - GET  /status         公开,按邮箱查询报名状态
 * - GET  /admin/list     admin,报名列表(分页)
 * - GET  /admin/export   admin,导出 CSV(粘贴到 Play Console 电子邮件列表)
 *
 * 存储:play_testers 表(Drizzle ORM,持久化)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { playTesters } from '@ihui/database'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, parseOrThrow } from '../utils/response.js'
import { eq, desc, sql } from 'drizzle-orm'

const registerSchema = z.object({
  email: z.email({ error: '邮箱格式不正确' }),
  locale: z.string().max(10).optional(),
  agreedPrivacy: z.boolean().refine((v) => v === true, '必须同意隐私政策'),
  // honeypot:正常用户不会填此字段,机器人会填;schema 接受任意值,handler 中静默拒绝
  website: z.string().optional(),
})

const statusQuerySchema = z.object({
  email: z.email({ error: '邮箱格式不正确' }),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(200),
})

/** CSV 字段转义:含逗号/双引号/换行时整体加引号,内部双引号翻倍 */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

const playTestersRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // POST /register — 公开,提交测试报名
  // -------------------------------------------------------------------------
  server.post('/register', async (request, reply) => {
    const body = parseOrThrow(registerSchema, request.body)

    // honeypot:website 字段非空 → 静默拒绝(返回成功避免暴露检测逻辑)
    if (body.website) {
      request.log.warn({ ip: request.ip }, 'honeypot triggered, silent reject')
      return reply.send(success({ registered: true, deduplicated: true }))
    }

    const rows = await db
      .insert(playTesters)
      .values({
        email: body.email,
        locale: body.locale ?? 'zh-CN',
        agreedPrivacy: true,
      })
      .onConflictDoNothing({ target: playTesters.email })
      .returning()

    // rows 为空说明 email 已存在(唯一索引冲突被忽略)
    return reply.send(success({ registered: true, deduplicated: rows.length === 0 }))
  })

  // -------------------------------------------------------------------------
  // GET /status — 公开,按邮箱查询报名状态
  // -------------------------------------------------------------------------
  server.get('/status', async (request, reply) => {
    const { email } = parseOrThrow(statusQuerySchema, request.query)

    const [row] = await db
      .select({ status: playTesters.status })
      .from(playTesters)
      .where(eq(playTesters.email, email))
      .limit(1)

    return reply.send(success({ registered: Boolean(row), status: row?.status ?? null }))
  })

  // -------------------------------------------------------------------------
  // admin 路由(需鉴权,roleId >= 1)
  // -------------------------------------------------------------------------
  server.register(async (adminServer) => {
    adminServer.addHook('preHandler', requireAdmin)

    // GET /admin/list — 报名列表(分页,按创建时间倒序)
    adminServer.get('/admin/list', async (request, reply) => {
      const { page, pageSize } = parseOrThrow(listQuerySchema, request.query)

      const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(playTesters)
      const total = Number(countResult?.count ?? 0)

      const items = await db
        .select()
        .from(playTesters)
        .orderBy(desc(playTesters.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)

      return reply.send(success({ items, total, page, pageSize }))
    })

    // GET /admin/export — 导出 CSV(Play Console 电子邮件列表可直接粘贴)
    adminServer.get('/admin/export', async (_request, reply) => {
      const rows = await db.select().from(playTesters).orderBy(desc(playTesters.createdAt))

      const header = 'email,locale,status,created_at'
      const lines = rows.map((row) =>
        [row.email, row.locale, row.status, row.createdAt.toISOString()].map(csvCell).join(','),
      )
      const csv = [header, ...lines].join('\n')

      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header('Content-Disposition', 'attachment; filename="play-testers.csv"')
      return reply.send(csv)
    })
  })
}

export default playTestersRoutes

