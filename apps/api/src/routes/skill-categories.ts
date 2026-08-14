import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { skillCategories } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

/**
 * 技能分类管理路由 (F3 真实缺口补齐)。
 * 前端 apps/web 通过 fetchApi('/api/skill-categories'...) 调用,此前后端无对应路由(POST/PUT/DELETE 必然 404)。
 * 复用现有表 skill_categories(packages/database 新增)。
 */
const createSkillCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(120),
  icon: z.string().max(50).optional(),
  sort: z.number().int().optional(),
})

const updateSkillCategorySchema = createSkillCategorySchema.partial()

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const skillCategoriesRoutes: FastifyPluginAsync = async (server) => {
  // 列表(GET /api/skill-categories) → 前端期望 { categories: SkillCategory[] }
  server.get('/skill-categories', async (_req, reply) => {
    const rows = await db
      .select()
      .from(skillCategories)
      .orderBy(desc(skillCategories.sort), desc(skillCategories.createdAt))
      .limit(200)
    return reply.send(success({ categories: rows }))
  })

  // 创建(POST /api/skill-categories)
  server.post('/skill-categories', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createSkillCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db.insert(skillCategories).values(parsed.data).returning()
    return reply.status(201).send(success(row))
  })

  // 更新(PUT /api/skill-categories/:id)
  server.put('/skill-categories/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const parsed = updateSkillCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await db
      .update(skillCategories)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(skillCategories.id, idParsed.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '技能分类不存在'))
    return reply.send(success(row))
  })

  // 删除(DELETE /api/skill-categories/:id)
  server.delete('/skill-categories/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const [row] = await db
      .delete(skillCategories)
      .where(eq(skillCategories.id, idParsed.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '技能分类不存在'))
    return reply.send(success({ id: idParsed.data.id, deleted: true }))
  })
}

export default skillCategoriesRoutes
