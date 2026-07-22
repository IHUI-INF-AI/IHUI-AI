/**
 * Clawdbot 路由
 *
 * 暴露核心 clawdbot API 端点。
 */
import type { FastifyPluginAsync } from 'fastify'
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
    await getClawdbotService().initialize(req.body as never)
    return success({ initialized: true })
  })

  server.post('/clawdbot/shutdown', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    await getClawdbotService().shutdown()
    return success({ shutdown: true })
  })

  server.post('/clawdbot/chat', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const { userId, content } = req.body as { userId: string; content: string }
    if (!userId || !content) {
      reply.status(400).send(error(400, 'userId and content are required'))
      return
    }
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
    const { params, context } =
      (req.body as { params?: Record<string, unknown>; context?: unknown }) ?? {}
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
    const body = req.body as {
      name: string
      description: string
      steps: never[]
      context?: Record<string, unknown>
    }
    const task = getTaskExecutor().create(body)
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
    const query = (req.query as never) as MemoryQuery
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
    const body = req.body as Omit<MemoryItem, 'id' | 'createdAt' | 'lastAccessedAt' | 'accessCount'>
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
    const { params, context } =
      (req.body as { params?: Record<string, unknown>; context?: unknown }) ?? {}
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
    const result = await getModelManager().complete(req.body as never)
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
    const { content, userId } = req.body as { content: string; userId?: string }
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
    const { inputs } = (req.body as { inputs?: Record<string, unknown> }) ?? {}
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
    const { args } = (req.body as { args?: Record<string, unknown> }) ?? {}
    const result = await getMcpClient().callTool(name, args ?? {})
    return success(result)
  })

  // ===========================================================================
  // 配对服务
  // ===========================================================================
  server.post('/clawdbot/pairing/request', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    return success(getPairingService().createRequest(req.body as never))
  })

  server.post('/clawdbot/pairing/confirm', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const { code, userId, deviceId, channelType } = req.body as {
      code: string
      userId: string
      deviceId: string
      channelType: string
    }
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
    const result = await getVoiceService().asr(req.body as never)
    return success(result)
  })

  server.post('/clawdbot/voice/tts', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const result = await getVoiceService().tts(req.body as never)
    return success(result)
  })

  // ===========================================================================
  // 浏览器自动化
  // ===========================================================================
  server.post('/clawdbot/browser/navigate', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const { url, headers, timeout } = req.body as {
      url: string
      headers?: Record<string, string>
      timeout?: number
    }
    const page = await getBrowserAutomation().navigate(url, { headers, timeout })
    return success(page)
  })

  server.post('/clawdbot/browser/scrape', async (req, reply) => {
    if (!(await checkAuth(req, reply))) return
    const result = await getBrowserAutomation().scrape(req.body as never)
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
    try {
      const result = await getIntegrationManager().call(req.body as never)
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
    const { gapId } = (req.body as { gapId?: string }) ?? {}
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
