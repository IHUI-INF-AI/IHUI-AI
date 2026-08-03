/**
 * Clawdbot 路由
 *
 * 暴露核心 clawdbot API 端点。
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { checkAuth } from '../plugins/auth.js'
import {
  getClawdbotService,
  getToolExecutor,
  getTaskExecutor,
  getMemoryService,
  getSkillManager,
  getModelManager,
  getSystemService,
  getChannelManager,
  getCanvasService,
  getMcpClient,
  getPairingService,
  getVoiceService,
  getBrowserAutomation,
  getIntegrationManager,
  getSelfEvolutionEngine,
  type MemoryItem,
  type MemoryQuery,
} from '../services/clawdbot/index.js'

// =============================================================================
// Zod schemas —— 18 个 POST 端点 body 校验
// looseObject() 允许额外字段透传,避免破坏现有调用方
// =============================================================================

const initializeSchema = z.looseObject({
  userId: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})

const chatSchema = z.object({
  userId: z.string().min(1, 'userId 不能为空'),
  content: z.string().min(1, 'content 不能为空'),
  context: z.record(z.string(), z.unknown()).optional(),
})

const toolExecuteSchema = z.looseObject({
  params: z.record(z.string(), z.unknown()).optional(),
  context: z.unknown().optional(),
})

const taskCreateSchema = z.looseObject({
  name: z.string().min(1, 'name 不能为空'),
  description: z.string().min(1, 'description 不能为空'),
  steps: z.array(z.unknown()),
  context: z.record(z.string(), z.unknown()).optional(),
})

const memoryStoreSchema = z.looseObject({
  type: z.enum(['short_term', 'long_term', 'working', 'episodic']),
  content: z.string().min(1, 'content 不能为空'),
  importance: z.number().min(0).max(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  expiresAt: z.number().optional(),
  tags: z.array(z.string()).optional(),
  embedding: z.array(z.number()).optional(),
})

const modelCompleteSchema = z.record(z.string(), z.unknown())

const channelSendSchema = z.looseObject({
  content: z.string().min(1, 'content 不能为空'),
  userId: z.string().optional(),
})

const canvasExecuteSchema = z.looseObject({
  inputs: z.record(z.string(), z.unknown()).optional(),
})

const mcpCallSchema = z.looseObject({
  args: z.record(z.string(), z.unknown()).optional(),
})

const pairingRequestSchema = z.looseObject({
  userId: z.string().optional(),
  deviceId: z.string().optional(),
  channelType: z.string().optional(),
})

const pairingConfirmSchema = z.object({
  code: z.string().min(1, 'code 不能为空'),
  userId: z.string().min(1, 'userId 不能为空'),
  deviceId: z.string().min(1, 'deviceId 不能为空'),
  channelType: z.string().min(1, 'channelType 不能为空'),
})

const voiceAsrSchema = z.looseObject({
  audio: z.union([z.string(), z.instanceof(Buffer)]),
  format: z.enum(['wav', 'mp3', 'ogg', 'pcm']).optional(),
  sampleRate: z.number().optional(),
  language: z.string().optional(),
})

const voiceTtsSchema = z.looseObject({
  text: z.string().min(1, 'text 不能为空'),
  voice: z.string().optional(),
  speed: z.number().optional(),
  pitch: z.number().optional(),
  format: z.enum(['wav', 'mp3', 'ogg']).optional(),
})

const browserNavigateSchema = z.looseObject({
  url: z.url({ error: 'url 必须为合法 URL' }),
  headers: z.record(z.string(), z.string()).optional(),
  timeout: z.number().int().positive().optional(),
})

const browserScrapeSchema = z.looseObject({
  url: z.url({ error: 'url 必须为合法 URL' }),
  selector: z.string().optional(),
  extract: z.array(z.record(z.string(), z.unknown())).optional(),
  headers: z.record(z.string(), z.string()).optional(),
})

const integrationCallSchema = z.looseObject({
  integrationId: z.string().min(1, 'integrationId 不能为空'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().min(1, 'path 不能为空'),
  body: z.unknown().optional(),
  query: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
})

const evolutionEvolveSchema = z.looseObject({
  gapId: z.string().optional(),
})

/** 统一 safeParse 失败响应:ok=false 表示已回复 400,调用方应 return */
function validateBody<T>(
  schema: z.ZodType<T, unknown>,
  body: unknown,
  reply: FastifyReply,
): { ok: true; data: T } | { ok: false } {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? '参数错误'
    reply.status(400).send(error(400, msg))
    return { ok: false }
  }
  return { ok: true, data: parsed.data }
}

