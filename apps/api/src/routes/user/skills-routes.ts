/**
 * Skills 模块 /skills/*(4 个端点:PUT 更新 + push/pull/db-sync 双向同步)。
 * 注:GET /skills、GET /skills/:id、POST /skills、DELETE /skills/:id 已在 routes/skills.ts 注册。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import {
  updateSkill,
  findSkillsByUserId,
  upsertSkillBySlug,
  deleteSkillsByAuthorAndSlugs,
} from '../../db/skills-queries.js'
import { parseIdParam } from './_shared.js'

const skillSyncItemSchema = z.object({
  slug: z.string().min(1).max(200),
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  contentHash: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
})

const skillsRoutes: FastifyPluginAsync = async (server) => {
  server.put('/skills/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        name: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        categoryId: z.string().optional(),
        difficulty: z.number().optional(),
        content: z.string().optional(),
        isPublished: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const skill = await updateSkill(id, body.data)
    if (!skill) return reply.status(404).send(error(404, '技能不存在'))
    return reply.send(success({ success: true, skill }))
  })

  server.post('/skills/push', async (request, reply) => {
    if (!request.userId) return reply.status(401).send(error(401, '未登录'))
    const body = z
      .object({
        skills: z.array(skillSyncItemSchema),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))

    const results: Array<{
      slug: string
      status: 'created' | 'updated' | 'unchanged' | 'error'
      message?: string
    }> = []

    for (const item of body.data.skills) {
      try {
        const { action } = await upsertSkillBySlug({
          slug: item.slug,
          name: item.name,
          description: item.description ?? null,
          content: item.content ?? null,
          contentHash: item.contentHash ?? null,
          isPublished: item.isPublished,
          syncSource: 'cli',
          authorId: request.userId,
        })
        results.push({ slug: item.slug, status: action })
      } catch (err) {
        results.push({
          slug: item.slug,
          status: 'error',
          message: err instanceof Error ? err.message : '未知错误',
        })
      }
    }
    return reply.send(success({ results, serverTime: new Date().toISOString() }))
  })

  server.post('/skills/pull', async (request, reply) => {
    if (!request.userId) return reply.status(401).send(error(401, '未登录'))
    const userSkills = await findSkillsByUserId(request.userId)
    return reply.send(
      success({
        skills: userSkills.map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          description: s.description,
          content: s.content,
          contentHash: s.contentHash,
          isPublished: s.isPublished,
          syncSource: s.syncSource,
          updatedAt: s.updatedAt.toISOString(),
          lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
          deletedAt: s.deletedAt?.toISOString() ?? null,
        })),
        serverTime: new Date().toISOString(),
      }),
    )
  })

  server.post('/skills/db-sync', async (request, reply) => {
    if (!request.userId) return reply.status(401).send(error(401, '未登录'))
    const body = z
      .object({
        localSkills: z.array(skillSyncItemSchema),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))

    const pushResults: Array<{ slug: string; status: string }> = []
    for (const item of body.data.localSkills) {
      try {
        const { action } = await upsertSkillBySlug({
          slug: item.slug,
          name: item.name,
          description: item.description ?? null,
          content: item.content ?? null,
          contentHash: item.contentHash ?? null,
          isPublished: item.isPublished,
          syncSource: 'cli',
          authorId: request.userId,
        })
        pushResults.push({ slug: item.slug, status: action })
      } catch {
        pushResults.push({ slug: item.slug, status: 'error' })
      }
    }

    const localSlugs = body.data.localSkills.map((s) => s.slug)
    const remoteActiveSkills = await findSkillsByUserId(request.userId)
    const remoteActiveSlugs = remoteActiveSkills
      .filter((s) => s.deletedAt === null && s.slug)
      .map((s) => s.slug as string)
    const tombstonedSlugs = remoteActiveSlugs.filter((slug) => !localSlugs.includes(slug))
    let tombstonedCount = 0
    if (tombstonedSlugs.length > 0) {
      tombstonedCount = await deleteSkillsByAuthorAndSlugs(request.userId, tombstonedSlugs)
    }

    const remoteSkills = await findSkillsByUserId(request.userId)

    return reply.send(
      success({
        pushed: pushResults.filter((r) => r.status !== 'unchanged').map((r) => r.slug),
        pulled: remoteSkills.map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          description: s.description,
          content: s.content,
          contentHash: s.contentHash,
          isPublished: s.isPublished,
          syncSource: s.syncSource,
          updatedAt: s.updatedAt.toISOString(),
          lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
          deletedAt: s.deletedAt?.toISOString() ?? null,
        })),
        tombstoned: tombstonedSlugs,
        tombstonedCount,
        serverTime: new Date().toISOString(),
      }),
    )
  })
}

export default skillsRoutes
