import type { FastifyPluginAsync } from 'fastify'
import { eq, desc, and, like, count } from 'drizzle-orm'
import { resourceGithubProjects } from '@ihui/database'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

const githubProjectRoutes: FastifyPluginAsync = async (fastify) => {
  // GitHub 项目列表（分页 + 筛选）
  fastify.get<{
    Querystring: {
      page?: number
      limit?: number
      keyword?: string
      category?: string
      language?: string
    }
  }>(
    '/github-projects',
    async (request, reply) => {
      const { page = 1, limit = 20, keyword, category, language } = request.query
      const conditions = []
      if (keyword) conditions.push(like(resourceGithubProjects.name, `%${keyword}%`))
      if (category) conditions.push(eq(resourceGithubProjects.category, category))
      if (language) conditions.push(eq(resourceGithubProjects.language, language))
      const where = conditions.length > 0 ? and(...conditions) : undefined
      const items = await db
        .select()
        .from(resourceGithubProjects)
        .where(where)
        .orderBy(desc(resourceGithubProjects.id))
        .limit(limit)
        .offset((page - 1) * limit)
      const [countRow] = await db
        .select({ value: count() })
        .from(resourceGithubProjects)
        .where(where)
      return reply.send(success({ items, total: Number(countRow?.value ?? 0) }))
    },
  )

  // GitHub 项目详情
  fastify.get<{ Params: { id: number } }>(
    '/github-projects/:id',
    async (request, reply) => {
      const [item] = await db
        .select()
        .from(resourceGithubProjects)
        .where(eq(resourceGithubProjects.id, request.params.id))
        .limit(1)
      if (!item) return reply.code(404).send(error(404, '项目不存在'))
      return reply.send(success(item))
    },
  )

  // 创建 GitHub 项目（admin）
  fastify.post<{
    Body: {
      name: string
      url: string
      stars?: number
      category?: string
      description?: string
      language?: string
    }
  }>(
    '/github-projects',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      const [item] = await db
        .insert(resourceGithubProjects)
        .values(request.body)
        .returning({ id: resourceGithubProjects.id })
      if (!item) return reply.code(500).send(error(500, '创建失败'))
      return reply.send(success({ id: item.id }))
    },
  )

  // 修改 GitHub 项目（admin）
  fastify.put<{
    Params: { id: number }
    Body: {
      name?: string
      url?: string
      stars?: number
      category?: string
      description?: string
      language?: string
    }
  }>(
    '/github-projects/:id',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      const [item] = await db
        .update(resourceGithubProjects)
        .set(request.body)
        .where(eq(resourceGithubProjects.id, request.params.id))
        .returning({ id: resourceGithubProjects.id })
      if (!item) return reply.code(404).send(error(404, '项目不存在'))
      return reply.send(success({ id: item.id }))
    },
  )

  // 删除 GitHub 项目（admin）
  fastify.delete<{ Params: { id: number } }>(
    '/github-projects/:id',
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      const [item] = await db
        .delete(resourceGithubProjects)
        .where(eq(resourceGithubProjects.id, request.params.id))
        .returning({ id: resourceGithubProjects.id })
      if (!item) return reply.code(404).send(error(404, '项目不存在'))
      return reply.send(success({ id: request.params.id }))
    },
  )
}

export default githubProjectRoutes
