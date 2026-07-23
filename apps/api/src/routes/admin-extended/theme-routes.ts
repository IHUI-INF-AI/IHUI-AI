/**
 * 主题管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/themes
 * 含:主题 CRUD + colors/fonts/assets 子资源 + presets + dark-mode + import + apply-preset。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, desc, count } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  themes,
  themeColors,
  themeFonts,
  themeAssets,
  themePresets,
} from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

const themesPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  themeId: z.string().uuid().optional(),
})

function parseThemesPagination(request: FastifyRequest, reply: FastifyReply) {
  const parsed = themesPaginationSchema.safeParse(request.query)
  if (!parsed.success) {
    reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    return null
  }
  return parsed.data
}

const createThemeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isDark: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isCurrent: z.boolean().optional(),
  preset: z.string().max(50).optional(),
  settings: z.record(z.unknown()).optional(),
})
const updateThemeSchema = createThemeSchema.partial()

const createThemeColorSchema = z.object({
  themeId: z.string().uuid(),
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
  label: z.string().max(100).optional(),
  sortOrder: z.number().int().optional(),
})
const updateThemeColorSchema = createThemeColorSchema.partial()

const bulkUpdateThemeColorsSchema = z.object({
  colors: z.array(updateThemeColorSchema.extend({ id: z.string().uuid() })),
})

const createThemeFontSchema = z.object({
  themeId: z.string().uuid(),
  name: z.string().min(1).max(100),
  family: z.string().min(1).max(200),
  url: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})
const updateThemeFontSchema = createThemeFontSchema.partial()

const createThemeAssetSchema = z.object({
  themeId: z.string().uuid(),
  type: z.string().min(1).max(50),
  url: z.string().min(1).max(500),
  label: z.string().max(100).optional(),
  sortOrder: z.number().int().optional(),
})

const importThemeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isDark: z.boolean().optional(),
  preset: z.string().max(50).optional(),
  settings: z.record(z.unknown()).optional(),
  colors: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        value: z.string().min(1).max(100),
        label: z.string().max(100).optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
  fonts: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        family: z.string().min(1).max(200),
        url: z.string().max(500).optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
  assets: z
    .array(
      z.object({
        type: z.string().min(1).max(50),
        url: z.string().min(1).max(500),
        label: z.string().max(100).optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
})

const applyPresetSchema = z.object({
  presetId: z.string().uuid().optional(),
  preset: z.string().max(50).optional(),
  name: z.string().max(100).optional(),
})

const darkModeSchema = z.object({
  isDark: z.boolean(),
})

export const themeRoutes: FastifyPluginAsync = async (server) => {
  // --- Static path routes (registered before :id) ---

  server.get('/admin/themes/current', { preHandler: requireAdmin }, async (_request, reply) => {
    const [theme] = await db.select().from(themes).where(eq(themes.isCurrent, true)).limit(1)
    if (!theme) return reply.status(404).send(error(404, '未设置当前主题'))
    return reply.send(success(theme))
  })

  server.get('/admin/themes/dark-mode', { preHandler: requireAdmin }, async (_request, reply) => {
    const [theme] = await db.select().from(themes).where(eq(themes.isCurrent, true)).limit(1)
    if (!theme) return reply.status(404).send(error(404, '未设置当前主题'))
    return reply.send(success({ isDark: theme.isDark, themeId: theme.id }))
  })

  server.put('/admin/themes/dark-mode', { preHandler: requireAdmin }, async (request, reply) => {
    const { isDark } = parseOrThrow(darkModeSchema, request.body)
    const [theme] = await db.select().from(themes).where(eq(themes.isCurrent, true)).limit(1)
    if (!theme) return reply.status(404).send(error(404, '未设置当前主题'))
    const [updated] = await db
      .update(themes)
      .set({ isDark, updatedAt: new Date() })
      .where(eq(themes.id, theme.id))
      .returning()
    return reply.send(success(updated))
  })

  server.post('/admin/themes/import', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(importThemeSchema, request.body)
    const [created] = await db
      .insert(themes)
      .values({
        name: body.name,
        description: body.description,
        isDark: body.isDark ?? false,
        preset: body.preset,
        settings: body.settings ?? {},
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建主题失败'))
    if (body.colors?.length) {
      await db.insert(themeColors).values(
        body.colors.map((c) => ({
          themeId: created.id,
          key: c.key,
          value: c.value,
          label: c.label,
          sortOrder: c.sortOrder ?? 0,
        })),
      )
    }
    if (body.fonts?.length) {
      await db.insert(themeFonts).values(
        body.fonts.map((f) => ({
          themeId: created.id,
          name: f.name,
          family: f.family,
          url: f.url,
          isDefault: f.isDefault ?? false,
          sortOrder: f.sortOrder ?? 0,
        })),
      )
    }
    if (body.assets?.length) {
      await db.insert(themeAssets).values(
        body.assets.map((a) => ({
          themeId: created.id,
          type: a.type,
          url: a.url,
          label: a.label,
          sortOrder: a.sortOrder ?? 0,
        })),
      )
    }
    return reply.status(201).send(success(created))
  })

  server.post(
    '/admin/themes/apply-preset',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = parseOrThrow(applyPresetSchema, request.body)
      let preset
      if (body.presetId) {
        const [p] = await db
          .select()
          .from(themePresets)
          .where(eq(themePresets.id, body.presetId))
          .limit(1)
        preset = p
      } else if (body.preset) {
        const [p] = await db
          .select()
          .from(themePresets)
          .where(eq(themePresets.preset, body.preset))
          .limit(1)
        preset = p
      }
      if (!preset) return reply.status(404).send(error(404, '预设不存在'))
      const [created] = await db
        .insert(themes)
        .values({
          name: body.name ?? preset.name,
          preset: preset.preset,
          settings: preset.config,
        })
        .returning()
      return reply.status(201).send(success(created))
    },
  )

  // --- Theme colors routes (5) ---

  server.get('/admin/themes/colors', { preHandler: requireAdmin }, async (request, reply) => {
    const q = parseThemesPagination(request, reply)
    if (!q) return
    const offset = (q.page - 1) * q.pageSize
    const where = q.themeId ? eq(themeColors.themeId, q.themeId) : undefined
    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(themeColors)
        .where(where)
        .orderBy(desc(themeColors.createdAt))
        .limit(q.pageSize)
        .offset(offset),
      db.select({ count: count() }).from(themeColors).where(where),
    ])
    return reply.send(
      success({ list: items, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.post('/admin/themes/colors', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createThemeColorSchema, request.body)
    const [created] = await db.insert(themeColors).values(body).returning()
    return reply.status(201).send(success(created))
  })

  server.put('/admin/themes/colors', { preHandler: requireAdmin }, async (request, reply) => {
    const { colors } = parseOrThrow(bulkUpdateThemeColorsSchema, request.body)
    await db.transaction(async (tx) => {
      for (const c of colors) {
        await tx
          .update(themeColors)
          .set({ ...c, updatedAt: new Date() })
          .where(eq(themeColors.id, c.id))
      }
    })
    return reply.send(success({ updated: colors.length }))
  })

  server.put('/admin/themes/colors/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateThemeColorSchema, request.body)
    const [updated] = await db
      .update(themeColors)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(themeColors.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '颜色不存在'))
    return reply.send(success(updated))
  })

  server.delete(
    '/admin/themes/colors/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      await db.delete(themeColors).where(eq(themeColors.id, id))
      return reply.send(success({ deleted: true }))
    },
  )

  // --- Theme fonts routes (4) ---

  server.get('/admin/themes/fonts', { preHandler: requireAdmin }, async (request, reply) => {
    const q = parseThemesPagination(request, reply)
    if (!q) return
    const offset = (q.page - 1) * q.pageSize
    const where = q.themeId ? eq(themeFonts.themeId, q.themeId) : undefined
    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(themeFonts)
        .where(where)
        .orderBy(desc(themeFonts.createdAt))
        .limit(q.pageSize)
        .offset(offset),
      db.select({ count: count() }).from(themeFonts).where(where),
    ])
    return reply.send(
      success({ list: items, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.post('/admin/themes/fonts', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createThemeFontSchema, request.body)
    const [created] = await db.insert(themeFonts).values(body).returning()
    return reply.status(201).send(success(created))
  })

  server.patch('/admin/themes/fonts/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateThemeFontSchema, request.body)
    const [updated] = await db
      .update(themeFonts)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(themeFonts.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '字体不存在'))
    return reply.send(success(updated))
  })

  server.delete('/admin/themes/fonts/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    await db.delete(themeFonts).where(eq(themeFonts.id, id))
    return reply.send(success({ deleted: true }))
  })

  // --- Theme assets routes (3) ---

  server.get('/admin/themes/assets', { preHandler: requireAdmin }, async (request, reply) => {
    const q = parseThemesPagination(request, reply)
    if (!q) return
    const offset = (q.page - 1) * q.pageSize
    const where = q.themeId ? eq(themeAssets.themeId, q.themeId) : undefined
    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(themeAssets)
        .where(where)
        .orderBy(desc(themeAssets.createdAt))
        .limit(q.pageSize)
        .offset(offset),
      db.select({ count: count() }).from(themeAssets).where(where),
    ])
    return reply.send(
      success({ list: items, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.post('/admin/themes/assets', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createThemeAssetSchema, request.body)
    const [created] = await db.insert(themeAssets).values(body).returning()
    return reply.status(201).send(success(created))
  })

  server.delete(
    '/admin/themes/assets/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      await db.delete(themeAssets).where(eq(themeAssets.id, id))
      return reply.send(success({ deleted: true }))
    },
  )

  // --- Theme presets routes (1) ---

  server.get('/admin/themes/presets', { preHandler: requireAdmin }, async (request, reply) => {
    const q = parseThemesPagination(request, reply)
    if (!q) return
    const offset = (q.page - 1) * q.pageSize
    const [items, totalRows] = await Promise.all([
      db
        .select()
        .from(themePresets)
        .orderBy(desc(themePresets.createdAt))
        .limit(q.pageSize)
        .offset(offset),
      db.select({ count: count() }).from(themePresets),
    ])
    return reply.send(
      success({ list: items, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // --- Theme main CRUD (parametric routes last) ---

  server.post('/admin/themes', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createThemeSchema, request.body)
    const values = {
      name: body.name,
      description: body.description,
      isDark: body.isDark ?? false,
      isActive: body.isActive ?? true,
      isCurrent: body.isCurrent ?? false,
      preset: body.preset,
      settings: body.settings ?? {},
    }
    if (body.isCurrent) {
      const [created] = await db.transaction(async (tx) => {
        await tx
          .update(themes)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(eq(themes.isCurrent, true))
        return tx.insert(themes).values(values).returning()
      })
      return reply.status(201).send(success(created))
    }
    const [created] = await db.insert(themes).values(values).returning()
    return reply.status(201).send(success(created))
  })

  server.get('/admin/themes/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [theme] = await db.select().from(themes).where(eq(themes.id, id)).limit(1)
    if (!theme) return reply.status(404).send(error(404, '主题不存在'))
    const [colors, fonts, assets] = await Promise.all([
      db
        .select()
        .from(themeColors)
        .where(eq(themeColors.themeId, id))
        .orderBy(themeColors.sortOrder),
      db.select().from(themeFonts).where(eq(themeFonts.themeId, id)).orderBy(themeFonts.sortOrder),
      db
        .select()
        .from(themeAssets)
        .where(eq(themeAssets.themeId, id))
        .orderBy(themeAssets.sortOrder),
    ])
    return reply.send(success({ ...theme, colors, fonts, assets }))
  })

  server.put('/admin/themes/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateThemeSchema, request.body)
    if (body.isCurrent) {
      const [updated] = await db.transaction(async (tx) => {
        await tx
          .update(themes)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(eq(themes.isCurrent, true))
        return tx
          .update(themes)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(themes.id, id))
          .returning()
      })
      if (!updated) return reply.status(404).send(error(404, '主题不存在'))
      return reply.send(success(updated))
    }
    const [updated] = await db
      .update(themes)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(themes.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '主题不存在'))
    return reply.send(success(updated))
  })

  server.patch('/admin/themes/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateThemeSchema, request.body)
    if (body.isCurrent) {
      const [updated] = await db.transaction(async (tx) => {
        await tx
          .update(themes)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(eq(themes.isCurrent, true))
        return tx
          .update(themes)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(themes.id, id))
          .returning()
      })
      if (!updated) return reply.status(404).send(error(404, '主题不存在'))
      return reply.send(success(updated))
    }
    const [updated] = await db
      .update(themes)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(themes.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '主题不存在'))
    return reply.send(success(updated))
  })

  server.delete('/admin/themes/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [deleted] = await db.delete(themes).where(eq(themes.id, id)).returning()
    if (!deleted) return reply.status(404).send(error(404, '主题不存在'))
    return reply.send(success({ deleted: true }))
  })
}
