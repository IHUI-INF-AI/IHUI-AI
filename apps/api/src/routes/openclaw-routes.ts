/**
 * OpenClaw 控制台路由 — 8 面板后端端点。
 *
 * 现有 /api/openclaw (列表) + /api/openclaw/:id (详情) 由 missing-user-routes.ts 提供。
 * 本路由补齐 memory / skills / automation / channels / tools / gateway / sessions / stats 端点,
 * 让前端 8 个面板可联调(不 404)。
 *
 * 数据策略:
 * - memory: 进程内存 Map(userId → MemoryItem[]),重启后失效,满足前端联调
 * - skills / channels / tools: 预定义种子数据,稳定可复现
 * - automation (cron/webhook/hook): 进程内存 Map
 * - gateway: 返回 online + 配置
 * - sessions / stats: 空列表 + 0 统计(无真实业务数据)
 *
 * 所有端点需要登录(authenticate preHandler)。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

// ===== 类型 =====

type MemoryType = 'fact' | 'preference' | 'event'

interface MemoryItem {
  id: string
  type: MemoryType
  content: string
  createdAt: string
}

interface SkillItem {
  id: string
  name: string
  description: string
  installed: boolean
}

interface ChannelItem {
  id: string
  type: string
  name: string
  connected: boolean
}

interface ToolItem {
  name: string
  description: string
  category: string
}

interface CronJobItem {
  id: string
  name: string
  schedule: string
  task: string
  enabled: boolean
}

interface WebhookItem {
  id: string
  name: string
  endpoint: string
  events: string
  enabled: boolean
}

interface HookItem {
  id: string
  type: string
  name: string
  handler: string
  enabled: boolean
}

// ===== 内存存储(进程级,重启失效) =====

const memoryStore = new Map<string, MemoryItem[]>()
const cronStore = new Map<string, CronJobItem[]>()
const webhookStore = new Map<string, WebhookItem[]>()
const hookStore = new Map<string, HookItem[]>()

// ===== 种子数据 =====

const SEED_SKILLS: SkillItem[] = [
  {
    id: 'skill-web-search',
    name: 'Web Search',
    description: '搜索互联网获取最新信息',
    installed: true,
  },
  {
    id: 'skill-code-exec',
    name: 'Code Executor',
    description: '执行 Python/JavaScript 代码片段',
    installed: true,
  },
  { id: 'skill-file-ops', name: 'File Operations', description: '读写本地文件', installed: false },
  {
    id: 'skill-image-gen',
    name: 'Image Generator',
    description: '生成图像(DALL-E/Stable Diffusion)',
    installed: false,
  },
  { id: 'skill-rag', name: 'RAG Retriever', description: '从知识库检索相关文档', installed: true },
  { id: 'skill-sql', name: 'SQL Assistant', description: '自然语言转 SQL 查询', installed: false },
]

const SEED_CHANNELS: ChannelItem[] = [
  { id: 'ch-wechat', type: 'wechat', name: '微信公众号', connected: true },
  { id: 'ch-dingtalk', type: 'dingtalk', name: '钉钉机器人', connected: false },
  { id: 'ch-feishu', type: 'feishu', name: '飞书机器人', connected: false },
  { id: 'ch-web', type: 'web', name: 'Web Widget', connected: true },
]

const SUPPORTED_CHANNELS: ChannelItem[] = [
  { id: 'sup-wechat', type: 'wechat', name: '微信公众号', connected: false },
  { id: 'sup-wechat-mp', type: 'wechat_mp', name: '微信小程序', connected: false },
  { id: 'sup-dingtalk', type: 'dingtalk', name: '钉钉', connected: false },
  { id: 'sup-feishu', type: 'feishu', name: '飞书', connected: false },
  { id: 'sup-web', type: 'web', name: 'Web', connected: false },
  { id: 'sup-api', type: 'api', name: 'API 接入', connected: false },
]

const SEED_TOOLS: ToolItem[] = [
  { name: 'browser_navigate', description: '导航到指定 URL', category: 'browser' },
  { name: 'browser_click', description: '点击页面元素', category: 'browser' },
  { name: 'browser_extract', description: '提取页面内容', category: 'browser' },
  { name: 'canvas_draw', description: '在画布上绘制', category: 'canvas' },
  { name: 'canvas_export', description: '导出画布为图片', category: 'canvas' },
  { name: 'voice_stt', description: '语音转文字', category: 'voice' },
  { name: 'voice_tts', description: '文字转语音', category: 'voice' },
]

// ===== 辅助函数 =====

function getUserId(request: FastifyRequest): string {
  const user = (request as FastifyRequest & { user?: { id?: string; userId?: string } }).user
  return user?.id ?? user?.userId ?? 'anonymous'
}

function getMemories(userId: string): MemoryItem[] {
  if (!memoryStore.has(userId)) memoryStore.set(userId, [])
  return memoryStore.get(userId)!
}

// ===== 路由插件 =====

export const openclawRoutes: FastifyPluginAsync = async (server) => {
  // 所有路由都需要登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }
  })

  // ========== Memory ==========

  server.get('/openclaw/memory/context', async (request, reply) => {
    const userId = getUserId(request)
    const memories = getMemories(userId)
    return reply.send(success({ memories, count: memories.length }))
  })

  server.post('/openclaw/memory/search', async (request, reply) => {
    const userId = getUserId(request)
    const body = z.object({ keyword: z.string().min(1).max(200) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, 'keyword 参数错误'))
    const memories = getMemories(userId).filter((m) =>
      m.content.toLowerCase().includes(body.data.keyword.toLowerCase()),
    )
    return reply.send(success({ memories, count: memories.length }))
  })

  server.post('/openclaw/memory', async (request, reply) => {
    const userId = getUserId(request)
    const body = z
      .object({
        type: z.enum(['fact', 'preference', 'event']),
        content: z.string().min(1).max(2000),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const item: MemoryItem = {
      id: randomUUID(),
      type: body.data.type,
      content: body.data.content,
      createdAt: new Date().toISOString(),
    }
    getMemories(userId).push(item)
    return reply.send(success(item))
  })

  server.delete('/openclaw/memory', async (request, reply) => {
    const userId = getUserId(request)
    memoryStore.set(userId, [])
    return reply.send(success({ cleared: true }))
  })

  // ========== Skills ==========

  server.get('/openclaw/skills', async (_request, reply) => {
    return reply.send(success({ skills: SEED_SKILLS }))
  })

  server.get('/openclaw/skills/installed', async (_request, reply) => {
    return reply.send(success({ skills: SEED_SKILLS.filter((s) => s.installed) }))
  })

  server.post('/openclaw/skills/:id/install', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const skill = SEED_SKILLS.find((s) => s.id === id)
    if (!skill) return reply.status(404).send(error(404, '技能不存在'))
    skill.installed = true
    return reply.send(success({ installed: true }))
  })

  server.post('/openclaw/skills/:id/uninstall', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const skill = SEED_SKILLS.find((s) => s.id === id)
    if (!skill) return reply.status(404).send(error(404, '技能不存在'))
    skill.installed = false
    return reply.send(success({ uninstalled: true }))
  })

  // ========== Automation (tasks / cron / webhook / hook) ==========

  server.get('/openclaw/tasks', async (request, reply) => {
    const userId = getUserId(request)
    return reply.send(
      success({
        cronJobs: cronStore.get(userId) ?? [],
        webhooks: webhookStore.get(userId) ?? [],
        hooks: hookStore.get(userId) ?? [],
      }),
    )
  })

  server.post('/openclaw/tasks/:id/execute', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const userId = getUserId(request)
    const body = request.body as Record<string, unknown> | null

    if (id === 'cron') {
      const input = z
        .object({ name: z.string(), schedule: z.string(), task: z.string() })
        .safeParse(body)
      if (!input.success) return reply.status(400).send(error(400, '参数错误'))
      if (!cronStore.has(userId)) cronStore.set(userId, [])
      const item: CronJobItem = {
        id: randomUUID(),
        name: input.data.name,
        schedule: input.data.schedule,
        task: input.data.task,
        enabled: true,
      }
      cronStore.get(userId)!.push(item)
      return reply.send(success(item))
    }

    if (id === 'webhook') {
      const input = z
        .object({ name: z.string(), endpoint: z.string(), events: z.string().optional() })
        .safeParse(body)
      if (!input.success) return reply.status(400).send(error(400, '参数错误'))
      if (!webhookStore.has(userId)) webhookStore.set(userId, [])
      const item: WebhookItem = {
        id: randomUUID(),
        name: input.data.name,
        endpoint: input.data.endpoint,
        events: input.data.events ?? '*',
        enabled: true,
      }
      webhookStore.get(userId)!.push(item)
      return reply.send(success(item))
    }

    if (id === 'hook') {
      const input = z
        .object({ type: z.string(), name: z.string(), handler: z.string() })
        .safeParse(body)
      if (!input.success) return reply.status(400).send(error(400, '参数错误'))
      if (!hookStore.has(userId)) hookStore.set(userId, [])
      const item: HookItem = {
        id: randomUUID(),
        type: input.data.type,
        name: input.data.name,
        handler: input.data.handler,
        enabled: true,
      }
      hookStore.get(userId)!.push(item)
      return reply.send(success(item))
    }

    return reply.status(400).send(error(400, `不支持的 task 类型: ${id}`))
  })

  server.delete('/openclaw/tasks/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const userId = getUserId(request)
    for (const store of [cronStore, webhookStore, hookStore]) {
      const list = store.get(userId)
      if (!list) continue
      const idx = list.findIndex((item) => item.id === id)
      if (idx >= 0) {
        list.splice(idx, 1)
        return reply.send(success({ deleted: true }))
      }
    }
    return reply.status(404).send(error(404, '任务不存在'))
  })

  // ========== Channels ==========

  server.get('/openclaw/channels', async (_request, reply) => {
    return reply.send(success({ channels: SEED_CHANNELS }))
  })

  server.post('/openclaw/channels', async (request, reply) => {
    const body = z.object({ type: z.string(), name: z.string() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const item: ChannelItem = {
      id: `ch-${Date.now()}`,
      type: body.data.type,
      name: body.data.name,
      connected: false,
    }
    SEED_CHANNELS.push(item)
    return reply.send(success(item))
  })

  server.get('/openclaw/channels/supported', async (_request, reply) => {
    return reply.send(success({ channels: SUPPORTED_CHANNELS }))
  })

  server.delete('/openclaw/channels/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const idx = SEED_CHANNELS.findIndex((c) => c.id === id)
    if (idx < 0) return reply.status(404).send(error(404, '渠道不存在'))
    SEED_CHANNELS.splice(idx, 1)
    return reply.send(success({ deleted: true }))
  })

  server.post('/openclaw/channels/:id/connect', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const ch = SEED_CHANNELS.find((c) => c.id === id)
    if (!ch) return reply.status(404).send(error(404, '渠道不存在'))
    ch.connected = true
    return reply.send(success({ connected: true }))
  })

  server.post('/openclaw/channels/:id/disconnect', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const ch = SEED_CHANNELS.find((c) => c.id === id)
    if (!ch) return reply.status(404).send(error(404, '渠道不存在'))
    ch.connected = false
    return reply.send(success({ disconnected: true }))
  })

  // ========== Tools ==========

  server.get('/openclaw/tools', async (_request, reply) => {
    return reply.send(success({ tools: SEED_TOOLS }))
  })

  server.post('/openclaw/tools/:name/execute', async (request, reply) => {
    const { name } = z.object({ name: z.string() }).parse(request.params)
    const tool = SEED_TOOLS.find((t) => t.name === name)
    if (!tool) return reply.status(404).send(error(404, `工具不存在: ${name}`))
    // 返回执行确认(真实执行由 ai-service 负责)
    return reply.send(
      success({
        executed: true,
        tool: name,
        args: request.body ?? {},
        result: `工具 ${name} 执行成功(模拟)`,
      }),
    )
  })

  // ========== Gateway ==========

  server.get('/openclaw/gateway/status', async (_request, reply) => {
    return reply.send(
      success({
        status: 'online',
        uptime: Math.floor(process.uptime()),
        version: '1.0.0',
        nodes: 1,
      }),
    )
  })

  server.get('/openclaw/gateway/health', async (_request, reply) => {
    return reply.send(
      success({
        healthy: true,
        checks: [
          { name: 'database', status: 'ok' },
          { name: 'redis', status: 'ok' },
          { name: 'ai-service', status: 'ok' },
        ],
      }),
    )
  })

  server.get('/openclaw/gateway/config', async (_request, reply) => {
    return reply.send(
      success({
        maxConcurrentSessions: 100,
        sessionTimeout: 1800,
        defaultModel: 'stepfun/step-3.7-flash',
        features: {
          memory: true,
          skills: true,
          automation: true,
          multiChannel: true,
        },
      }),
    )
  })

  server.post('/openclaw/gateway/restart', async (_request, reply) => {
    return reply.send(success({ restarted: true }))
  })

  // ========== Sessions ==========

  server.get('/openclaw/sessions', async (_request, reply) => {
    // 无真实会话表,返回空列表
    return reply.send(success({ sessions: [], total: 0 }))
  })

  server.get('/openclaw/sessions/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    return reply.status(404).send(error(404, `会话不存在: ${id}`))
  })

  server.get('/openclaw/sessions/:id/messages', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    return reply.status(404).send(error(404, `会话不存在: ${id}`))
  })

  server.post('/openclaw/sessions/:id/end', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params)
    return reply.send(success({ ended: true, sessionId: id }))
  })

  // ========== Stats ==========

  server.get('/openclaw/stats/usage', async (_request, reply) => {
    return reply.send(
      success({
        totalRequests: 0,
        totalTokens: 0,
        activeSessions: 0,
        period: '24h',
      }),
    )
  })

  server.get('/openclaw/stats/tokens', async (_request, reply) => {
    return reply.send(
      success({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        period: '24h',
      }),
    )
  })
}
