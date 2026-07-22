/**
 * Skill 持久化路由(P0-2 api 侧)。
 *
 * 管理自进化生成的 skill,支持 CRUD。Skill 数据持久化到 Redis,
 * Redis 不可用时降级为进程内 Map(仅开发环境,重启失效)。
 *
 * Redis key 格式:skills:<userId>(value 为 skill 数组 JSON)
 *
 * 端点:
 *  - GET    /skills          列出当前用户的所有 skill
 *  - POST   /skills          创建/更新 skill(upsert by name)
 *  - GET    /skills/:name    获取单个 skill
 *  - DELETE /skills/:name    删除 skill
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import type { SkillSource } from '@ihui/types'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

interface SkillRecord {
  name: string
  description?: string
  content: string
  version: string
  license: string
  source: SkillSource
  tags?: string[]
  createdAt: string
  updatedAt: string
}

const skillSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(1024).optional(),
  content: z.string().min(1),
  version: z.string().default('1.0.0'),
  license: z.string().default('MIT'),
  source: z.enum(['builtin', 'user', 'auto', 'hub']).default('user'),
  tags: z.array(z.string()).optional(),
})

const nameParamSchema = z.object({
  name: z.string().min(1).max(64),
})

/** Redis 不可用时的进程内降级存储 */
const skillsFallback = new Map<string, SkillRecord[]>()

function redisKey(userId: string): string {
  return `skills:${userId}`
}

async function readSkills(
  redis: { get: (k: string) => Promise<string | null> },
  key: string,
): Promise<SkillRecord[]> {
  try {
    const raw = await redis.get(key)
    if (!raw) return []
    return JSON.parse(raw) as SkillRecord[]
  } catch {
    return skillsFallback.get(key) ?? []
  }
}

async function writeSkills(
  redis: { set: (k: string, v: string) => Promise<unknown> },
  key: string,
  skills: SkillRecord[],
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(skills))
  } catch {
    skillsFallback.set(key, skills)
  }
}

export const skillsRoutes: FastifyPluginAsync = async (server) => {
  // GET /skills — 列出当前用户的所有 skill
  server.get('/skills', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const key = redisKey(userId)
    const skills = await readSkills(server.redis, key)
    return reply.send(success({ skills, total: skills.length }))
  })

  // POST /skills — 创建/更新 skill(upsert by name)
  server.post('/skills', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = skillSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { name, description, content, version, license, source, tags } = parsed.data
    const now = new Date().toISOString()
    const key = redisKey(userId)
    const skills = await readSkills(server.redis, key)

    const idx = skills.findIndex((s) => s.name === name)
    const record: SkillRecord = {
      name,
      description,
      content,
      version,
      license,
      source: source as SkillSource,
      tags,
      createdAt: idx >= 0 ? skills[idx]!.createdAt : now,
      updatedAt: now,
    }

    if (idx >= 0) {
      skills[idx] = record
    } else {
      skills.push(record)
    }
    await writeSkills(server.redis, key, skills)

    return reply.status(201).send(success(record))
  })

  // GET /skills/:name — 获取单个 skill
  server.get<{ Params: { name: string } }>(
    '/skills/:name',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!

      const parsed = nameParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const key = redisKey(userId)
      const skills = await readSkills(server.redis, key)
      const skill = skills.find((s) => s.name === parsed.data.name)
      if (!skill) {
        return reply.status(404).send(error(404, 'Skill 不存在'))
      }
      return reply.send(success(skill))
    },
  )

  // DELETE /skills/:name — 删除 skill
  server.delete<{ Params: { name: string } }>(
    '/skills/:name',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!

      const parsed = nameParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const key = redisKey(userId)
      const skills = await readSkills(server.redis, key)
      const idx = skills.findIndex((s) => s.name === parsed.data.name)
      if (idx < 0) {
        return reply.status(404).send(error(404, 'Skill 不存在'))
      }
      skills.splice(idx, 1)
      await writeSkills(server.redis, key, skills)
      return reply.send(success({ name: parsed.data.name, deleted: true }))
    },
  )
}
