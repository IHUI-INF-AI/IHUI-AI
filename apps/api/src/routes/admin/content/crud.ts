/**
 * AdminContent 统一 CRUD（补 desktop AdminContent 缺口）。
 *
 * 端点(需 admin 鉴权)：
 *   GET    /api/admin/content/:type          列表
 *   GET    /api/admin/content/:type/:id      详情
 *   POST   /api/admin/content/:type          创建
 *   PATCH  /api/admin/content/:type/:id      部分更新
 *   DELETE /api/admin/content/:type/:id      删除
 *
 * 支持的 :type 集合：
 *   - announcement       (announcements 表)
 *   - help-article       (help_articles 表)
 *   - help-category      (help_categories 表)
 *   - doc                (docs 表,category=guide/api/development/faq)
 *   - article            (news_articles 表)
 *   - advertise          (carousels 表)
 *   - about-us           (docs 表,category=about-us)
 *   - contact            (docs 表,category=contact)
 *   - recommendation     (system_configs 表,category=recommendation)
 *   - mobile-adapter     (system_configs 表,category=mobile-adapter)
 *
 * 设计取舍：body 字段做最小白名单校验,任何额外字段被忽略（最小化代码、零冗余）。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { eq, sql, desc } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { requireAdmin } from '../../../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../../../utils/response.js'
import { AppError } from '../../../errors/AppError.js'
import {
  announcements,
  helpArticles,
  helpCategories,
  docs,
  newsArticles,
  carousels,
  systemConfigs,
} from '@ihui/database'

const TYPE_KEYS = [
  'announcement',
  'help-article',
  'help-category',
  'doc',
  'article',
  'advertise',
  'about-us',
  'contact',
  'recommendation',
  'mobile-adapter',
] as const

type ContentType = (typeof TYPE_KEYS)[number]

const typeParamSchema = z.object({ type: z.enum(TYPE_KEYS) })
const idParamSchema = z.object({ type: z.enum(TYPE_KEYS), id: z.string().min(1) })
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k]
  }
  return out
}

/** 兼容 Drizzle insert/update 的对象类型转换（占位,目前用 as never 即可） */

function validate<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input)
  if (!r.success) {
    throw new AppError(r.error.issues[0]?.message ?? '参数错误', 400, 'VALIDATION_FAILED')
  }
  return r.data
}

export const adminContentCrudRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /api/admin/content/:type
  server.get<{ Params: { type: string } }>('/:type', async (request, reply) => {
    const { type } = validate(typeParamSchema, request.params)
    const { page, pageSize, search } = validate(pageSchema, request.query)
    const offset = (page - 1) * pageSize
    const { rows, total } = await listByType(type, pageSize, offset, search)
    return reply.send(success({ list: rows, total, page, pageSize, type }))
  })

  // GET /api/admin/content/:type/:id
  server.get<{ Params: { type: string; id: string } }>('/:type/:id', async (request, reply) => {
    const { type, id } = validate(idParamSchema, request.params)
    const row = await getByType(type, id)
    if (!row) return reply.status(404).send(error(404, '内容不存在'))
    return reply.send(success({ item: row, type }))
  })

  // POST /api/admin/content/:type
  server.post<{ Params: { type: string } }>('/:type', async (request, reply) => {
    const { type } = validate(typeParamSchema, request.params)
    const body = (request.body ?? {}) as Record<string, unknown>
    const row = await createByType(type, body)
    return reply.status(201).send(success({ item: row, type }))
  })

  // PATCH /api/admin/content/:type/:id
  server.patch<{ Params: { type: string; id: string } }>(
    '/:type/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { type, id } = validate(idParamSchema, request.params)
      const body = (request.body ?? {}) as Record<string, unknown>
      const row = await updateByType(type, id, body)
      if (!row) return reply.status(404).send(error(404, '内容不存在'))
      return reply.send(success({ item: row, type }))
    },
  )

  // DELETE /api/admin/content/:type/:id
  server.delete<{ Params: { type: string; id: string } }>(
    '/:type/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { type, id } = validate(idParamSchema, request.params)
      const deleted = await deleteByType(type, id)
      if (!deleted) return reply.status(404).send(error(404, '内容不存在'))
      return reply.send(success({ id, deleted: true, type }))
    },
  )
}

// ============== list ==============

