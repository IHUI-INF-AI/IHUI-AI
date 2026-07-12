import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, or, ilike, asc, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { zhsFaqCategory, zhsFaq } from '@ihui/database'

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  category: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const createCategorySchema = z.object({
  name: z.string().min(1, '分类名不能为空').max(64),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'slug 仅允许小写字母、数字与连字符'),
  sortOrder: z.number().int().optional(),
})

const createFaqSchema = z.object({
  categoryId: z.string().uuid('请指定分类'),
  question: z.string().min(2, '问题至少 2 个字符').max(200),
  answer: z.string().min(2, '答案至少 2 个字符').max(5000),
  keywords: z.array(z.string().max(64)).max(20).optional(),
  pinned: z.boolean().optional(),
  published: z.boolean().optional(),
})

const updateFaqSchema = z.object({
  categoryId: z.string().uuid().optional(),
  question: z.string().min(2).max(200).optional(),
  answer: z.string().min(2).max(5000).optional(),
  keywords: z.array(z.string().max(64)).max(20).optional(),
  pinned: z.boolean().optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

function buildFaqWhere(category?: string, search?: string) {
  const conditions = []
  if (category) conditions.push(eq(zhsFaq.categoryId, category))
  if (search) {
    const kw = `%${search}%`
    conditions.push(
      or(
        ilike(zhsFaq.question, kw),
        ilike(zhsFaq.answer, kw),
        sql`${zhsFaq.keywords}::text ILIKE ${kw}`,
      ),
    )
  }
  return conditions.length > 0 ? and(...conditions) : undefined
}

export const adminFaqRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/categories', async (_request, reply) => {
    const list = await db.select().from(zhsFaqCategory).orderBy(asc(zhsFaqCategory.sortOrder))
    return reply.send(success({ list }))
  })

  server.post('/categories', async (request, reply) => {
    const parsed = createCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select({ id: zhsFaqCategory.id })
      .from(zhsFaqCategory)
      .where(eq(zhsFaqCategory.slug, parsed.data.slug))
      .limit(1)
    if (existing) return reply.status(400).send(error(400, 'slug 已存在'))

    const [category] = await db
      .insert(zhsFaqCategory)
      .values({
        name: parsed.data.name,
        slug: parsed.data.slug,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning()
    return reply.status(201).send(success({ category }))
  })

  server.delete('/categories/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [cat] = await db
      .select({ id: zhsFaqCategory.id })
      .from(zhsFaqCategory)
      .where(eq(zhsFaqCategory.id, parsed.data.id))
      .limit(1)
    if (!cat) return reply.status(404).send(error(404, '分类不存在'))

    const [faq] = await db
      .select({ id: zhsFaq.id })
      .from(zhsFaq)
      .where(eq(zhsFaq.categoryId, parsed.data.id))
      .limit(1)
    if (faq) return reply.status(400).send(error(400, '分类下仍有 FAQ，无法删除'))

    await db.delete(zhsFaqCategory).where(eq(zhsFaqCategory.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  server.get('/', async (request, reply) => {
    const parsed = paginationQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, category, search } = parsed.data
    const offset = (page - 1) * pageSize
    const where = buildFaqWhere(category, search)

    const list = await db
      .select()
      .from(zhsFaq)
      .where(where)
      .orderBy(desc(zhsFaq.pinned), asc(zhsFaq.sortOrder))
      .limit(pageSize)
      .offset(offset)
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(zhsFaq)
      .where(where)
    const total = countRows[0]?.count ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })

  server.post('/', async (request, reply) => {
    const parsed = createFaqSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [cat] = await db
      .select({ id: zhsFaqCategory.id })
      .from(zhsFaqCategory)
      .where(eq(zhsFaqCategory.id, parsed.data.categoryId))
      .limit(1)
    if (!cat) return reply.status(400).send(error(400, '分类不存在'))

    const [faq] = await db
      .insert(zhsFaq)
      .values({
        categoryId: parsed.data.categoryId,
        question: parsed.data.question,
        answer: parsed.data.answer,
        keywords: parsed.data.keywords ?? [],
        pinned: parsed.data.pinned ?? false,
        published: parsed.data.published ?? true,
        sortOrder: 0,
      })
      .returning()
    return reply.status(201).send(success({ faq }))
  })

  server.put('/:id', async (request, reply) => {
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateFaqSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(zhsFaq)
      .where(eq(zhsFaq.id, paramParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, 'FAQ 不存在'))

    if (body.data.categoryId) {
      const [cat] = await db
        .select({ id: zhsFaqCategory.id })
        .from(zhsFaqCategory)
        .where(eq(zhsFaqCategory.id, body.data.categoryId))
        .limit(1)
      if (!cat) return reply.status(400).send(error(400, '分类不存在'))
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.data.categoryId !== undefined) updateData.categoryId = body.data.categoryId
    if (body.data.question !== undefined) updateData.question = body.data.question
    if (body.data.answer !== undefined) updateData.answer = body.data.answer
    if (body.data.keywords !== undefined) updateData.keywords = body.data.keywords
    if (body.data.pinned !== undefined) updateData.pinned = body.data.pinned
    if (body.data.published !== undefined) updateData.published = body.data.published
    if (body.data.sortOrder !== undefined) updateData.sortOrder = body.data.sortOrder

    const [updated] = await db
      .update(zhsFaq)
      .set(updateData)
      .where(eq(zhsFaq.id, paramParsed.data.id))
      .returning()
    return reply.send(success({ faq: updated }))
  })

  server.delete('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select({ id: zhsFaq.id })
      .from(zhsFaq)
      .where(eq(zhsFaq.id, parsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, 'FAQ 不存在'))
    await db.delete(zhsFaq).where(eq(zhsFaq.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
}
