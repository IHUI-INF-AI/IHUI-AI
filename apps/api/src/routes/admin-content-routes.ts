/**
 * 管理后台内容运营路由（6 个端点）。
 * 替代 admin-missing-routes.ts 中的 6 个 registerEmptyStub 空桩。
 * 复用现有 carousels/feedbacks/docs/systemConfigs 表。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, ne, ilike, desc, asc, sql, and } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { carousels, feedbacks, docs, systemConfigs } from '@ihui/database'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const idParamSchema = z.object({ id: z.string() })

const aboutUsQuerySchema = paginationSchema.extend({
  network: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  phone: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  socialMedia: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  experience: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const aboutUsBodySchema = z.object({
  network: z.string().default(''),
  phone: z.string().default(''),
  socialMedia: z.string().default(''),
  experience: z.string().default(''),
  description: z.string().default(''),
})

const advertiseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  title: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const advertiseBodySchema = z.object({
  title: z.string().default(''),
  position: z.string().default(''),
  imageUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  sort: z.coerce.number().int().default(0),
  status: z.coerce.number().int().default(1),
})

const contactQuerySchema = paginationSchema.extend({
  introduction: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  corporateCulture: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const contactBodySchema = z.object({
  introduction: z.string().default(''),
  corporateCulture: z.string().default(''),
})

const modeBodySchema = z.object({
  mode: z.enum(['mobile', 'tablet', 'desktop']),
})

const recommendBodySchema = z.object({
  position: z.string().default(''),
  name: z.string().min(1),
  contentType: z.enum(['agent', 'article', 'course', 'activity', 'live']).default('agent'),
  sort: z.coerce.number().int().default(0),
})

function validate<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input)
  if (!r.success) {
    throw new AppError(r.error.issues[0]?.message ?? '参数错误', 400, 'VALIDATION_FAILED')
  }
  return r.data
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const adminContentOpsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ----- /about-us（docs 表，category='about-us'）-----
  server.get('/about-us', async (request, reply) => {
    const { page, pageSize, network, phone, socialMedia, experience } = validate(
      aboutUsQuerySchema,
      request.query,
    )
    const conds = [eq(docs.category, 'about-us')]
    if (network) conds.push(ilike(docs.title, `%${network}%`))
    if (phone) conds.push(ilike(docs.content, `%${phone}%`))
    if (socialMedia) conds.push(ilike(docs.content, `%${socialMedia}%`))
    if (experience) conds.push(ilike(docs.content, `%${experience}%`))
    const where = and(...conds)
    const rows = await db
      .select()
      .from(docs)
      .where(where)
      .orderBy(desc(docs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const list = rows.map((d) => {
      const m = parseJson<{
        phone: string
        socialMedia: string
        experience: string
        description: string
      }>(d.content, { phone: '', socialMedia: '', experience: '', description: '' })
      return {
        id: d.id,
        network: d.title,
        phone: m.phone,
        socialMedia: m.socialMedia,
        experience: m.experience,
        description: m.description,
      }
    })
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(docs)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })

  server.post('/about-us', async (request, reply) => {
    const b = validate(aboutUsBodySchema, request.body)
    const [row] = await db
      .insert(docs)
      .values({
        category: 'about-us',
        title: b.network,
        slug: `about-us-${randomUUID()}`,
        content: JSON.stringify({
          phone: b.phone,
          socialMedia: b.socialMedia,
          experience: b.experience,
          description: b.description,
        }),
      })
      .returning()
    return reply.status(201).send(success(row))
  })

  server.put('/about-us/:id', async (request, reply) => {
    const { id } = validate(idParamSchema, request.params)
    const b = validate(aboutUsBodySchema, request.body)
    const [row] = await db
      .update(docs)
      .set({
        title: b.network,
        content: JSON.stringify({
          phone: b.phone,
          socialMedia: b.socialMedia,
          experience: b.experience,
          description: b.description,
        }),
        updatedAt: new Date(),
      })
      .where(eq(docs.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  server.delete('/about-us/:id', async (request, reply) => {
    const { id } = validate(idParamSchema, request.params)
    await db.delete(docs).where(eq(docs.id, id))
    return reply.send(success({ id, deleted: true }))
  })

  // ----- /advertise（carousels 表）-----
  server.get('/advertise', async (request, reply) => {
    const { page, pageSize, title } = validate(advertiseQuerySchema, request.query)
    const where = title ? ilike(carousels.title, `%${title}%`) : undefined
    const rows = await db
      .select()
      .from(carousels)
      .where(where)
      .orderBy(desc(carousels.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const list = rows.map((c) => ({
      id: c.id,
      title: c.title ?? '',
      position: c.position,
      imageUrl: c.imageUrl,
      linkUrl: c.linkUrl,
      sort: c.sort,
      status: c.status,
      createdAt: c.createdAt,
    }))
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(carousels)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })

  server.post('/advertise', async (request, reply) => {
    const b = validate(advertiseBodySchema, request.body)
    const [row] = await db
      .insert(carousels)
      .values({
        title: b.title,
        position: b.position,
        imageUrl: b.imageUrl ?? '',
        linkUrl: b.linkUrl,
        sort: b.sort,
        status: b.status,
      })
      .returning()
    return reply.status(201).send(success(row))
  })

  server.put('/advertise/:id', async (request, reply) => {
    const { id } = validate(idParamSchema, request.params)
    const b = validate(advertiseBodySchema, request.body)
    const [row] = await db
      .update(carousels)
      .set({
        title: b.title,
        position: b.position,
        imageUrl: b.imageUrl ?? '',
        linkUrl: b.linkUrl,
        sort: b.sort,
        status: b.status,
        updatedAt: new Date(),
      })
      .where(eq(carousels.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  server.delete('/advertise/:id', async (request, reply) => {
    const { id } = validate(idParamSchema, request.params)
    await db.delete(carousels).where(eq(carousels.id, id))
    return reply.send(success({ id, deleted: true }))
  })

  // ----- /contact（feedbacks 表，type='contact'）-----
  server.get('/contact', async (request, reply) => {
    const { page, pageSize, introduction, corporateCulture } = validate(
      contactQuerySchema,
      request.query,
    )
    const conds = [eq(feedbacks.type, 'contact')]
    if (introduction) conds.push(ilike(feedbacks.content, `%${introduction}%`))
    if (corporateCulture) conds.push(ilike(feedbacks.content, `%${corporateCulture}%`))
    const where = and(...conds)
    const rows = await db
      .select()
      .from(feedbacks)
      .where(where)
      .orderBy(desc(feedbacks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const list = rows.map((f) => {
      const m = parseJson<{ introduction: string; corporateCulture: string }>(f.content, {
        introduction: '',
        corporateCulture: '',
      })
      return { id: f.id, introduction: m.introduction, corporateCulture: m.corporateCulture }
    })
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(feedbacks)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })

  server.post('/contact', async (request, reply) => {
    const b = validate(contactBodySchema, request.body)
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const [row] = await db
      .insert(feedbacks)
      .values({
        userId,
        type: 'contact',
        title: 'contact',
        content: JSON.stringify({
          introduction: b.introduction,
          corporateCulture: b.corporateCulture,
        }),
      })
      .returning()
    return reply.status(201).send(success(row))
  })

  server.put('/contact/:id', async (request, reply) => {
    const { id } = validate(idParamSchema, request.params)
    const b = validate(contactBodySchema, request.body)
    const [row] = await db
      .update(feedbacks)
      .set({
        content: JSON.stringify({
          introduction: b.introduction,
          corporateCulture: b.corporateCulture,
        }),
        updatedAt: new Date(),
      })
      .where(eq(feedbacks.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })

  server.delete('/contact/:id', async (request, reply) => {
    const { id } = validate(idParamSchema, request.params)
    await db.delete(feedbacks).where(eq(feedbacks.id, id))
    return reply.send(success({ id, deleted: true }))
  })

  // ----- /mobile-adapter（systemConfigs 表，category='mobile-adapter'）-----
  server.get('/mobile-adapter', async (_request, reply) => {
    const rows = await db
      .select()
      .from(systemConfigs)
      .where(
        and(eq(systemConfigs.category, 'mobile-adapter'), ne(systemConfigs.key, 'preview-mode')),
      )
      .orderBy(asc(systemConfigs.createdAt))
    const list = rows.map((c) => {
      const m = parseJson<{
        resolution: string
        dpr: number
        status: 'adapted' | 'partial' | 'pending'
      }>(c.value, { resolution: '', dpr: 1, status: 'pending' })
      return { id: c.id, model: c.key, resolution: m.resolution, dpr: m.dpr, status: m.status }
    })
    return reply.send(success(list))
  })

  server.put('/mobile-adapter/mode', async (request, reply) => {
    const { mode } = validate(modeBodySchema, request.body)
    await db
      .insert(systemConfigs)
      .values({ key: 'preview-mode', value: mode, category: 'mobile-adapter', type: 'string' })
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: { value: mode, updatedAt: new Date() },
      })
    return reply.send(success({ mode }))
  })

  // ----- /recommendation-config（systemConfigs 表，category='recommendation'）-----
  server.get('/recommendation-config', async (_request, reply) => {
    const rows = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.category, 'recommendation'))
      .orderBy(asc(systemConfigs.createdAt))
    const list = rows.map((c) => {
      const m = parseJson<{
        position: string
        contentType: string
        sort: number
        isEnabled: boolean
      }>(c.value, { position: '', contentType: 'agent', sort: 0, isEnabled: false })
      return {
        id: c.id,
        position: m.position,
        name: c.key,
        contentType: m.contentType,
        sort: m.sort,
        isEnabled: m.isEnabled,
      }
    })
    return reply.send(success(list))
  })

  server.post('/recommendation-config', async (request, reply) => {
    const b = validate(recommendBodySchema, request.body)
    const [row] = await db
      .insert(systemConfigs)
      .values({
        key: b.name,
        value: JSON.stringify({
          position: b.position,
          contentType: b.contentType,
          sort: b.sort,
          isEnabled: true,
        }),
        category: 'recommendation',
        type: 'json',
      })
      .returning()
    return reply.status(201).send(
      success({
        id: row?.id ?? '',
        position: b.position,
        name: b.name,
        contentType: b.contentType,
        sort: b.sort,
        isEnabled: true,
      }),
    )
  })

  server.put('/recommendation-config/:id', async (request, reply) => {
    const { id } = validate(idParamSchema, request.params)
    const b = validate(recommendBodySchema, request.body)
    const [existing] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, id))
    if (!existing) return reply.status(404).send(error(404, '记录不存在'))
    const prev = parseJson<{ isEnabled: boolean }>(existing.value, { isEnabled: false })
    await db
      .update(systemConfigs)
      .set({
        key: b.name,
        value: JSON.stringify({
          position: b.position,
          contentType: b.contentType,
          sort: b.sort,
          isEnabled: prev.isEnabled,
        }),
        updatedAt: new Date(),
      })
      .where(eq(systemConfigs.id, id))
    return reply.send(
      success({
        id,
        position: b.position,
        name: b.name,
        contentType: b.contentType,
        sort: b.sort,
        isEnabled: prev.isEnabled,
      }),
    )
  })

  server.put('/recommendation-config/:id/toggle', async (request, reply) => {
    const { id } = validate(idParamSchema, request.params)
    const [existing] = await db.select().from(systemConfigs).where(eq(systemConfigs.id, id))
    if (!existing) return reply.status(404).send(error(404, '记录不存在'))
    const prev = parseJson<{
      position: string
      contentType: string
      sort: number
      isEnabled: boolean
    }>(existing.value, { position: '', contentType: 'agent', sort: 0, isEnabled: false })
    const isEnabled = !prev.isEnabled
    await db
      .update(systemConfigs)
      .set({
        value: JSON.stringify({
          position: prev.position,
          contentType: prev.contentType,
          sort: prev.sort,
          isEnabled,
        }),
        updatedAt: new Date(),
      })
      .where(eq(systemConfigs.id, id))
    return reply.send(success({ id, isEnabled }))
  })

  server.delete('/recommendation-config/:id', async (request, reply) => {
    const { id } = validate(idParamSchema, request.params)
    await db.delete(systemConfigs).where(eq(systemConfigs.id, id))
    return reply.send(success({ id, deleted: true }))
  })
}