async function listByType(
  type: ContentType,
  pageSize: number,
  offset: number,
  search?: string,
): Promise<{ rows: unknown[]; total: number }> {
  switch (type) {
    case 'announcement': {
      const where = search ? sql`title ILIKE ${'%' + search + '%'}` : undefined
      const rows = await db
        .select()
        .from(announcements)
        .where(where)
        .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
        .limit(pageSize)
        .offset(offset)
      const total =
        (await db.select({ c: sql<number>`count(*)::int` }).from(announcements).where(where))[0]
          ?.c ?? 0
      return { rows, total }
    }
    case 'help-article': {
      const where = search ? sql`title ILIKE ${'%' + search + '%'}` : undefined
      const rows = await db
        .select()
        .from(helpArticles)
        .where(where)
        .orderBy(helpArticles.sortOrder, desc(helpArticles.createdAt))
        .limit(pageSize)
        .offset(offset)
      const total =
        (await db.select({ c: sql<number>`count(*)::int` }).from(helpArticles).where(where))[0]
          ?.c ?? 0
      return { rows, total }
    }
    case 'help-category': {
      const where = search ? sql`name ILIKE ${'%' + search + '%'}` : undefined
      const rows = await db
        .select()
        .from(helpCategories)
        .where(where)
        .orderBy(helpCategories.sortOrder)
        .limit(pageSize)
        .offset(offset)
      const total =
        (await db.select({ c: sql<number>`count(*)::int` }).from(helpCategories).where(where))[0]
          ?.c ?? 0
      return { rows, total }
    }
    case 'doc': {
      const where = search ? sql`title ILIKE ${'%' + search + '%'}` : undefined
      const rows = await db
        .select()
        .from(docs)
        .where(where)
        .orderBy(desc(docs.createdAt))
        .limit(pageSize)
        .offset(offset)
      const total =
        (await db.select({ c: sql<number>`count(*)::int` }).from(docs).where(where))[0]?.c ?? 0
      return { rows, total }
    }
    case 'article': {
      const where = search ? sql`title ILIKE ${'%' + search + '%'}` : undefined
      const rows = await db
        .select()
        .from(newsArticles)
        .where(where)
        .orderBy(desc(newsArticles.createdAt))
        .limit(pageSize)
        .offset(offset)
      const total =
        (await db.select({ c: sql<number>`count(*)::int` }).from(newsArticles).where(where))[0]
          ?.c ?? 0
      return { rows, total }
    }
    case 'advertise': {
      const where = search ? sql`title ILIKE ${'%' + search + '%'}` : undefined
      const rows = await db
        .select()
        .from(carousels)
        .where(where)
        .orderBy(carousels.sort, desc(carousels.createdAt))
        .limit(pageSize)
        .offset(offset)
      const total =
        (await db.select({ c: sql<number>`count(*)::int` }).from(carousels).where(where))[0]
          ?.c ?? 0
      return { rows, total }
    }
    case 'about-us':
    case 'contact': {
      const category = type === 'about-us' ? 'about-us' : 'contact'
      const where = sql`category = ${category} ${search ? sql`AND title ILIKE ${'%' + search + '%'}` : sql``}`
      const rows = await db
        .select()
        .from(docs)
        .where(where)
        .orderBy(desc(docs.createdAt))
        .limit(pageSize)
        .offset(offset)
      const total =
        (await db.select({ c: sql<number>`count(*)::int` }).from(docs).where(where))[0]?.c ?? 0
      return { rows, total }
    }
    case 'recommendation':
    case 'mobile-adapter': {
      const category = type
      const where = sql`category = ${category} ${search ? sql`AND key ILIKE ${'%' + search + '%'}` : sql``}`
      const rows = await db
        .select()
        .from(systemConfigs)
        .where(where)
        .orderBy(desc(systemConfigs.createdAt))
        .limit(pageSize)
        .offset(offset)
      const total =
        (await db.select({ c: sql<number>`count(*)::int` }).from(systemConfigs).where(where))[0]
          ?.c ?? 0
      return { rows, total }
    }
  }
}

// ============== get ==============

async function getByType(type: ContentType, id: string): Promise<unknown | null> {
  switch (type) {
    case 'announcement': {
      const r = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1)
      return r[0] ?? null
    }
    case 'help-article': {
      const r = await db.select().from(helpArticles).where(eq(helpArticles.id, id)).limit(1)
      return r[0] ?? null
    }
    case 'help-category': {
      const r = await db.select().from(helpCategories).where(eq(helpCategories.id, id)).limit(1)
      return r[0] ?? null
    }
    case 'doc': {
      const r = await db.select().from(docs).where(eq(docs.id, id)).limit(1)
      return r[0] ?? null
    }
    case 'article': {
      const r = await db.select().from(newsArticles).where(eq(newsArticles.id, id)).limit(1)
      return r[0] ?? null
    }
    case 'advertise': {
      const r = await db.select().from(carousels).where(eq(carousels.id, id)).limit(1)
      return r[0] ?? null
    }
    case 'about-us':
    case 'contact': {
      const category = type === 'about-us' ? 'about-us' : 'contact'
      const r = await db
        .select()
        .from(docs)
        .where(sql`id = ${id} AND category = ${category}`)
        .limit(1)
      return r[0] ?? null
    }
    case 'recommendation':
    case 'mobile-adapter': {
      const category = type
      const r = await db
        .select()
        .from(systemConfigs)
        .where(sql`id = ${id} AND category = ${category}`)
        .limit(1)
      return r[0] ?? null
    }
  }
}

