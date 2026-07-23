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
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { SkillSource, SkillFrontmatter } from '@ihui/types'
import type {
  SkillMarketEntry,
  SkillRating,
  SkillMarketListResponse,
  SkillInstallResponse,
} from '@ihui/shared'
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
  frontmatter?: SkillFrontmatter
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

// Skills 市场类型已迁移至 @ihui/shared/skills/market(单一契约源)

const MARKET_KEY = 'skills-market:global'

/** 市场种子数据(7 个内置 skill) */
const MARKET_SEED: SkillMarketEntry[] = [
  {
    name: 'content_engine',
    description: '内容引擎 — 自动生成公众号文章/口播稿/短视频脚本',
    tags: ['content', 'writing', 'media'],
    author: 'IHUI',
    version: '1.2.0',
    license: 'MIT',
    installCount: 1280,
    rating: 4.6,
    ratingCount: 87,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  },
  {
    name: 'koubo_workflow',
    description: '口播工作流 — 从提纲到成片的完整口播视频生产流水线',
    tags: ['content', 'video', 'workflow'],
    author: 'IHUI',
    version: '0.9.1',
    license: 'MIT',
    installCount: 642,
    rating: 4.3,
    ratingCount: 41,
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
  },
  {
    name: 'code-reviewer',
    description: '代码审查 — 自动 PR review,安全漏洞/坏味道/性能检查',
    tags: ['code', 'review', 'devops'],
    author: 'OpenSource',
    version: '2.0.0',
    license: 'Apache-2.0',
    installCount: 3120,
    rating: 4.8,
    ratingCount: 215,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
  },
  {
    name: 'test-writer',
    description: '测试生成 — 根据源码自动生成单元测试 + 集成测试骨架',
    tags: ['code', 'test', 'devops'],
    author: 'OpenSource',
    version: '1.5.2',
    license: 'MIT',
    installCount: 980,
    rating: 4.5,
    ratingCount: 63,
    createdAt: '2026-06-05T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
  },
  {
    name: 'figma-to-code',
    description: 'Figma 转代码 — Figma 设计稿一键转 React/Vue 组件',
    tags: ['design', 'frontend', 'code'],
    author: 'DesignTools',
    version: '3.1.0',
    license: 'MIT',
    installCount: 2150,
    rating: 4.7,
    ratingCount: 156,
    createdAt: '2026-05-15T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
  },
  {
    name: 'doc-summarizer',
    description: '文档摘要 — 长文档自动摘要 + 关键点提取 + 多语言翻译',
    tags: ['content', 'ai', 'docs'],
    author: 'IHUI',
    version: '1.0.3',
    license: 'MIT',
    installCount: 530,
    rating: 4.2,
    ratingCount: 28,
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
  },
  {
    name: 'api-mock-gen',
    description: 'API Mock 生成 — OpenAPI spec 自动生成 mock server + 测试数据',
    tags: ['code', 'api', 'devops'],
    author: 'DevTools',
    version: '0.8.0',
    license: 'MIT',
    installCount: 410,
    rating: 4.0,
    ratingCount: 19,
    createdAt: '2026-06-25T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
  },
]

const marketFallback = new Map<string, SkillMarketEntry[]>()
const ratingsFallback = new Map<string, SkillRating[]>()

const marketQuerySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const rateSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
})

async function readMarket(
  redis: { get: (k: string) => Promise<string | null>; set: (k: string, v: string) => Promise<unknown> },
  key: string,
): Promise<SkillMarketEntry[]> {
  try {
    const raw = await redis.get(key)
    if (!raw) {
      // 首次访问初始化种子数据
      await redis.set(key, JSON.stringify(MARKET_SEED))
      return MARKET_SEED
    }
    return JSON.parse(raw) as SkillMarketEntry[]
  } catch {
    return marketFallback.get(key) ?? MARKET_SEED
  }
}

async function writeMarket(
  redis: { set: (k: string, v: string) => Promise<unknown> },
  key: string,
  entries: SkillMarketEntry[],
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(entries))
  } catch {
    marketFallback.set(key, entries)
  }
}

async function readRatings(
  redis: { get: (k: string) => Promise<string | null> },
  key: string,
): Promise<SkillRating[]> {
  try {
    const raw = await redis.get(key)
    if (!raw) return []
    return JSON.parse(raw) as SkillRating[]
  } catch {
    return ratingsFallback.get(key) ?? []
  }
}

