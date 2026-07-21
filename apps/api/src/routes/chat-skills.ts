import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import {
  listChatSkills,
  findChatSkillById,
  createChatSkill,
  updateChatSkill,
  deleteChatSkill,
} from '../db/chat-skills-queries.js'
import { success, error } from '../utils/response.js'

/**
 * 用户自定义 AI 对话框技能路由
 * 路径前缀:/api/chat/skills(server.ts 中通过 fastify.register 时指定)
 * 鉴权:所有端点均需登录
 */
export const chatSkillsRoutes: FastifyPluginAsync = async (server) => {
  const idParam = z.object({ id: z.string().uuid() })

  // 创建/更新校验:name(必填,1-128)、prompt(必填,1-10000)、category/scenario(枚举)
  const baseFields = {
    name: z.string().min(1, '技能名称不能为空').max(128),
    category: z
      .enum(['template', 'slash', 'self-media', 'openclaw', 'mcp', 'custom'])
      .default('custom'),
    scenario: z.enum(['writing', 'coding', 'media', 'tool', 'custom']).default('custom'),
    prompt: z.string().min(1, '模板内容不能为空').max(10000),
    icon: z.string().max(64).nullable().optional(),
    sortOrder: z.number().int().optional(),
    enabled: z.boolean().optional(),
  }
  const createSchema = z.object(baseFields)
  const updateSchema = z.object({
    name: baseFields.name.optional(),
    category: baseFields.category.optional(),
    scenario: baseFields.scenario.optional(),
    prompt: baseFields.prompt.optional(),
    icon: baseFields.icon,
    sortOrder: baseFields.sortOrder,
    enabled: baseFields.enabled,
  })

  // GET /api/chat/skills - 列出当前用户的技能
  server.get('/', async (request, reply) => {
    const authed = await checkAuth(request, reply)
    if (!authed) return
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const list = await listChatSkills(userId)
    return reply.send(success({ skills: list, total: list.length }))
  })

  // POST /api/chat/skills - 创建技能
  server.post('/', async (request, reply) => {
    const authed = await checkAuth(request, reply)
    if (!authed) return
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const skill = await createChatSkill(userId, parsed.data)
    return reply.status(201).send(success({ skill }))
  })

  // PATCH /api/chat/skills/:id - 更新技能(仅当前用户自己的)
  server.patch('/:id', async (request, reply) => {
    const authed = await checkAuth(request, reply)
    if (!authed) return
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const idParsed = idParam.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, '无效的技能 ID'))
    }

    const bodyParsed = updateSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }

    // 校验归属
    const existing = await findChatSkillById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '技能不存在'))
    }
    if (existing.userId !== userId) {
      return reply.status(403).send(error(403, '无权操作该技能'))
    }

    const updated = await updateChatSkill(idParsed.data.id, userId, bodyParsed.data)
    if (!updated) {
      return reply.status(500).send(error(500, '更新失败'))
    }
    return reply.send(success({ skill: updated }))
  })

  // DELETE /api/chat/skills/:id - 删除技能(仅当前用户自己的)
  server.delete('/:id', async (request, reply) => {
    const authed = await checkAuth(request, reply)
    if (!authed) return
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const idParsed = idParam.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, '无效的技能 ID'))
    }

    // 校验归属
    const existing = await findChatSkillById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '技能不存在'))
    }
    if (existing.userId !== userId) {
      return reply.status(403).send(error(403, '无权操作该技能'))
    }

    const deleted = await deleteChatSkill(idParsed.data.id, userId)
    return reply.send(success({ deleted }))
  })
}
