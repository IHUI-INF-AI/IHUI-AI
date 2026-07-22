/**
 * 统一记忆读写路由(P0-3 api 侧)。
 *
 * 作为 cli / ai-service / api 三端记忆同步的中枢。三端通过 HTTP 同步记忆:
 *  - cli 端:文件 MEMORY.md → 调用本接口上传/拉取
 *  - ai-service:Redis 消息列表 → 调用本接口持久化
 *  - api 端:conversations 表 → 本接口提供统一读写
 *
 * Redis key 格式:memory:<userId>:<scope>:<sessionId|projectKey|global>
 * Redis 不可用时降级为进程内 Map(仅开发环境,重启失效)。
 *
 * 端点:
 *  - GET    /memory            查询当前用户记忆(可选 scope/sessionId/projectKey 筛选)
 *  - POST   /memory            写入一条记忆
 *  - DELETE /memory/:id        删除指定记忆条目
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { MemoryEntry, MemoryScope, MemoryEntryType } from '@ihui/types'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

const SCOPES: MemoryScope[] = ['global', 'user', 'session', 'project']

const createEntrySchema = z.object({
  scope: z.enum(['global', 'project', 'session', 'user']).default('session'),
  type: z
    .enum(['preference', 'convention', 'decision', 'fact', 'feedback', 'skill_ref'])
    .default('fact'),
  category: z.string().default('未分类'),
  text: z.string().min(1).max(2000),
  source: z.string().default('api'),
  sessionId: z.string().optional(),
  projectKey: z.string().optional(),
})

const listQuerySchema = z.object({
  scope: z.enum(['global', 'project', 'session', 'user']).optional(),
  sessionId: z.string().optional(),
  projectKey: z.string().optional(),
})

const deleteQuerySchema = z.object({
  scope: z.enum(['global', 'project', 'session', 'user']).optional(),
  sessionId: z.string().optional(),
  projectKey: z.string().optional(),
})

/** Redis 不可用时的进程内降级存储 */
const memFallback = new Map<string, MemoryEntry[]>()

function buildKey(
  userId: string,
  scope: MemoryScope,
  sessionId?: string,
  projectKey?: string,
): string {
  const suffix =
    scope === 'session'
      ? (sessionId ?? 'default')
      : scope === 'project'
        ? (projectKey ?? 'default')
        : scope
  return `memory:${userId}:${scope}:${suffix}`
}

async function readEntries(
  redis: { get: (k: string) => Promise<string | null> },
  key: string,
): Promise<MemoryEntry[]> {
  try {
    const raw = await redis.get(key)
    if (!raw) return []
    return JSON.parse(raw) as MemoryEntry[]
  } catch {
    return memFallback.get(key) ?? []
  }
}

async function writeEntries(
  redis: { set: (k: string, v: string) => Promise<unknown> },
  key: string,
  entries: MemoryEntry[],
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(entries))
  } catch {
    memFallback.set(key, entries)
  }
}

export const memoryRoutes: FastifyPluginAsync = async (server) => {
  // GET /memory — 查询当前用户记忆
  server.get('/memory', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { scope, sessionId, projectKey } = parsed.data
    let entries: MemoryEntry[] = []

    if (scope) {
      const key = buildKey(userId, scope, sessionId, projectKey)
      entries = await readEntries(server.redis, key)
    } else {
      // 无 scope:聚合所有作用域
      for (const s of SCOPES) {
        const key = buildKey(userId, s, sessionId, projectKey)
        entries = entries.concat(await readEntries(server.redis, key))
      }
    }

    return reply.send(success({ entries, total: entries.length }))
  })

  // POST /memory — 写入一条记忆
  server.post('/memory', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = createEntrySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { scope, type, category, text, source, sessionId, projectKey } = parsed.data
    const now = new Date().toISOString()
    const entry: MemoryEntry = {
      id: randomUUID(),
      scope,
      type: type as MemoryEntryType,
      category,
      text,
      source,
      createdAt: now,
      updatedAt: now,
    }

    const key = buildKey(userId, scope as MemoryScope, sessionId, projectKey)
    const entries = await readEntries(server.redis, key)
    entries.push(entry)
    await writeEntries(server.redis, key, entries)

    return reply.status(201).send(success(entry))
  })

  // DELETE /memory/:id — 删除指定记忆条目
  server.delete<{ Params: { id: string } }>(
    '/memory/:id',
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!

      const parsed = deleteQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const { scope, sessionId, projectKey } = parsed.data
      const targetScopes = scope ? [scope as MemoryScope] : SCOPES

      for (const s of targetScopes) {
        const key = buildKey(userId, s, sessionId, projectKey)
        const entries = await readEntries(server.redis, key)
        const idx = entries.findIndex((e) => e.id === request.params.id)
        if (idx >= 0) {
          entries.splice(idx, 1)
          await writeEntries(server.redis, key, entries)
          return reply.send(success({ id: request.params.id, deleted: true }))
        }
      }

      return reply.status(404).send(error(404, '记忆条目不存在'))
    },
  )
}