// ============== create ==============

async function createByType(type: ContentType, body: Record<string, unknown>): Promise<unknown> {
  switch (type) {
    case 'announcement': {
      const data = pick(body, ['title', 'content', 'type', 'isPinned', 'isPublished', 'publishedAt', 'expiresAt', 'createdBy'])
      if (!data.title || !data.content) {
        throw new AppError('title/content 必填', 400, 'VALIDATION_FAILED')
      }
      const [row] = await db.insert(announcements).values(data as never).returning()
      return row
    }
    case 'help-article': {
      const data = pick(body, ['title', 'category', 'content', 'sortOrder', 'isPublished'])
      const slug = (body.slug as string) || `help-${randomUUID()}`
      if (!data.title || !data.content) {
        throw new AppError('title/content 必填', 400, 'VALIDATION_FAILED')
      }
      const [row] = await db.insert(helpArticles).values({ ...data, slug } as never).returning()
      return row
    }
    case 'help-category': {
      const data = pick(body, ['name', 'slug', 'description', 'icon', 'sortOrder'])
      if (!data.name || !data.slug) {
        throw new AppError('name/slug 必填', 400, 'VALIDATION_FAILED')
      }
      const [row] = await db.insert(helpCategories).values(data as never).returning()
      return row
    }
    case 'doc': {
      const data = pick(body, ['title', 'category', 'content', 'authorId', 'status', 'sortOrder'])
      const slug = (body.slug as string) || `doc-${randomUUID()}`
      if (!data.title || !data.content) {
        throw new AppError('title/content 必填', 400, 'VALIDATION_FAILED')
      }
      const [row] = await db.insert(docs).values({ ...data, slug } as never).returning()
      return row
    }
    case 'article': {
      const data = pick(body, [
        'title',
        'summary',
        'content',
        'categoryId',
        'coverImage',
        'authorId',
        'authorName',
        'isPublished',
        'isPinned',
        'sort',
        'status',
        'publishedAt',
      ])
      if (!data.title || !data.content) {
        throw new AppError('title/content 必填', 400, 'VALIDATION_FAILED')
      }
      const [row] = await db.insert(newsArticles).values(data as never).returning()
      return row
    }
    case 'advertise': {
      const data = pick(body, [
        'title',
        'position',
        'imageUrl',
        'linkUrl',
        'description',
        'sort',
        'status',
        'startAt',
        'endAt',
      ])
      if (!data.position || !data.imageUrl) {
        throw new AppError('position/imageUrl 必填', 400, 'VALIDATION_FAILED')
      }
      const [row] = await db.insert(carousels).values(data as never).returning()
      return row
    }
    case 'about-us': {
      const data = pick(body, ['title', 'content'])
      const title = (data.title as string) || ((body.network as string) ?? '')
      const content =
        (data.content as string) ||
        JSON.stringify({
          phone: body.phone ?? '',
          socialMedia: body.socialMedia ?? '',
          experience: body.experience ?? '',
          description: body.description ?? '',
        })
      const [row] = await db
        .insert(docs)
        .values({ category: 'about-us', title, content, slug: `about-us-${randomUUID()}` })
        .returning()
      return row
    }
    case 'contact': {
      const data = pick(body, ['title', 'content'])
      const content =
        (data.content as string) ||
        JSON.stringify({
          introduction: body.introduction ?? '',
          corporateCulture: body.corporateCulture ?? '',
        })
      const title = (data.title as string) || 'contact'
      const [row] = await db
        .insert(docs)
        .values({ category: 'contact', title, content, slug: `contact-${randomUUID()}` })
        .returning()
      return row
    }
    case 'recommendation':
    case 'mobile-adapter': {
      const data = pick(body, ['key', 'value', 'type', 'description', 'isPublic'])
      if (!data.key) {
        throw new AppError('key 必填', 400, 'VALIDATION_FAILED')
      }
      const [row] = await db
        .insert(systemConfigs)
        .values({ category: type, ...data } as never)
        .returning()
      return row
    }
  }
}

