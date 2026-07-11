import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// FAQ 管理路由 — 迁移自旧架构 api/admin/admin-faq.ts
// 挂载前缀：/api/admin/faq（由 server.ts 统一注册）
// 管理员维护客服 FAQ 分类与条目
// =============================================================================

const ADMIN_ROLE_ID = 1

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

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'))
    return false
  }
  return true
}

// =============================================================================
// 数据库表初始化 & 查询辅助
// =============================================================================

const CATEGORY_COLS = sql`
  id, name, slug, sort_order AS "sortOrder", created_at AS "createdAt"
`

const FAQ_COLS = sql`
  id, category_id AS "categoryId", question, answer, keywords,
  pinned, published, sort_order AS "sortOrder",
  created_at AS "createdAt", updated_at AS "updatedAt"
`

async function ensureFaqTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zhs_faq_category (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(64) NOT NULL,
      slug varchar(64) NOT NULL UNIQUE,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zhs_faq (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id uuid NOT NULL,
      question varchar(200) NOT NULL,
      answer text NOT NULL,
      keywords jsonb NOT NULL DEFAULT '[]',
      pinned boolean NOT NULL DEFAULT false,
      published boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

function buildFaqWhereClause(category?: string, search?: string): SQL {
  const conditions: SQL[] = []
  if (category) conditions.push(sql`category_id = ${category}`)
  if (search) {
    const kw = `%${search}%`
    conditions.push(sql`(question ILIKE ${kw} OR answer ILIKE ${kw} OR keywords::text ILIKE ${kw})`)
  }
  return conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``
}

// =============================================================================
// 路由
// =============================================================================

export const adminFaqRoutes: FastifyPluginAsync = async (server) => {
  await ensureFaqTables()

  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return
  })

  // ===== 分类管理 =====

  // GET /categories - 分类列表
  server.get('/categories', async (_request, reply) => {
    const rows = await db.execute(sql`
      SELECT ${CATEGORY_COLS} FROM zhs_faq_category
      ORDER BY sort_order ASC
    `)
    return reply.send(success({ list: rows as Record<string, unknown>[] }))
  })

  // POST /categories - 创建分类
  server.post('/categories', async (request, reply) => {
    const parsed = createCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const slugRows = await db.execute(sql`
      SELECT id FROM zhs_faq_category WHERE slug = ${parsed.data.slug} LIMIT 1
    `)
    if (slugRows[0]) return reply.status(400).send(error(400, 'slug 已存在'))

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const sortOrder = parsed.data.sortOrder ?? 0
    await db.execute(sql`
      INSERT INTO zhs_faq_category (id, name, slug, sort_order, created_at)
      VALUES (${id}, ${parsed.data.name}, ${parsed.data.slug}, ${sortOrder}, ${now})
    `)
    const category = {
      id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      sortOrder,
      createdAt: now,
    }
    return reply.status(201).send(success({ category }))
  })

  // DELETE /categories/:id - 删除分类（需分类下无 FAQ）
  server.delete('/categories/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const catRows = await db.execute(sql`
      SELECT id FROM zhs_faq_category WHERE id = ${parsed.data.id}
    `)
    if (!catRows[0]) return reply.status(404).send(error(404, '分类不存在'))

    const faqRows = await db.execute(sql`
      SELECT id FROM zhs_faq WHERE category_id = ${parsed.data.id} LIMIT 1
    `)
    if (faqRows[0]) return reply.status(400).send(error(400, '分类下仍有 FAQ，无法删除'))

    await db.execute(sql`DELETE FROM zhs_faq_category WHERE id = ${parsed.data.id}`)
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // ===== FAQ 条目管理 =====

  // GET / - FAQ 列表（支持分类/关键词筛选）
  server.get('/', async (request, reply) => {
    const parsed = paginationQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, category, search } = parsed.data
    const offset = (page - 1) * pageSize
    const where = buildFaqWhereClause(category, search)

    const listRows = await db.execute(sql`
      SELECT ${FAQ_COLS} FROM zhs_faq ${where}
      ORDER BY pinned DESC, sort_order ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `)
    const countRows = await db.execute(sql`
      SELECT count(*)::int AS count FROM zhs_faq ${where}
    `)
    const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
    return reply.send(
      success({ list: listRows as Record<string, unknown>[], total, page, pageSize }),
    )
  })

  // POST / - 创建 FAQ
  server.post('/', async (request, reply) => {
    const parsed = createFaqSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const catRows = await db.execute(sql`
      SELECT id FROM zhs_faq_category WHERE id = ${parsed.data.categoryId}
    `)
    if (!catRows[0]) return reply.status(400).send(error(400, '分类不存在'))

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const keywords = parsed.data.keywords ?? []
    const pinned = parsed.data.pinned ?? false
    const published = parsed.data.published ?? true
    const sortOrder = 0
    await db.execute(sql`
      INSERT INTO zhs_faq (id, category_id, question, answer, keywords, pinned, published, sort_order, created_at, updated_at)
      VALUES (${id}, ${parsed.data.categoryId}, ${parsed.data.question}, ${parsed.data.answer},
              ${JSON.stringify(keywords)}::jsonb, ${pinned}, ${published}, ${sortOrder}, ${now}, ${now})
    `)
    const item = {
      id,
      categoryId: parsed.data.categoryId,
      question: parsed.data.question,
      answer: parsed.data.answer,
      keywords,
      pinned,
      published,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    }
    return reply.status(201).send(success({ faq: item }))
  })

  // PUT /:id - 更新 FAQ
  server.put('/:id', async (request, reply) => {
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateFaqSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT ${FAQ_COLS} FROM zhs_faq WHERE id = ${paramParsed.data.id}
    `)
    const existing = rows[0] as Record<string, unknown> | undefined
    if (!existing) return reply.status(404).send(error(404, 'FAQ 不存在'))

    if (body.data.categoryId) {
      const catRows = await db.execute(sql`
        SELECT id FROM zhs_faq_category WHERE id = ${body.data.categoryId}
      `)
      if (!catRows[0]) return reply.status(400).send(error(400, '分类不存在'))
    }

    const now = new Date().toISOString()
    const sets: SQL[] = [sql`updated_at = ${now}`]
    if (body.data.categoryId !== undefined) sets.push(sql`category_id = ${body.data.categoryId}`)
    if (body.data.question !== undefined) sets.push(sql`question = ${body.data.question}`)
    if (body.data.answer !== undefined) sets.push(sql`answer = ${body.data.answer}`)
    if (body.data.keywords !== undefined)
      sets.push(sql`keywords = ${JSON.stringify(body.data.keywords)}::jsonb`)
    if (body.data.pinned !== undefined) sets.push(sql`pinned = ${body.data.pinned}`)
    if (body.data.published !== undefined) sets.push(sql`published = ${body.data.published}`)
    if (body.data.sortOrder !== undefined) sets.push(sql`sort_order = ${body.data.sortOrder}`)

    await db.execute(sql`
      UPDATE zhs_faq SET ${sql.join(sets, sql`, `)} WHERE id = ${paramParsed.data.id}
    `)
    const updated = { ...existing, ...body.data, updatedAt: now }
    return reply.send(success({ faq: updated }))
  })

  // DELETE /:id - 删除 FAQ
  server.delete('/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db.execute(sql`
      SELECT id FROM zhs_faq WHERE id = ${parsed.data.id}
    `)
    if (!rows[0]) return reply.status(404).send(error(404, 'FAQ 不存在'))
    await db.execute(sql`DELETE FROM zhs_faq WHERE id = ${parsed.data.id}`)
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
}