export const clawdbotRoutes: FastifyPluginAsync = async (server) => {
  // ===========================================================================
  // Clawdbot 主服务
  // ===========================================================================
  server.get('/clawdbot/status', async (_req, reply) => {
    if (!(await checkAuth(_req, reply))) return
    return success(getClawdbotService().getStatus())
  })

  server.post('/clawdbot/initialize', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(initializeSchema, req.body, reply)
    if (!parsed.ok) return
    await getClawdbotService().initialize(parsed.data as never)
    return success({ initialized: true })
  })

  server.post('/clawdbot/shutdown', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    await getClawdbotService().shutdown()
    return success({ shutdown: true })
  })

  server.post('/clawdbot/chat', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(chatSchema, req.body, reply)
    if (!parsed.ok) return
    const { userId, content } = parsed.data
    const response = await getClawdbotService().chat(userId, content)
    return success(response)
  })

  // ===========================================================================
  // 工具系统
  // ===========================================================================
  server.get('/clawdbot/tools', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getToolExecutor().getAllTools())
  })

  server.post('/clawdbot/tools/:name/execute', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const { name } = req.params as { name: string }
    const parsed = validateBody(toolExecuteSchema, req.body, reply)
    if (!parsed.ok) return
    const { params, context } = parsed.data
    const result = await getToolExecutor().execute(name, params ?? {}, context as never)
    return success(result)
  })

  // ===========================================================================
  // 任务执行器
  // ===========================================================================
  server.get('/clawdbot/tasks', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const query = req.query as { status?: string; priority?: string }
    return success(getTaskExecutor().list(query as never))
  })

  server.post('/clawdbot/tasks', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(taskCreateSchema, req.body, reply)
    if (!parsed.ok) return
    const task = getTaskExecutor().create(parsed.data as never)
    return success(task)
  })

  server.post('/clawdbot/tasks/:id/execute', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const { id } = req.params as { id: string }
    const result = await getTaskExecutor().execute(id)
    return success(result)
  })

  // ===========================================================================
  // 记忆服务
  // ===========================================================================
  server.get('/clawdbot/memory', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const query = req.query as never as MemoryQuery
    const userId = req.userId!
    // 优先返回用户桶 + DB long_term 结果;失败降级到默认内存桶
    try {
      return success(await getMemoryService().searchForUser(userId, query))
    } catch {
      return success(getMemoryService().search(query))
    }
  })

  server.post('/clawdbot/memory', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const userId = req.userId!
    const parsed = validateBody(memoryStoreSchema, req.body, reply)
    if (!parsed.ok) return
    const body = parsed.data as Omit<
      MemoryItem,
      'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'
    >
    try {
      return success(await getMemoryService().storeForUser(userId, body))
    } catch {
      return success(getMemoryService().store(body))
    }
  })

  // ===========================================================================
  // 技能系统
  // ===========================================================================
  server.get('/clawdbot/skills', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getSkillManager().list())
  })

  server.post('/clawdbot/skills/:name/execute', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const { name } = req.params as { name: string }
    const parsed = validateBody(toolExecuteSchema, req.body, reply)
    if (!parsed.ok) return
    const { params, context } = parsed.data
    const result = await getSkillManager().execute(name, params ?? {}, context as never)
    return success(result)
  })

  // ===========================================================================
  // 模型管理
  // ===========================================================================
  server.get('/clawdbot/models', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getModelManager().list())
  })

  server.post('/clawdbot/models/complete', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(modelCompleteSchema, req.body, reply)
    if (!parsed.ok) return
    const result = await getModelManager().complete(parsed.data as never)
    return success(result)
  })

  // ===========================================================================
  // 系统服务
  // ===========================================================================
  server.get('/clawdbot/system/health', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getSystemService().getHealth())
  })

  // 兼容前端旧路径 /admin/clawdbot/health
  server.get('/clawdbot/health', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getSystemService().getHealth())
  })

  server.get('/clawdbot/system/metrics', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getSystemService().getMetrics())
  })

  server.get('/clawdbot/system/logs', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const query = req.query as never
    return success(getSystemService().getLogs(query))
  })

  // ===========================================================================
  // 渠道管理
  // ===========================================================================
  server.get('/clawdbot/channels', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getChannelManager().list())
  })

  server.post('/clawdbot/channels/:id/send', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const { id } = req.params as { id: string }
    const parsed = validateBody(channelSendSchema, req.body, reply)
    if (!parsed.ok) return
    const { content, userId } = parsed.data
    const sent = await getChannelManager().sendMessage(id, content, userId)
    return success({ sent })
  })

  // ===========================================================================
  // 画布服务
  // ===========================================================================
  server.get('/clawdbot/canvas', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getCanvasService().list())
  })

  server.post('/clawdbot/canvas/:id/execute', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const { id } = req.params as { id: string }
    const parsed = validateBody(canvasExecuteSchema, req.body, reply)
    if (!parsed.ok) return
    const { inputs } = parsed.data
    const result = await getCanvasService().execute(id, inputs ?? {})
    return success(result)
  })

  // ===========================================================================
  // MCP 协议
  // ===========================================================================
  server.get('/clawdbot/mcp/servers', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getMcpClient().listServers())
  })

  server.get('/clawdbot/mcp/tools', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getMcpClient().listTools())
  })

  server.post('/clawdbot/mcp/tools/:name/call', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const { name } = req.params as { name: string }
    const parsed = validateBody(mcpCallSchema, req.body, reply)
    if (!parsed.ok) return
    const { args } = parsed.data
    const result = await getMcpClient().callTool(name, args ?? {})
    return success(result)
  })

  // ===========================================================================
  // 配对服务
  // ===========================================================================
  server.post('/clawdbot/pairing/request', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(pairingRequestSchema, req.body, reply)
    if (!parsed.ok) return
    return success(getPairingService().createRequest(parsed.data))
  })

  server.post('/clawdbot/pairing/confirm', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(pairingConfirmSchema, req.body, reply)
    if (!parsed.ok) return
    const { code, userId, deviceId, channelType } = parsed.data
    const session = getPairingService().confirmPairing(code, userId, deviceId, channelType)
    if (!session) {
      reply.status(400).send(error(400, 'Invalid or expired pairing code'))
      return
    }
    return success(session)
  })

  // ===========================================================================
  // 语音服务
  // ===========================================================================
  server.post('/clawdbot/voice/asr', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(voiceAsrSchema, req.body, reply)
    if (!parsed.ok) return
    const result = await getVoiceService().asr(parsed.data as never)
    return success(result)
  })

  server.post('/clawdbot/voice/tts', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(voiceTtsSchema, req.body, reply)
    if (!parsed.ok) return
    const result = await getVoiceService().tts(parsed.data as never)
    return success(result)
  })

  // ===========================================================================
  // 浏览器自动化
  // ===========================================================================
  server.post('/clawdbot/browser/navigate', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(browserNavigateSchema, req.body, reply)
    if (!parsed.ok) return
    const { url, headers, timeout } = parsed.data
    const page = await getBrowserAutomation().navigate(url, { headers, timeout })
    return success(page)
  })

  server.post('/clawdbot/browser/scrape', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(browserScrapeSchema, req.body, reply)
    if (!parsed.ok) return
    const result = await getBrowserAutomation().scrape(parsed.data as never)
    return success(result)
  })

  // ===========================================================================
  // 集成服务
  // ===========================================================================
  server.get('/clawdbot/integrations', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getIntegrationManager().list())
  })

  server.post('/clawdbot/integrations/call', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(integrationCallSchema, req.body, reply)
    if (!parsed.ok) return
    try {
      const result = await getIntegrationManager().call(parsed.data as never)
      return success(result)
    } catch (err) {
      reply.status(500).send(error(500, (err as Error).message))
    }
  })

  // ===========================================================================
  // 自我进化
  // ===========================================================================
  server.get('/clawdbot/evolution/status', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getSelfEvolutionEngine().getStatus())
  })

  server.post('/clawdbot/evolution/evolve', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const parsed = validateBody(evolutionEvolveSchema, req.body, reply)
    if (!parsed.ok) return
    const { gapId } = parsed.data
    const task = await getSelfEvolutionEngine().evolve(gapId)
    return success(task)
  })

  server.get('/clawdbot/evolution/gaps', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const { includeResolved } = req.query as { includeResolved?: string }
    return success(getSelfEvolutionEngine().listGaps(includeResolved === 'true'))
  })
}

export default clawdbotRoutes