async function writeRatings(
  redis: { set: (k: string, v: string) => Promise<unknown> },
  key: string,
  ratings: SkillRating[],
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(ratings))
  } catch {
    ratingsFallback.set(key, ratings)
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

  // POST /skills/sync — 跨端同步(push/pull/list),对齐 SkillSyncRequest/SkillSyncResponse 契约
  server.post('/skills/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const body = (request.body ?? {}) as {
      action?: 'push' | 'pull' | 'list'
      skills?: Array<{
        name: string
        description?: string
        content: string
        frontmatter?: SkillFrontmatter
      }>
      skillNames?: string[]
    }

    const action = body.action
    if (!action || !['push', 'pull', 'list'].includes(action)) {
      return reply.status(400).send(error(400, 'action 必须为 push/pull/list'))
    }

    const key = redisKey(userId)
    const skills = await readSkills(server.redis, key)
    const syncedAt = new Date().toISOString()

    if (action === 'push') {
      if (!Array.isArray(body.skills) || body.skills.length === 0) {
        return reply.status(400).send(error(400, 'push 操作必须提供 skills 数组'))
      }
      for (const s of body.skills) {
        if (!s.name || !s.content) {
          return reply.status(400).send(error(400, 'skill.name 和 skill.content 必填'))
        }
        const idx = skills.findIndex((existing) => existing.name === s.name)
        const record: SkillRecord = {
          name: s.name,
          description: s.description,
          content: s.content,
          version: '1.0.0',
          license: 'MIT',
          source: 'user',
          frontmatter: s.frontmatter,
          createdAt: idx >= 0 ? skills[idx]!.createdAt : syncedAt,
          updatedAt: syncedAt,
        }
        if (idx >= 0) {
          skills[idx] = record
        } else {
          skills.push(record)
        }
      }
      await writeSkills(server.redis, key, skills)
      return reply.send(
        success({
          action: 'push',
          skills: [],
          count: body.skills.length,
          syncedAt,
        }),
      )
    }

    if (action === 'pull') {
      let result = skills
      if (Array.isArray(body.skillNames) && body.skillNames.length > 0) {
        const nameSet = new Set(body.skillNames)
        result = skills.filter((s) => nameSet.has(s.name))
      }
      return reply.send(
        success({
          action: 'pull',
          skills: result.map((s) => ({
            name: s.name,
            description: s.description,
            content: s.content,
            frontmatter: s.frontmatter,
            source: s.source,
          })),
          count: result.length,
          syncedAt,
        }),
      )
    }

    // action === 'list'
    return reply.send(
      success({
        action: 'list',
        skills: skills.map((s) => ({
          name: s.name,
          description: s.description,
          source: s.source,
        })),
        count: skills.length,
        syncedAt,
      }),
    )
  })

  // GET /skills/market — 搜索市场 skill(按 q/tag 过滤 + 分页)
  server.get('/skills/market', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return

    const parsed = marketQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { q, tag, page, pageSize } = parsed.data

    let entries = await readMarket(server.redis, MARKET_KEY)
    if (q) {
      const lower = q.toLowerCase()
      entries = entries.filter(
        (e) =>
          e.name.toLowerCase().includes(lower) ||
          e.description.toLowerCase().includes(lower),
      )
    }
    if (tag) {
      entries = entries.filter((e) => e.tags.includes(tag))
    }

    const total = entries.length
    const start = (page - 1) * pageSize
    const items = entries.slice(start, start + pageSize)
    const response: SkillMarketListResponse = { items, total, page, pageSize }
    return reply.send(success(response))
  })

  // POST /skills/:name/install — 安装 skill(installCount++)
  server.post<{ Params: { name: string } }>(
    '/skills/:name/install',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return

      const parsed = nameParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const entries = await readMarket(server.redis, MARKET_KEY)
      const idx = entries.findIndex((e) => e.name === parsed.data.name)
      if (idx < 0) {
        return reply.status(404).send(error(404, '市场 Skill 不存在'))
      }
      const entry = entries[idx]!
      entry.installCount += 1
      entry.updatedAt = new Date().toISOString()
      await writeMarket(server.redis, MARKET_KEY, entries)

      const resp: SkillInstallResponse = {
        name: parsed.data.name,
        installed: true,
        installCount: entry.installCount,
      }
      return reply.send(success(resp))
    },
  )

  // POST /skills/:name/rate — 评分(score 1-5)
  server.post<{ Params: { name: string } }>(
    '/skills/:name/rate',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!

      const paramParsed = nameParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const bodyParsed = rateSchema.safeParse(request.body)
      if (!bodyParsed.success) {
        return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
      }

      const { score, comment } = bodyParsed.data
      const skillName = paramParsed.data.name

      const entries = await readMarket(server.redis, MARKET_KEY)
      const entry = entries.find((e) => e.name === skillName)
      if (!entry) {
        return reply.status(404).send(error(404, '市场 Skill 不存在'))
      }

      const ratingKey = `skills-rating:${skillName}`
      const ratings = await readRatings(server.redis, ratingKey)
      const rating: SkillRating = {
        id: randomUUID(),
        userId: Number(userId),
        userName: `user-${userId}`,
        skillName,
        score,
        comment,
        createdAt: new Date().toISOString(),
      }
      ratings.push(rating)
      await writeRatings(server.redis, ratingKey, ratings)

      // 更新市场条目的平均分 + 评分人数
      const totalScore = ratings.reduce((sum, r) => sum + r.score, 0)
      entry.rating = Math.round((totalScore / ratings.length) * 100) / 100
      entry.ratingCount = ratings.length
      entry.updatedAt = rating.createdAt
      await writeMarket(server.redis, MARKET_KEY, entries)

      return reply.status(201).send(success(rating))
    },
  )

  // GET /skills/:name/ratings — 评分列表
  server.get<{ Params: { name: string } }>(
    '/skills/:name/ratings',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return

      const parsed = nameParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const ratingKey = `skills-rating:${parsed.data.name}`
      const ratings = await readRatings(server.redis, ratingKey)
      return reply.send(success({ ratings, total: ratings.length }))
    },
  )
}
