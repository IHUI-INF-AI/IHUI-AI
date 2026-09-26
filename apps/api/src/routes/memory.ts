// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *  - GET    /memory/graph      记忆图谱子图(P3 #41 面板数据源;代理 ai-service 8803)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { MemoryEntry, MemoryScope, MemoryEntryType } from '@ihui/types'
import { checkAuthOrInternalService } from '../plugins/auth.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
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

/** 记忆图谱查询参数(P3 #41)。 */
const graphQuerySchema = z.object({
  query: z.string().trim().min(1, 'query 不能为空'),
})

/** ai-service 记忆图谱统一响应 {code, message, data}。 */
interface MemoryGraphResp {
  code?: number
  message?: string
  data?: {
    nodes?: Array<{ id: string; content: string; importanceScore: string; hit: boolean }>
    edges?: Array<{ source: string; target: string; relation: string; weight: string }>
  }
}

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
    if (!(await checkAuthOrInternalService(request, reply))) return
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
      const lists = await Promise.all(
        SCOPES.map((s) => readEntries(server.redis, buildKey(userId, s, sessionId, projectKey))),
      )
      entries = lists.flat()
    }

    return reply.send(success({ entries, total: entries.length }))
  })

  // POST /memory — 写入一条记忆
  server.post('/memory', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuthOrInternalService(request, reply))) return
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
  server.delete<{ Params: { id: string } }>('/memory/:id', async (request, reply) => {
    if (!(await checkAuthOrInternalService(request, reply))) return
    const userId = request.userId!

    const parsed = deleteQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { scope, sessionId, projectKey } = parsed.data
    const targetScopes = scope ? [scope as MemoryScope] : SCOPES
    const targetKeys = targetScopes.map((s) => buildKey(userId, s, sessionId, projectKey))
    const lists = await Promise.all(targetKeys.map((key) => readEntries(server.redis, key)))

    for (let i = 0; i < targetScopes.length; i++) {
      const entries = lists[i]!
      const idx = entries.findIndex((e) => e.id === request.params.id)
      if (idx >= 0) {
        const removed = entries.splice(idx, 1)
        await writeEntries(server.redis, targetKeys[i]!, entries)
        return reply.send(success({ id: request.params.id, deleted: removed.length > 0 }))
      }
    }

    return reply.status(404).send(error(404, '记忆条目不存在'))
  })

  // GET /memory/graph — 记忆图谱子图(P3 #41 阶段3 前端面板的数据源;代理 ai-service 8803)
  //
  // 2026-09-17 补齐:ai-service 侧实现早已存在(`app/routers/memory_graph.py`,
  // prefix="/api" → GET /api/memory/graph,服务层 graph_service 已按
  // {nodes:[{id,content,importanceScore,hit}], edges:[{source,target,relation,weight}]}
  // 返回),web 端 `memory-graph-panel.tsx` 也在调它,但 **api 层从未注册该路由** →
  // 生产 nginx `location /api/` 直连 api(8802,不经 Next rewrite)→ 线上恒 404,
  // 记忆图谱面板永远空图。此处按 agent-canvas 的既有代理模式补通路。
  //
  // 身份:aiServiceFetch 透传用户 Authorization,ai-service 从 request.state.user_id 取值
  // (与 /api/llm/* 同源;metadata.userId 不可信)。
  server.get('/memory/graph', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuthOrInternalService(request, reply))) return
    const parsed = graphQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const resp = await aiServiceFetch(
        request,
        `/api/memory/graph?query=${encodeURIComponent(parsed.data.query)}`,
      )
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        const status = resp.status === 400 ? 400 : 502
        return reply
          .status(status)
          .send(
            error(status, `ai-service memory graph failed: ${resp.status} ${text.slice(0, 200)}`),
          )
      }
      const payload = (await resp.json()) as MemoryGraphResp
      if (payload.code !== 0) {
        return reply.status(502).send(error(502, payload.message ?? 'ai-service 响应异常'))
      }
      return reply.send(
        success({ nodes: payload.data?.nodes ?? [], edges: payload.data?.edges ?? [] }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, '记忆图谱查询失败'))
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
