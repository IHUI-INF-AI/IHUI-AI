// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 管理后台发票抬头路由（4 个端点）。
 * 替代 frontend-stub-admin-routes.ts 中的 PUT /admin/invoices/titles 空桩。
 * 复用 packages/database schema: eduInvoiceTitles。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, ilike, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, parseOrThrow, emptyToUndefined } from '../utils/response.js'
import { eduInvoiceTitles } from '@ihui/database'
import { isUuidString } from '../utils/uuid.js'

const idParamSchema = z.object({ id: z.string().min(1) })

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  // edu_invoice_titles.user_id 是 uuid 列：本 schema 的 userId 会进 eq(eduInvoiceTitles.userId, …)，
  // 非 uuid 串让 Postgres 抛 22P02 ⇒ 500。与下面 createBodySchema.userId 同一列、同一判据
  // (姊妹面：上一轮只收了写入侧的 create/update，此处是读侧筛选位)。
  userId: z.transform(emptyToUndefined).pipe(z.uuid({ error: 'userId 格式不正确' }).optional()),
  titleType: z.transform(emptyToUndefined).pipe(z.enum(['personal', 'company']).optional()),
  keyword: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
})

const createBodySchema = z.object({
  // edu_invoice_titles.user_id 是 uuid 列：非 uuid 串会在 DB 层抛类型转换错误(500)。
  // 同 schema 其余字段均已校验，此处曾只校验 min(1) 而漏掉格式。
  userId: z.uuid(),
  titleType: z.enum(['personal', 'company']).default('personal'),
  title: z.string().min(1).max(200),
  taxNo: z.string().max(50).optional(),
  bank: z.string().max(200).optional(),
  bankAccount: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
})

const updateBodySchema = z.object({
  userId: z.string().min(1).optional(),
  titleType: z.enum(['personal', 'company']).optional(),
  title: z.string().min(1).max(200).optional(),
  taxNo: z.string().max(50).optional(),
  bank: z.string().max(200).optional(),
  bankAccount: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
})

export const adminInvoicesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 1. 列表查询（支持 userId / titleType 过滤、keyword 模糊搜索、分页）
  server.get('/invoices/titles', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, userId, titleType, keyword } = q.data
    const conds: (SQL | undefined)[] = []
    if (userId) conds.push(eq(eduInvoiceTitles.userId, userId))
    if (titleType) conds.push(eq(eduInvoiceTitles.titleType, titleType))
    if (keyword) conds.push(ilike(eduInvoiceTitles.title, `%${keyword}%`))
    const where = conds.length ? and(...conds) : undefined
    const rows = await db
      .select()
      .from(eduInvoiceTitles)
      .where(where)
      .orderBy(desc(eduInvoiceTitles.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(eduInvoiceTitles)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list: rows, total, page, pageSize }))
  })

  // 详情查询
  server.get('/invoices/titles/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    if (!isUuidString(id)) return reply.status(404).send(error(404, '发票抬头不存在'))
    const [row] = await db
      .select()
      .from(eduInvoiceTitles)
      .where(eq(eduInvoiceTitles.id, id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '发票抬头不存在'))
    return reply.send(success(row))
  })

  // 2. 创建发票抬头
  server.post('/invoices/titles', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseOrThrow(createBodySchema, request.body)
    const [row] = await db
      .insert(eduInvoiceTitles)
      .values({
        userId: body.userId,
        titleType: body.titleType,
        title: body.title,
        taxNo: body.taxNo,
        bank: body.bank,
        bankAccount: body.bankAccount,
        address: body.address,
        phone: body.phone,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(row))
  })

  // 3. 更新发票抬头
  server.put('/invoices/titles/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    if (!isUuidString(id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    const body = parseOrThrow(updateBodySchema, request.body)
    const [row] = await db
      .update(eduInvoiceTitles)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(eduInvoiceTitles.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '发票抬头不存在'))
    return reply.send(success(row))
  })

  // 4. 删除发票抬头
  server.delete('/invoices/titles/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    const [row] = await db.delete(eduInvoiceTitles).where(eq(eduInvoiceTitles.id, id)).returning()
    if (!row) return reply.status(404).send(error(404, '发票抬头不存在'))
    return reply.send(success({ id, deleted: Boolean(row) }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
