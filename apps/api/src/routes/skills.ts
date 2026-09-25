// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  SkillPublishRequest,
  SkillSubscriptionResponse,
  SkillNotification,
} from '@ihui/shared/skills/market'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { config } from '../config/index.js'

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
  tags: z.array(z.string()).max(20).optional(),
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
const MARKET_SEED_RAW: Omit<SkillMarketEntry, 'enabled' | 'source' | 'ownerId'>[] = [
  {
    name: 'content_engine',
    description: '内容引擎 — 自动生成公众号文章/口播稿/短视频脚本',
    tags: ['content', 'writing', 'media'],
    icon: 'file-text',
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
    icon: 'code',
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
    icon: 'file-search',
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

/**
 * 内置种子补齐 listing 契约字段(P2-14):来源 builtin、默认在架、无归属用户。
 * ownerId 刻意留空 ⇒ owner 判定对内置条目一律判"非 owner",任何人都不能把平台
 * 内置技能下架后据为己有。
 */
const MARKET_SEED: SkillMarketEntry[] = MARKET_SEED_RAW.map((entry) => ({
  ...entry,
  enabled: true,
  source: 'builtin' as const,
}))

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

const publishSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().min(1).max(1024),
  tags: z.array(z.string().max(32)).max(20).default([]),
  author: z.string().min(1).max(64),
  version: z.string().default('1.0.0'),
  license: z.string().default('MIT'),
  content: z.string().min(1).max(65536),
})

/** listing 级上下架切换的请求体(P2-14) */
const listingSchema = z.object({
  enabled: z.boolean(),
})