// ============== update ==============

async function updateByType(
  type: ContentType,
  id: string,
  body: Record<string, unknown>,
): Promise<unknown | null> {
  const now = new Date()
  switch (type) {
    case 'announcement': {
      const data = pick(body, ['title', 'content', 'type', 'isPinned', 'isPublished', 'publishedAt', 'expiresAt'])
      const [row] = await db
        .update(announcements)
        .set({ ...data, updatedAt: now } as never)
        .where(eq(announcements.id, id))
        .returning()
      return row ?? null
    }
    case 'help-article': {
      const data = pick(body, ['title', 'category', 'content', 'sortOrder', 'isPublished', 'slug'])
      const [row] = await db
        .update(helpArticles)
        .set({ ...data, updatedAt: now } as never)
        .where(eq(helpArticles.id, id))
        .returning()
      return row ?? null
    }
    case 'help-category': {
      const data = pick(body, ['name', 'slug', 'description', 'icon', 'sortOrder'])
      const [row] = await db
        .update(helpCategories)
        .set(data as never)
        .where(eq(helpCategories.id, id))
        .returning()
      return row ?? null
    }
    case 'doc': {
      const data = pick(body, ['title', 'category', 'content', 'authorId', 'status', 'sortOrder', 'slug'])
      const [row] = await db
        .update(docs)
        .set({ ...data, updatedAt: now } as never)
        .where(eq(docs.id, id))
        .returning()
      return row ?? null
    }
    case 'article': {
      const data = pick(body, [
        'title',
        'summary',
        'content',
        'categoryId',
        'coverImage',
        'authorId',
        'authorName',
        'isPublished',
        'isPinned',
        'sort',
        'status',
        'publishedAt',
      ])
      const [row] = await db
        .update(newsArticles)
        .set({ ...data, updatedAt: now } as never)
        .where(eq(newsArticles.id, id))
        .returning()
      return row ?? null
    }
    case 'advertise': {
      const data = pick(body, [
        'title',
        'position',
        'imageUrl',
        'linkUrl',
        'description',
        'sort',
        'status',
        'startAt',
        'endAt',
      ])
      const [row] = await db
        .update(carousels)
        .set({ ...data, updatedAt: now } as never)
        .where(eq(carousels.id, id))
        .returning()
      return row ?? null
    }
    case 'about-us':
    case 'contact': {
      const category = type === 'about-us' ? 'about-us' : 'contact'
      const data = pick(body, ['title', 'content'])
      const [row] = await db
        .update(docs)
        .set({ ...data, updatedAt: now } as never)
        .where(sql`id = ${id} AND category = ${category}`)
        .returning()
      return row ?? null
    }
    case 'recommendation':
    case 'mobile-adapter': {
      const category = type
      const data = pick(body, ['key', 'value', 'type', 'description', 'isPublic'])
      const [row] = await db
        .update(systemConfigs)
        .set(data as never)
        .where(sql`id = ${id} AND category = ${category}`)
        .returning()
      return row ?? null
    }
  }
}

// ============== delete ==============

async function deleteByType(type: ContentType, id: string): Promise<boolean> {
  switch (type) {
    case 'announcement': {
      const r = await db.delete(announcements).where(eq(announcements.id, id)).returning()
      return r.length > 0
    }
    case 'help-article': {
      const r = await db.delete(helpArticles).where(eq(helpArticles.id, id)).returning()
      return r.length > 0
    }
    case 'help-category': {
      const r = await db.delete(helpCategories).where(eq(helpCategories.id, id)).returning()
      return r.length > 0
    }
    case 'doc': {
      const r = await db.delete(docs).where(eq(docs.id, id)).returning()
      return r.length > 0
    }
    case 'article': {
      const r = await db.delete(newsArticles).where(eq(newsArticles.id, id)).returning()
      return r.length > 0
    }
    case 'advertise': {
      const r = await db.delete(carousels).where(eq(carousels.id, id)).returning()
      return r.length > 0
    }
    case 'about-us':
    case 'contact': {
      const category = type === 'about-us' ? 'about-us' : 'contact'
      const r = await db
        .delete(docs)
        .where(sql`id = ${id} AND category = ${category}`)
        .returning()
      return r.length > 0
    }
    case 'recommendation':
    case 'mobile-adapter': {
      const category = type
      const r = await db
        .delete(systemConfigs)
        .where(sql`id = ${id} AND category = ${category}`)
        .returning()
      return r.length > 0
    }
  }
}