async function readMarket(
  redis: {
    get: (k: string) => Promise<string | null>
    set: (k: string, v: string) => Promise<unknown>
  },
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

// ---------- 订阅/通知存储(双向索引 + 用户通知 List) ----------
// Redis key 格式:
//   skill-subscribers:<skillName>  → Set<userId>  (skill → 订阅者集合)
//   user-subscriptions:<userId>     → Set<skillName> (user → 已订阅 skill 集合)
//   skill-notifications:<userId>    → List<notification JSON> (LPUSH 头插,LRANGE 读取)
// 进程内降级:setsFallback(Map<key, Set<string>>) + notifFallback(Map<key, string[]>)

const setsFallback = new Map<string, Set<string>>()
const notifFallback = new Map<string, string[]>()

function subKey(skillName: string): string {
  return `skill-subscribers:${skillName}`
}
function userSubsKey(userId: string): string {
  return `user-subscriptions:${userId}`
}
function notifKey(userId: string): string {
  return `skill-notifications:${userId}`
}

interface RedisSetOps {
  sadd: (key: string, ...members: string[]) => Promise<number>
  srem: (key: string, ...members: string[]) => Promise<number>
  sismember: (key: string, member: string) => Promise<number>
  smembers: (key: string) => Promise<string[]>
}

async function setAdd(redis: RedisSetOps, key: string, member: string): Promise<void> {
  try {
    await redis.sadd(key, member)
  } catch {
    if (!setsFallback.has(key)) setsFallback.set(key, new Set())
    setsFallback.get(key)!.add(member)
  }
}

async function setRemove(redis: RedisSetOps, key: string, member: string): Promise<void> {
  try {
    await redis.srem(key, member)
  } catch {
    setsFallback.get(key)?.delete(member)
  }
}

async function setIsMember(redis: RedisSetOps, key: string, member: string): Promise<boolean> {
  try {
    return (await redis.sismember(key, member)) === 1
  } catch {
    return setsFallback.get(key)?.has(member) ?? false
  }
}

async function setMembers(redis: RedisSetOps, key: string): Promise<string[]> {
  try {
    return await redis.smembers(key)
  } catch {
    return Array.from(setsFallback.get(key) ?? [])
  }
}

interface RedisListOps {
  lpush: (key: string, value: string) => Promise<number>
  lrange: (key: string, start: number, stop: number) => Promise<string[]>
  del: (key: string) => Promise<number>
}

/** 向 skill 的所有订阅者推送一条更新通知 */
async function notifySubscribers(
  redis: RedisListOps & RedisSetOps,
  skillName: string,
  version: string,
): Promise<void> {
  const subscribers = await setMembers(redis, subKey(skillName))
  if (subscribers.length === 0) return
  const notification: SkillNotification = {
    id: randomUUID(),
    skillName,
    message: `${skillName} 更新到 ${version}`,
    version,
    timestamp: new Date().toISOString(),
  }
  const payload = JSON.stringify(notification)
  for (const userId of subscribers) {
    try {
      await redis.lpush(notifKey(userId), payload)
    } catch {
      if (!notifFallback.has(notifKey(userId))) notifFallback.set(notifKey(userId), [])
      notifFallback.get(notifKey(userId))!.unshift(payload)
    }
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
  server.get<{ Params: { name: string } }>('/skills/:name', async (request, reply) => {
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
  })

  // DELETE /skills/:name — 删除 skill
  server.delete<{ Params: { name: string } }>('/skills/:name', async (request, reply) => {
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
  })

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
    // listing 级下架(P2-14):显式 enabled === false 的条目对所有人隐身,只有 owner 自己
    // 仍能在列表里看见它 —— 否则他下架完就没有入口再把它上架回去。
    // 缺省字段按"在架"解释,兼容本字段落地前写入的历史条目。
    const viewerId = Number(request.userId!)
    entries = entries.filter((e) => e.enabled !== false || e.ownerId === viewerId)
    if (q) {
      const lower = q.toLowerCase()
      entries = entries.filter(
        (e) => e.name.toLowerCase().includes(lower) || e.description.toLowerCase().includes(lower),
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

  // POST /skills/:name/install — 安装 skill(installCount++ + 写入用户私有库 Hash)
  server.post<{ Params: { name: string } }>('/skills/:name/install', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

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

    // 写入用户私有库 Hash skills:<userId>,field=name,value=市场条目 JSON
    // 让安装的 skill 真正落入用户库(刷新不丢 + 可被 Agent 调用)
    // 失败不阻塞 install 响应(installCount++ 已生效),仅 warn
    try {
      await server.redis.hset(`skills:${userId}`, entry.name, JSON.stringify(entry))
    } catch (e) {
      request.log.warn({ err: e, userId, name: entry.name }, 'install: 写入用户私有库失败')
    }

    const resp: SkillInstallResponse = {
      name: parsed.data.name,
      installed: true,
      installCount: entry.installCount,
    }
    return reply.send(success(resp))
  })

  // POST /skills/:name/unlist — 从市场下架 skill(移除目录条目;前端 admin SkillMarketDialog 使用)
  server.post<{ Params: { name: string } }>('/skills/:name/unlist', async (request, reply) => {
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
    const [removed] = entries.splice(idx, 1)
    await writeMarket(server.redis, MARKET_KEY, entries)

    return reply.send(success({ name: removed!.name, unlisted: true }))
  })

  // POST /skills/:name/listing — listing 级上下架切换(P2-14,owner 专用)
  //
  // 与上面 unlist 的区别:unlist 是"从市场目录里抹掉"(admin 治理动作,不认归属),
  // 本端点是"条目还在、只是在架/不在架之间翻转",保留 installCount/rating/订阅关系。
  // 顺序必须是 先鉴权 → 再校参数 → 再校归属:归属判定要读 request.userId,
  // 放在鉴权之前拿到的永远是 undefined。
  server.post<{ Params: { name: string } }>('/skills/:name/listing', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = nameParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = listingSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }

    const entries = await readMarket(server.redis, MARKET_KEY)
    const entry = entries.find((e) => e.name === parsed.data.name)
    if (!entry) {
      return reply.status(404).send(error(404, '市场 Skill 不存在'))
    }

    // owner 判定一律服务端按 userId 校:内置/内部同步条目没有 ownerId ⇒ 无人是 owner。
    // 不得只靠前端隐藏按钮 —— 那等于把别人的上架状态交给任意登录用户。
    if (entry.ownerId === undefined || entry.ownerId !== Number(userId)) {
      return reply.status(403).send(error(403, '只有上架者本人可以切换该 Skill 的上下架状态'))
    }

    entry.enabled = bodyParsed.data.enabled
    entry.updatedAt = new Date().toISOString()
    await writeMarket(server.redis, MARKET_KEY, entries)

    return reply.send(success({ name: entry.name, enabled: entry.enabled }))
  })

  // GET /skills/:name/ownership — owner 判定所需的那个查询端点(P2-14)
  //
  // 前端按它决定"上下架"按钮是否出现(以及按钮文案),但**授权仍由上一个 POST 端点
  // 独立把住**:本端点只是让 UI 不闪一下再消失,不是安全边界。
  server.get<{ Params: { name: string } }>('/skills/:name/ownership', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = nameParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const entries = await readMarket(server.redis, MARKET_KEY)
    const entry = entries.find((e) => e.name === parsed.data.name)
    if (!entry) {
      return reply.status(404).send(error(404, '市场 Skill 不存在'))
    }

    const ownerId = entry.ownerId
    return reply.send(
      success({
        name: entry.name,
        isOwner: ownerId !== undefined && ownerId === Number(userId),
        ownerId: ownerId ?? null,
        enabled: entry.enabled !== false,
        source: entry.source ?? null,
      }),
    )
  })

  // POST /skills/market — 发布 skill 到市场(用户上架自己的 skill)
  server.post('/skills/market', async (request: FastifyRequest, reply: FastifyReply) => {
    // 内部服务调用(self-evolution 自进化同步)可通过 X-Internal-Secret 绕过 JWT
    const internalSecret = request.headers['x-internal-secret']
    const isInternal = !!config.AI_CALLBACK_SECRET && internalSecret === config.AI_CALLBACK_SECRET
    if (!isInternal) {
      if (!(await checkAuth(request, reply))) return
    }

    const parsed = publishSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = parsed.data as SkillPublishRequest

    // 归属由服务端按调用身份推导,不接受请求体自报:
    // 内部自进化同步 ⇒ source=hub 且无归属用户;登录用户上架 ⇒ source=user + ownerId。
    const publisherId = isInternal ? undefined : Number(request.userId!)

    const entries = await readMarket(server.redis, MARKET_KEY)
    const existingIdx = entries.findIndex((e) => e.name === body.name)

    // 同名 + 同作者 → 视为版本更新(更新条目 + 通知订阅者)
    if (existingIdx >= 0) {
      const existing = entries[existingIdx]!
      if (existing.author !== body.author) {
        return reply.status(409).send(error(409, '同名 Skill 已存在且作者不同'))
      }
      // 版本更新:刷新 description/tags/version/updatedAt,保留 installCount/rating
      const prevVersion = existing.version
      existing.description = body.description
      existing.tags = body.tags
      existing.version = body.version
      existing.license = body.license
      existing.updatedAt = new Date().toISOString()
      // 归属补齐:source/ownerId 落地之前上架的条目没有 owner,而作者名已由上一行
      // 409 校验把住,所以这里认领的是"作者本人补登记",不是抢注。
      // 刻意不动 enabled —— 版本更新不该把 owner 主动下架的条目偷偷放回在架。
      if (existing.ownerId === undefined && publisherId !== undefined) {
        existing.ownerId = publisherId
        existing.source = 'user'
      }
      await writeMarket(server.redis, MARKET_KEY, entries)

      // 通知所有订阅者(LPUSH 到各用户通知 List)
      if (body.version !== prevVersion) {
        await notifySubscribers(server.redis, body.name, body.version)
      }
      return reply.send(success(existing))
    }

    const now = new Date().toISOString()
    const entry: SkillMarketEntry = {
      name: body.name,
      description: body.description,
      tags: body.tags,
      author: body.author,
      version: body.version,
      license: body.license,
      installCount: 0,
      rating: 0,
      ratingCount: 0,
      createdAt: now,
      updatedAt: now,
      enabled: true,
      source: isInternal ? 'hub' : 'user',
      ownerId: publisherId,
    }
    entries.push(entry)
    await writeMarket(server.redis, MARKET_KEY, entries)

    return reply.status(201).send(success(entry))
  })

  // POST /skills/:name/rate — 评分(score 1-5)
  server.post<{ Params: { name: string } }>('/skills/:name/rate', async (request, reply) => {
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
  })

  // GET /skills/:name/ratings — 评分列表
  server.get<{ Params: { name: string } }>('/skills/:name/ratings', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return

    const parsed = nameParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const ratingKey = `skills-rating:${parsed.data.name}`
    const ratings = await readRatings(server.redis, ratingKey)
    return reply.send(success({ ratings, total: ratings.length }))
  })

  // ===================== 订阅/通知(P2-d) =====================

  // POST /skills/:name/subscribe — 订阅 skill(双向索引)
  server.post<{ Params: { name: string } }>('/skills/:name/subscribe', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = nameParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const skillName = parsed.data.name

    // 校验 skill 存在
    const entries = await readMarket(server.redis, MARKET_KEY)
    if (!entries.some((e) => e.name === skillName)) {
      return reply.status(404).send(error(404, '市场 Skill 不存在'))
    }

    await setAdd(server.redis, subKey(skillName), userId)
    await setAdd(server.redis, userSubsKey(userId), skillName)

    const subscriberCount = (await setMembers(server.redis, subKey(skillName))).length
    const resp: SkillSubscriptionResponse = { subscribed: true, subscriberCount }
    return reply.status(201).send(success(resp))
  })

  // DELETE /skills/:name/subscribe — 取消订阅
  server.delete<{ Params: { name: string } }>('/skills/:name/subscribe', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = nameParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const skillName = parsed.data.name

    await setRemove(server.redis, subKey(skillName), userId)
    await setRemove(server.redis, userSubsKey(userId), skillName)

    const subscriberCount = (await setMembers(server.redis, subKey(skillName))).length
    const resp: SkillSubscriptionResponse = { subscribed: false, subscriberCount }
    return reply.send(success(resp))
  })

  // GET /skills/:name/subscription — 查询订阅状态 + 订阅人数
  server.get<{ Params: { name: string } }>('/skills/:name/subscription', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = nameParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const skillName = parsed.data.name

    const subscribed = await setIsMember(server.redis, subKey(skillName), userId)
    const subscriberCount = (await setMembers(server.redis, subKey(skillName))).length
    const resp: SkillSubscriptionResponse = { subscribed, subscriberCount }
    return reply.send(success(resp))
  })

  // GET /skills/notifications — 当前用户的通知列表(LRANGE 0 -1)
  server.get('/skills/notifications', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const key = notifKey(userId)
    let raws: string[]
    try {
      raws = await server.redis.lrange(key, 0, -1)
    } catch {
      raws = notifFallback.get(key) ?? []
    }
    const items: SkillNotification[] = raws
      .map((r) => {
        try {
          return JSON.parse(r) as SkillNotification
        } catch {
          return null
        }
      })
      .filter((n): n is SkillNotification => n !== null)
    return reply.send(success(items))
  })

  // POST /skills/notifications/read — 标记全部已读(DEL 通知 List)
  server.post('/skills/notifications/read', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const key = notifKey(userId)
    let count = 0
    try {
      // 先读取条数再删除
      const existing = await server.redis.lrange(key, 0, -1)
      count = existing.length
      if (count > 0) await server.redis.del(key)
    } catch {
      count = notifFallback.get(key)?.length ?? 0
      notifFallback.delete(key)
    }
    return reply.send(success({ marked: count }))
  })

  // ===================== 启停(用户级启用/停用)P3-产品化 =====================
  // Redis key:skill-enabled:<userId> → Set<skillName>(该用户启用的 skill 集合)
  // 进程内降级:enabledFallback(Map<key, Set<string>>)

  const enabledFallback = new Map<string, Set<string>>()

  function enabledKey(userId: string): string {
    return `skill-enabled:${userId}`
  }

  async function readEnabled(redis: RedisSetOps, key: string): Promise<string[]> {
    try {
      return await setMembers(redis, key)
    } catch {
      return Array.from(enabledFallback.get(key) ?? [])
    }
  }

  async function addEnabled(redis: RedisSetOps, key: string, member: string): Promise<void> {
    try {
      await setAdd(redis, key, member)
    } catch {
      if (!enabledFallback.has(key)) enabledFallback.set(key, new Set())
      enabledFallback.get(key)!.add(member)
    }
  }

  async function removeEnabled(redis: RedisSetOps, key: string, member: string): Promise<void> {
    try {
      await setRemove(redis, key, member)
    } catch {
      enabledFallback.get(key)?.delete(member)
    }
  }

  // GET /skills/enabled — 当前用户已启用的 skill 名称列表(页面初始化 启停状态)
  server.get('/skills/enabled', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const enabled = await readEnabled(server.redis, enabledKey(userId))
    return reply.send(success({ enabled }))
  })

  // POST /skills/:name/enable — 启用 skill(写入用户启用集合)
  server.post<{ Params: { name: string } }>('/skills/:name/enable', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = nameParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const skillName = parsed.data.name

    // 校验 skill 存在于市场(可启用市场内任意 skill,含未安装的)
    const entries = await readMarket(server.redis, MARKET_KEY)
    if (!entries.some((e) => e.name === skillName)) {
      return reply.status(404).send(error(404, '市场 Skill 不存在'))
    }

    await addEnabled(server.redis, enabledKey(userId), skillName)
    return reply.send(success({ name: skillName, enabled: true }))
  })

  // POST /skills/:name/disable — 停用 skill(从用户启用集合移除)
  server.post<{ Params: { name: string } }>('/skills/:name/disable', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = nameParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const skillName = parsed.data.name

    await removeEnabled(server.redis, enabledKey(userId), skillName)
    return reply.send(success({ name: skillName, enabled: false }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
