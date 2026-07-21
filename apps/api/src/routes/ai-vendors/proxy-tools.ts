/**
 * 工具类子路由:Coze(9 端点)+ Bailian(2)+ JiMeng4(1)+ N8N(5)+ Kling(3)。
 */
import { z } from 'zod'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { SignJWT } from 'jose'
import { sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { buildSchema } from '../../utils/swagger.js'
import { verifyAccessToken } from '@ihui/auth'
import { generateCompactId } from '../../utils/crypto-random.js'
import { db } from '../../db/index.js'
import {
  createVideoTask,
  findVideoTasksByUser,
  findVideoTaskById,
  updateVideoTask,
} from '../../db/video-task-queries.js'
import {
  requireAuth,
  callVendor,
  recordUsage,
  createTask,
  requireVendorKey,
  requireVendorKeys,
  fetchWithTimeout,
  volcengineSign,
  pollVolcengineTask,
  pageSizeQuery,
  botIdParam,
  tokenQuery,
  jimengBody,
  taskIdParam,
  n8nAgentStore,
  genId,
} from './_shared.js'

const jimengVideoBody = z.object({
  prompt: z.string().min(1),
  model: z.string().default('jimeng_t2v_l30'),
})

const videoTasksQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const cozeChatBody = z.object({
  botId: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
})

const cozeWorkflowRunBody = z.object({
  workflowId: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
})

const bailianChatBody = z.object({
  prompt: z.string().optional(),
  appId: z.string().optional(),
  sessionId: z.string().optional(),
  stream: z.boolean().optional(),
})

const n8nWorkflowsBody = z.object({
  n8nDomain: z.string().optional(),
  apiKey: z.string().optional(),
})

const n8nWorkflowRunBody = z.object({
  workflowId: z.string().optional(),
  webhookPath: z.string().optional(),
  inputData: z.record(z.unknown()).optional(),
})

const n8nAddAgentBody = z.object({
  agentName: z.string().optional(),
  agentDescription: z.string().optional(),
  connectorUserId: z.string().optional(),
  agentVariables: z.record(z.unknown()).optional(),
  agentModel: z.string().optional(),
  agentAvatar: z.string().optional(),
})

const cozeWorkflowChatBody = z.object({
  text: z.string().min(1),
  sessionId: z.string().optional(),
  projectId: z.number().optional(),
  chatId: z.string().optional(),
})

const klingIdentifyBody = z.object({
  videoId: z.string().optional(),
  videoUrl: z.string().optional(),
})

const klingTaskCreateBody = z.object({
  sessionId: z.string().min(1),
  faceChoose: z.array(z.record(z.unknown())).min(1),
  externalTaskId: z.string().optional(),
  callbackUrl: z.string().optional(),
})

const n8nAddAgentDbBody = z.object({
  agentName: z.string().min(1),
  agentDescription: z.string().min(1),
  connectorUserId: z.string().min(1),
  agentVariables: z.record(z.unknown()).optional(),
  agentModel: z.string().min(1),
  agentAvatar: z.string().optional(),
})

export const toolsVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })

  // ==========================================================================
  // 7. Coze(扣子)— 8 端点
  // ==========================================================================

  // POST /coze/chat
  server.post(
    '/coze/chat',
    {
      schema: buildSchema({
        summary: 'Coze 对话',
        description: '代理调用 Coze v1/chat 接口进行智能体对话',
        tags: ['AI', 'Coze'],
        body: cozeChatBody,
      }),
    },
    async (request, reply) => {
      const body = cozeChatBody.parse(request.body)
      const data = await callVendor('coze', 'https://api.coze.cn/v1/chat', reply, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (data === null) return
      recordUsage(request.userId!, 'coze')
      return reply.send(success(data))
    },
  )

  // POST /coze/bot/create
  server.post(
    '/coze/bot/create',
    {
      schema: buildSchema({
        summary: 'Coze 创建智能体',
        description: '代理调用 Coze v1/bot/create 接口创建智能体(透传请求体)',
        tags: ['AI', 'Coze'],
      }),
    },
    async (request, reply) => {
      const data = await callVendor('coze', 'https://api.coze.cn/v1/bot/create', reply, {
        method: 'POST',
        body: JSON.stringify(request.body),
      })
      if (data === null) return
      recordUsage(request.userId!, 'coze')
      return reply.send(success(data))
    },
  )

  // GET /coze/bots
  server.get(
    '/coze/bots',
    {
      schema: buildSchema({
        summary: 'Coze 智能体列表',
        description: '代理调用 Coze v1/bots/list 接口获取智能体列表(支持 page_size)',
        tags: ['AI', 'Coze'],
      }),
    },
    async (request, reply) => {
      const query = pageSizeQuery.parse(request.query)
      const data = await callVendor(
        'coze',
        `https://api.coze.cn/v1/bots/list?${new URLSearchParams({ page_size: query.page_size ?? '20' })}`,
        reply,
        { method: 'GET' },
      )
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // GET /coze/bots/:botId
  server.get(
    '/coze/bots/:botId',
    {
      schema: buildSchema({
        summary: 'Coze 智能体详情',
        description: '代理调用 Coze v1/bot/get_online_info 接口获取智能体在线信息',
        tags: ['AI', 'Coze'],
        params: botIdParam,
      }),
    },
    async (request, reply) => {
      const { botId } = botIdParam.parse(request.params)
      const data = await callVendor(
        'coze',
        `https://api.coze.cn/v1/bot/get_online_info?bot_id=${encodeURIComponent(botId)}`,
        reply,
        { method: 'GET' },
      )
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // POST /coze/workflow/run
  server.post(
    '/coze/workflow/run',
    {
      schema: buildSchema({
        summary: 'Coze 工作流运行',
        description: '代理调用 Coze v1/workflow/run 接口运行指定工作流',
        tags: ['AI', 'Coze'],
        body: cozeWorkflowRunBody,
      }),
    },
    async (request, reply) => {
      const body = cozeWorkflowRunBody.parse(request.body)
      const data = await callVendor('coze', 'https://api.coze.cn/v1/workflow/run', reply, {
        method: 'POST',
        body: JSON.stringify({ workflow_id: body.workflowId, parameters: body.parameters }),
      })
      if (data === null) return
      recordUsage(request.userId!, 'coze')
      return reply.send(success(data))
    },
  )

  // GET /coze/workflows
  server.get(
    '/coze/workflows',
    {
      schema: buildSchema({
        summary: 'Coze 工作流列表',
        description: '代理调用 Coze v1/workflows/list 接口获取工作流列表',
        tags: ['AI', 'Coze'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor('coze', 'https://api.coze.cn/v1/workflows/list', reply, {
        method: 'GET',
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // POST /coze/knowledge/upload
  server.post(
    '/coze/knowledge/upload',
    {
      schema: buildSchema({
        summary: 'Coze 知识库文档上传',
        description: '代理调用 Coze v1/knowledge/document/create 接口上传知识库文档(透传请求体)',
        tags: ['AI', 'Coze'],
      }),
    },
    async (request, reply) => {
      const data = await callVendor(
        'coze',
        'https://api.coze.cn/v1/knowledge/document/create',
        reply,
        { method: 'POST', body: JSON.stringify(request.body) },
      )
      if (data === null) return
      recordUsage(request.userId!, 'coze')
      return reply.send(success(data))
    },
  )

  // GET /coze/knowledge/list
  server.get(
    '/coze/knowledge/list',
    {
      schema: buildSchema({
        summary: 'Coze 知识库列表',
        description: '代理调用 Coze v1/knowledge/list 接口获取知识库列表(支持 page_size)',
        tags: ['AI', 'Coze'],
      }),
    },
    async (request, reply) => {
      const query = pageSizeQuery.parse(request.query)
      const data = await callVendor(
        'coze',
        `https://api.coze.cn/v1/knowledge/list?${new URLSearchParams({ page_size: query.page_size ?? '20' })}`,
        reply,
        { method: 'GET' },
      )
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // ==========================================================================
  // 8. Bailian(百炼/阿里云)— 2 端点
  // ==========================================================================

  // POST /bailian/chat — 百炼应用对话(支持流式收集)
  server.post(
    '/bailian/chat',
    {
      schema: buildSchema({
        summary: '百炼应用对话',
        description: '代理调用百炼 text-generation/generation 接口进行应用对话(支持流式收集)',
        tags: ['AI', 'Bailian'],
        body: bailianChatBody,
      }),
    },
    async (request, reply) => {
      const body = bailianChatBody.parse(request.body)
      if (!body.prompt) return reply.status(400).send(error(400, 'prompt 为必填'))
      const key = requireVendorKey('bailian', reply)
      if (!key) return
      const appId = body.appId ?? process.env.BAILIAN_APP_ID
      if (!appId) return reply.status(400).send(error(400, '百炼应用ID 未配置(BAILIAN_APP_ID)'))
      const input: Record<string, unknown> = { prompt: body.prompt }
      if (body.sessionId) input.session_id = body.sessionId
      const payload: Record<string, unknown> = {
        model: appId,
        input,
        parameters: { incremental_output: true },
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      }
      if (body.stream) {
        headers['X-DashScope-SSE'] = 'enable'
        payload.stream = true
      }
      try {
        const resp = await fetchWithTimeout(
          'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
          { method: 'POST', headers, body: JSON.stringify(payload) },
          120_000,
        )
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}))
          return reply
            .status(502)
            .send(
              error(502, `百炼调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 500)}`),
            )
        }
        if (body.stream && resp.headers.get('content-type')?.includes('text/event-stream')) {
          const text = await resp.text()
          const chunks: string[] = []
          for (const line of text.split('\n')) {
            if (!line.startsWith('data:')) continue
            try {
              const chunk = JSON.parse(line.slice(5).trim())?.output?.text ?? ''
              if (chunk) chunks.push(chunk)
            } catch {
              /* skip */
            }
          }
          recordUsage(request.userId!, 'bailian')
          return reply.send(success({ reply: chunks.join(''), chunks, appId }))
        }
        const data = (await resp.json()) as Record<string, unknown>
        const output = data.output as Record<string, unknown> | undefined
        recordUsage(request.userId!, 'bailian')
        return reply.send(
          success({
            reply: output?.text ?? '',
            sessionId: output?.session_id ?? body.sessionId,
            appId,
            usage: data.usage ?? {},
          }),
        )
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `百炼调用异常: ${msg}`))
      }
    },
  )

  // WS /bailian/ws — 百炼应用流式对话(WebSocket)
  server.get(
    '/bailian/ws',
    {
      websocket: true,
      schema: buildSchema({
        summary: '百炼流式对话(WebSocket)',
        description: 'WebSocket 流式对话,通过 query token 自行校验,推送 chunk/completed/error 事件',
        tags: ['AI', 'Bailian'],
        querystring: tokenQuery,
        auth: false,
      }),
    },
    (socket, request) => {
      const { token } = tokenQuery.parse(request.query)
      if (!token) {
        socket.close(4001, '缺少 token')
        return
      }
      void (async () => {
        let userId: string
        try {
          userId = (await verifyAccessToken(token)).userId
        } catch {
          socket.close(4003, 'token 无效')
          return
        }
        socket.on('message', async (data: Buffer) => {
          try {
            const req = JSON.parse(data.toString()) as {
              app_id?: string
              prompt?: string
              session_id?: string
            }
            const appId = req.app_id ?? process.env.BAILIAN_APP_ID
            if (!appId) {
              socket.send(JSON.stringify({ event: 'error', message: '缺少 app_id' }))
              return
            }
            if (!req.prompt) {
              socket.send(JSON.stringify({ event: 'error', message: '缺少 prompt' }))
              return
            }
            const key = process.env.BAILIAN_API_KEY ?? process.env.DASHSCOPE_API_KEY
            if (!key) {
              socket.send(JSON.stringify({ event: 'error', message: 'API Key 未配置' }))
              return
            }
            const input: Record<string, unknown> = { prompt: req.prompt }
            if (req.session_id) input.session_id = req.session_id
            const resp = await fetchWithTimeout(
              'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${key}`,
                  'X-DashScope-SSE': 'enable',
                },
                body: JSON.stringify({
                  model: appId,
                  input,
                  parameters: { incremental_output: true },
                  stream: true,
                }),
              },
              120_000,
            )
            if (!resp.ok) {
              socket.send(
                JSON.stringify({ event: 'error', message: `百炼调用失败: ${resp.status}` }),
              )
              return
            }
            const text = await resp.text()
            let fullText = ''
            let sessionId = req.session_id
            for (const line of text.split('\n')) {
              if (!line.startsWith('data:')) continue
              try {
                const obj = JSON.parse(line.slice(5).trim())
                const chunk = obj?.output?.text ?? ''
                if (chunk) {
                  fullText += chunk
                  socket.send(JSON.stringify({ event: 'chunk', data: chunk }))
                }
                if (obj?.output?.session_id) sessionId = obj.output.session_id
              } catch {
                /* skip */
              }
            }
            recordUsage(userId, 'bailian')
            socket.send(
              JSON.stringify({ event: 'completed', full_text: fullText, session_id: sessionId }),
            )
          } catch (e) {
            socket.send(JSON.stringify({ event: 'error', message: (e as Error).message }))
          }
        })
      })()
    },
  )

  // ==========================================================================
  // 9. JiMeng4(即梦/字节AI绘画)— 1 端点
  // ==========================================================================

  // POST /jimeng4/image — 即梦4.0 文生图(异步提交+轮询)
  server.post(
    '/jimeng4/image',
    {
      schema: buildSchema({
        summary: '即梦 4.0 文生图',
        description: '代理调用火山引擎 CVSync2AsyncSubmitTask 提交即梦 v40 文生图任务并轮询结果',
        tags: ['AI', 'JiMeng4'],
        body: jimengBody,
      }),
    },
    async (request, reply) => {
      const body = jimengBody.parse(request.body)
      if (!body.prompt) return reply.status(400).send(error(400, 'prompt 为必填'))
      const keys = requireVendorKeys('jimeng4', reply)
      if (!keys) return
      const submitBody: Record<string, unknown> = {
        req_key: 'jimeng_t2i_v40',
        prompt: body.prompt,
        return_url: true,
      }
      if (body.width) submitBody.width = body.width
      if (body.height) submitBody.height = body.height
      if (body.seed !== null && body.seed !== undefined) submitBody.seed = body.seed
      try {
        const signed = volcengineSign(
          { Action: 'CVSync2AsyncSubmitTask', Version: '2022-08-31' },
          submitBody,
          keys.key,
          keys.secret,
        )
        const resp = await fetchWithTimeout(
          signed.url,
          { method: 'POST', headers: signed.headers, body: signed.body },
          120_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok)
          return reply
            .status(502)
            .send(error(502, `即梦调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`))
        const dataBlock = data.data as Record<string, unknown> | undefined
        const taskId = dataBlock?.task_id as string | undefined
        if (!taskId) return reply.status(502).send(error(502, '即梦未返回 task_id'))
        const final = await pollVolcengineTask(
          keys.key,
          keys.secret,
          'jimeng_t2i_v40',
          taskId,
          reply,
        )
        if (!final) return
        const finalData = final.data as Record<string, unknown> | undefined
        const imageUrls: string[] = Array.isArray(finalData?.image_urls)
          ? (finalData!.image_urls as string[])
          : []
        recordUsage(request.userId!, 'jimeng4')
        return reply.send(success({ image_urls: imageUrls, request_id: data.request_id }))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `即梦调用异常: ${msg}`))
      }
    },
  )

  // POST /jimeng4/video — 即梦文生视频(异步提交,落库 videoGenerationTasks)
  server.post(
    '/jimeng4/video',
    {
      schema: buildSchema({
        summary: '即梦文生视频',
        description: '代理调用火山引擎 CVSync2AsyncSubmitTask 提交即梦 t2v 文生视频任务并落库',
        tags: ['AI', 'JiMeng4'],
        body: jimengVideoBody,
      }),
    },
    async (request, reply) => {
      const body = jimengVideoBody.parse(request.body)
      const keys = requireVendorKeys('jimeng4', reply)
      if (!keys) return
      const submitBody: Record<string, unknown> = {
        req_key: body.model,
        prompt: body.prompt,
        return_url: true,
      }
      try {
        const signed = volcengineSign(
          { Action: 'CVSync2AsyncSubmitTask', Version: '2022-08-31' },
          submitBody,
          keys.key,
          keys.secret,
        )
        const resp = await fetchWithTimeout(
          signed.url,
          { method: 'POST', headers: signed.headers, body: signed.body },
          120_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok)
          return reply
            .status(502)
            .send(
              error(502, `即梦视频调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`),
            )
        const dataBlock = data.data as Record<string, unknown> | undefined
        const volcTaskId = dataBlock?.task_id as string | undefined
        if (!volcTaskId) return reply.status(502).send(error(502, '即梦视频未返回 task_id'))
        const row = await createVideoTask({
          taskId: volcTaskId,
          userUuid: request.userId!,
          status: 'accepted',
          message: body.prompt,
        })
        recordUsage(request.userId!, 'jimeng4')
        return reply.send(success({ taskId: row.id, status: 'accepted' }))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `即梦视频调用异常: ${msg}`))
      }
    },
  )

  // GET /jimeng4/video/tasks — 当前用户视频任务列表
  server.get(
    '/jimeng4/video/tasks',
    {
      schema: buildSchema({
        summary: '即梦视频任务列表',
        description: '返回当前用户的视频生成任务(分页,按创建时间倒序)',
        tags: ['AI', 'JiMeng4'],
        querystring: videoTasksQuery,
      }),
    },
    async (request, reply) => {
      const query = videoTasksQuery.parse(request.query)
      const { list, total } = await findVideoTasksByUser(request.userId!, {
        page: query.page,
        pageSize: query.pageSize,
      })
      return reply.send(success({ list, total, page: query.page, pageSize: query.pageSize }))
    },
  )

  // GET /jimeng4/video/tasks/:taskId — 任务详情(主动同步火山引擎状态)
  server.get(
    '/jimeng4/video/tasks/:taskId',
    {
      schema: buildSchema({
        summary: '即梦视频任务详情',
        description: '按 id 查询任务,若未完成则单次查询火山引擎最新状态并更新 DB',
        tags: ['AI', 'JiMeng4'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = await findVideoTaskById(taskId, request.userId!)
      if (!task) return reply.status(404).send(error(404, '任务不存在'))
      if (task.status !== 'success' && task.status !== 'failed') {
        const keys = requireVendorKeys('jimeng4', reply)
        if (keys) {
          try {
            const signed = volcengineSign(
              { Action: 'CVSync2AsyncGetResult', Version: '2022-08-31' },
              { req_key: 'jimeng_t2v_l30', task_id: task.taskId },
              keys.key,
              keys.secret,
            )
            const resp = await fetchWithTimeout(
              signed.url,
              { method: 'POST', headers: signed.headers, body: signed.body },
              60_000,
            )
            const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
            const dataBlock = data.data as Record<string, unknown> | undefined
            const remoteStatus = dataBlock?.status as string | undefined
            if (remoteStatus === 'done') {
              const videoUrls: string[] = Array.isArray(dataBlock?.video_urls)
                ? (dataBlock!.video_urls as string[])
                : Array.isArray(dataBlock?.resp_data)
                  ? (dataBlock!.resp_data as string[])
                  : []
              const updated = await updateVideoTask(task.id.toString(), {
                status: 'success',
                result: JSON.stringify({ video_urls: videoUrls, raw: dataBlock ?? {} }),
              })
              return reply.send(success({ task: updated }))
            }
            if (remoteStatus === 'not_found' || (data.code && Number(data.code) !== 0)) {
              const updated = await updateVideoTask(task.id.toString(), {
                status: 'failed',
                message: (data.message as string) || '火山引擎任务异常',
              })
              return reply.send(success({ task: updated }))
            }
            const updated = await updateVideoTask(task.id.toString(), {
              status: 'running',
              message: remoteStatus || 'processing',
            })
            return reply.send(success({ task: updated }))
          } catch (e) {
            return reply.send(success({ task, warning: `状态同步失败: ${(e as Error).message}` }))
          }
        }
      }
      return reply.send(success({ task }))
    },
  )

  // ==========================================================================
  // 10. N8N(工作流平台)— 3 端点
  // ==========================================================================

  // POST /n8n/workflows — 查询N8N工作流列表(凭据从请求体传入)
  server.post(
    '/n8n/workflows',
    {
      schema: buildSchema({
        summary: 'N8N 工作流列表(凭据透传)',
        description: '按请求体传入的 n8nDomain 和 apiKey 查询 N8N 活跃工作流列表',
        tags: ['AI', 'N8N'],
        body: n8nWorkflowsBody,
      }),
    },
    async (request, reply) => {
      const body = n8nWorkflowsBody.parse(request.body)
      if (!body.n8nDomain || !body.apiKey)
        return reply.status(400).send(error(400, 'n8nDomain 和 apiKey 为必填'))
      try {
        const resp = await fetchWithTimeout(
          `https://${body.n8nDomain}/api/v1/workflows?active=true`,
          { method: 'GET', headers: { 'X-N8N-API-KEY': body.apiKey } },
          30_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok) return reply.status(502).send(error(502, `N8N 调用失败: ${resp.status}`))
        const items = Array.isArray(data.data) ? (data.data as Record<string, unknown>[]) : []
        const formatted = items.map((item) => ({
          id: item.id,
          name: item.name,
          createdAt: item.createdAt ?? null,
          updatedAt: item.updatedAt ?? null,
        }))
        return reply.send(success(formatted))
      } catch (e) {
        return reply.status(502).send(error(502, `N8N 调用异常: ${(e as Error).message}`))
      }
    },
  )

  // POST /n8n/workflow/run — 运行N8N工作流
  server.post(
    '/n8n/workflow/run',
    {
      schema: buildSchema({
        summary: 'N8N 工作流运行',
        description: '按 workflowId 激活或按 webhookPath 触发 N8N 工作流运行',
        tags: ['AI', 'N8N'],
        body: n8nWorkflowRunBody,
      }),
    },
    async (request, reply) => {
      const body = n8nWorkflowRunBody.parse(request.body)
      const baseUrl = process.env.N8N_BASE_URL
      if (!baseUrl) return reply.status(503).send(error(503, 'N8N_BASE_URL 未配置'))
      const key = requireVendorKey('n8n', reply)
      if (!key) return
      const url = body.workflowId
        ? `${baseUrl.replace(/\/$/, '')}/api/v1/workflows/${encodeURIComponent(body.workflowId)}/activate`
        : `${baseUrl.replace(/\/$/, '')}${body.webhookPath ?? '/webhook'}`
      try {
        const resp = await fetchWithTimeout(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': key },
            body: JSON.stringify(body.inputData ?? {}),
          },
          120_000,
        )
        const data = (await resp.json().catch(() => ({ raw_response: '' }))) as unknown
        if (!resp.ok) return reply.status(502).send(error(502, `N8N 调用失败: ${resp.status}`))
        recordUsage(request.userId!, 'n8n')
        return reply.send(success(data))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `N8N 调用异常: ${msg}`))
      }
    },
  )

  // POST /n8n/addAgent — 通过N8N新增智能体(内存存储)
  server.post(
    '/n8n/addAgent',
    {
      schema: buildSchema({
        summary: 'N8N 新增智能体(内存)',
        description: '通过 N8N 接口新增智能体并写入内存存储,返回 agent_id',
        tags: ['AI', 'N8N'],
        body: n8nAddAgentBody,
      }),
    },
    async (request, reply) => {
      const body = n8nAddAgentBody.parse(request.body)
      if (!body.agentName || !body.connectorUserId)
        return reply.status(400).send(error(400, 'agentName 和 connectorUserId 为必填'))
      // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成 n8n agentId
      // 风险:Math.random 可预测 → 攻击者可枚举其他用户/工作流 agent ID → 越权访问
      const agentId = generateCompactId('n8n')
      n8nAgentStore.set(agentId, {
        agentId,
        agentName: body.agentName,
        agentDescription: body.agentDescription ?? '',
        connectorUserId: body.connectorUserId,
        agentVariables: body.agentVariables ?? {},
        agentModel: body.agentModel ?? '',
        agentAvatar: body.agentAvatar ?? '',
        source: 'n8n',
        publishStatus: 'pending',
        createdAt: Date.now(),
      })
      recordUsage(request.userId!, 'n8n')
      return reply.send(success({ agent_id: agentId }))
    },
  )

  // ==========================================================================
  // 11. Coze workflow + WebSocket 推送 + token 扣费
  // ==========================================================================

  // POST /coze/workflow/chat
  server.post(
    '/coze/workflow/chat',
    {
      schema: buildSchema({
        summary: 'Coze 工作流对话',
        description: '通过 Coze workflow 进行对话,推送通知 + 写入历史 + token 扣费',
        tags: ['AI', 'Coze'],
        body: cozeWorkflowChatBody,
      }),
    },
    async (request, reply) => {
      const body = cozeWorkflowChatBody.parse(request.body)
      const userId = request.userId!
      const cozeWorkflowUrl = process.env.COZE_WORKFLOW_URL
      const cozeWorkflowToken = process.env.COZE_WORKFLOW_TOKEN
      if (!cozeWorkflowUrl || !cozeWorkflowToken)
        return reply
          .status(503)
          .send(error(503, 'Coze workflow 未配置(COZE_WORKFLOW_URL/COZE_WORKFLOW_TOKEN)'))
      const chatId = body.chatId ?? genId('coze')
      const sessionId = body.sessionId ?? genId('session')
      const projectId = body.projectId ?? 0
      try {
        server.pushNotification(userId, {
          type: 'coze_workflow',
          event: 'user',
          chatId,
          status: 'run',
          message: [{ type: 'text', text: body.text, role: 'user' }],
        })
      } catch {
        /* 推送失败不阻塞 */
      }
      let answerContent = ''
      try {
        const resp = await fetchWithTimeout(
          cozeWorkflowUrl,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cozeWorkflowToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: { query: { prompt: [{ type: 'text', content: { text: body.text } }] } },
              type: 'query',
              session_id: sessionId,
              project_id: projectId,
            }),
          },
          120_000,
        )
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '')
          return reply
            .status(502)
            .send(error(502, `Coze workflow 失败: ${resp.status} ${errText.slice(0, 200)}`))
        }
        const text = await resp.text()
        for (const line of text.split('\n')) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line) as Record<string, unknown>
            const content = data.content as Record<string, unknown> | undefined
            if (content && typeof content.answer === 'string') answerContent += content.answer
          } catch {
            answerContent += line
          }
        }
        try {
          server.pushNotification(userId, {
            type: 'coze_workflow',
            event: 'chat_result',
            chatId,
            status: 'stop',
            message: [{ type: 'text', text: answerContent }],
          })
        } catch {
          /* ignore */
        }
        const estimatedTokens = body.text.length + answerContent.length
        try {
          const tokenBalance = server.tokenBalance
          if (tokenBalance) {
            await tokenBalance.deductTokens(
              userId,
              Math.max(1, Math.ceil(estimatedTokens / 1000)),
              'coze_workflow_chat',
            )
          }
        } catch {
          /* 扣费失败不阻塞 */
        }
        try {
          await db.execute(sql`
          INSERT INTO coze_chat_history (uuid, bot_id, conversation_id, problem, answer, chat_id, created_at)
          VALUES (${userId}, 'coze_workflow', ${sessionId}, ${body.text}, ${answerContent}, ${chatId}, now())
          ON CONFLICT DO NOTHING
        `)
        } catch {
          /* 表不存在时忽略 */
        }
        recordUsage(userId, 'coze')
        return reply.send(success({ answer: answerContent, chatId, sessionId }))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `Coze workflow 异常: ${msg}`))
      }
    },
  )

  // ==========================================================================
  // 12. Kling AI 视频代理
  // ==========================================================================

  const KLING_BASE_URL = 'https://api-beijing.klingai.com'

  async function klingJwt(): Promise<string | null> {
    const ak = process.env.KLING_ACCESS_KEY
    const sk = process.env.KLING_SECRET_KEY
    if (!ak || !sk) return null
    const now = Math.floor(Date.now() / 1000)
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', kid: ak })
      .setIssuer(ak)
      .setExpirationTime(now + 1800)
      .setNotBefore(now - 5)
      .sign(new TextEncoder().encode(sk))
  }

  // POST /kling/identify
  server.post(
    '/kling/identify',
    {
      schema: buildSchema({
        summary: 'Kling 人脸识别',
        description:
          '代理调用 Kling v1/videos/identify-face 接口进行视频人脸识别(videoId/videoUrl 二选一)',
        tags: ['AI', 'Kling'],
        body: klingIdentifyBody,
      }),
    },
    async (request, reply) => {
      const body = klingIdentifyBody
        .refine((d) => Boolean(d.videoId) !== Boolean(d.videoUrl), {
          message: 'videoId 和 videoUrl 必须二选一',
        })
        .parse(request.body)
      const jwt = await klingJwt()
      if (!jwt)
        return reply
          .status(503)
          .send(error(503, 'Kling 服务未配置(KLING_ACCESS_KEY/KLING_SECRET_KEY)'))
      const reqBody = body.videoId ? { video_id: body.videoId } : { video_url: body.videoUrl }
      try {
        const resp = await fetchWithTimeout(
          `${KLING_BASE_URL}/v1/videos/identify-face`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody),
          },
          120_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok || data.code !== 0)
          return reply
            .status(502)
            .send(error(502, `Kling 人脸识别失败: ${data.message ?? resp.status}`))
        recordUsage(request.userId!, 'kling')
        return reply.send(success(data.data ?? {}))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `Kling 调用异常: ${msg}`))
      }
    },
  )

  // POST /kling/task/create
  server.post(
    '/kling/task/create',
    {
      schema: buildSchema({
        summary: 'Kling 任务创建',
        description: '代理调用 Kling v1/videos/advanced-lip-sync 接口创建对口型任务',
        tags: ['AI', 'Kling'],
        body: klingTaskCreateBody,
      }),
    },
    async (request, reply) => {
      const body = klingTaskCreateBody.parse(request.body)
      const jwt = await klingJwt()
      if (!jwt) return reply.status(503).send(error(503, 'Kling 服务未配置'))
      const createBody: Record<string, unknown> = {
        session_id: body.sessionId,
        face_choose: body.faceChoose,
      }
      if (body.externalTaskId) createBody.external_task_id = body.externalTaskId
      if (body.callbackUrl) createBody.callback_url = body.callbackUrl
      try {
        const resp = await fetchWithTimeout(
          `${KLING_BASE_URL}/v1/videos/advanced-lip-sync`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(createBody),
          },
          120_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok || data.code !== 0)
          return reply
            .status(502)
            .send(error(502, `Kling 任务创建失败: ${data.message ?? resp.status}`))
        const taskData = (data.data as Record<string, unknown> | undefined) ?? {}
        const taskId = taskData.task_id as string | undefined
        if (!taskId) return reply.status(502).send(error(502, 'Kling 未返回 task_id'))
        const task = createTask(request.userId!, 'kling', 'lip-sync', { taskId })
        recordUsage(request.userId!, 'kling')
        return reply.send(success({ taskId, internalTaskId: task.taskId, status: 'pending' }))
      } catch (e) {
        const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
        return reply.status(502).send(error(502, `Kling 调用异常: ${msg}`))
      }
    },
  )

  // GET /kling/task/query/:taskId
  server.get(
    '/kling/task/query/:taskId',
    {
      schema: buildSchema({
        summary: 'Kling 任务查询',
        description: '按 taskId 查询 Kling 对口型任务状态,成功时扣除 token',
        tags: ['AI', 'Kling'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const jwt = await klingJwt()
      if (!jwt) return reply.status(503).send(error(503, 'Kling 服务未配置'))
      try {
        const resp = await fetchWithTimeout(
          `${KLING_BASE_URL}/v1/videos/advanced-lip-sync/${encodeURIComponent(taskId)}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
          },
          60_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok) return reply.status(502).send(error(502, `Kling 查询失败: ${resp.status}`))
        const taskData = (data.data as Record<string, unknown> | undefined) ?? {}
        const status = String(taskData.task_status ?? '').toLowerCase()
        if (status === 'succeed') {
          const videos =
            ((taskData.task_result as Record<string, unknown> | undefined)?.videos as
              Array<Record<string, unknown>> | undefined) ?? []
          const videoUrl = videos[0]?.url as string | undefined
          if (videoUrl) {
            try {
              const tokenBalance = server.tokenBalance
              if (tokenBalance)
                await tokenBalance.deductTokens(request.userId!, 1500, 'kling_lip_sync')
            } catch {
              /* 扣费失败不阻塞 */
            }
          }
        }
        recordUsage(request.userId!, 'kling')
        return reply.send(success(taskData))
      } catch (e) {
        return reply.status(502).send(error(502, `Kling 查询异常: ${(e as Error).message}`))
      }
    },
  )

  // ==========================================================================
  // 13. N8N 增强(服务端配置凭据 + 数据库双表插入)
  // ==========================================================================

  // GET /n8n/workflows(服务端配置凭据)
  server.get(
    '/n8n/workflows',
    {
      schema: buildSchema({
        summary: 'N8N 工作流列表(服务端凭据)',
        description: '使用服务端配置的 N8N_BASE_URL 与 N8N_API_KEY 查询活跃工作流列表',
        tags: ['AI', 'N8N'],
      }),
    },
    async (_request, reply) => {
      const baseUrl = process.env.N8N_BASE_URL
      const key = process.env.N8N_API_KEY
      if (!baseUrl || !key) return reply.status(503).send(error(503, 'N8N 服务未配置'))
      try {
        const resp = await fetchWithTimeout(
          `${baseUrl.replace(/\/$/, '')}/api/v1/workflows?active=true`,
          { method: 'GET', headers: { 'X-N8N-API-KEY': key } },
          30_000,
        )
        const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
        if (!resp.ok) return reply.status(502).send(error(502, `N8N 调用失败: ${resp.status}`))
        const items = Array.isArray(data.data) ? (data.data as Record<string, unknown>[]) : []
        const formatted = items.map((item) => ({
          id: item.id,
          name: item.name,
          createdAt: item.createdAt ?? null,
          updatedAt: item.updatedAt ?? null,
        }))
        return reply.send(success(formatted))
      } catch (e) {
        return reply.status(502).send(error(502, `N8N 调用异常: ${(e as Error).message}`))
      }
    },
  )

  // POST /n8n/addAgent/db(agents + zhs_agent_examine 双表插入)
  server.post(
    '/n8n/addAgent/db',
    {
      schema: buildSchema({
        summary: 'N8N 新增智能体(数据库双表)',
        description: '通过 N8N 接口新增智能体并写入 agents + zhs_agent_examine 双表,等待审核',
        tags: ['AI', 'N8N'],
        body: n8nAddAgentDbBody,
      }),
    },
    async (request, reply) => {
      const body = n8nAddAgentDbBody.parse(request.body)
      // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成 n8n agentId
      // 风险:DB 持久化的 agentId 可被枚举 → 越权访问其他用户工作流
      const agentId = generateCompactId('n8n')
      const avatar = body.agentAvatar ?? ''
      const agentVariablesJson = JSON.stringify(body.agentVariables ?? {})
      try {
        await db.execute(sql`
        INSERT INTO agents (agent_id, name, description, bot_id, agent_variables, avatar, status, publish_status, agent_model, created_at, updated_at)
        VALUES (${agentId}, ${body.agentName}, ${body.agentDescription}, ${agentId}, ${agentVariablesJson}, ${avatar}, 'pending', 'pending', ${body.agentModel}, now(), now())
        ON CONFLICT DO NOTHING
      `)
        let startName = ''
        try {
          const userRows = await db.execute(
            sql`SELECT nickname FROM users WHERE uuid = ${body.connectorUserId} LIMIT 1`,
          )
          const userRow = userRows[0] as { nickname?: string } | undefined
          if (userRow?.nickname) startName = userRow.nickname
        } catch {
          /* users 表结构可能不同,忽略 */
        }
        await db.execute(sql`
        INSERT INTO zhs_agent_examine (agent_id, agent_name, agent_avatar, prologue, status, start_time, start_user, start_name, "desc", follow)
        VALUES (${agentId}, ${body.agentName}, ${avatar}, ${body.agentDescription}, 0, now(), ${body.connectorUserId}, ${startName}, '智能体新增，等待审核', ${`[${new Date().toISOString()}] 智能体通过n8n接口创建，等待审核`})
        ON CONFLICT DO NOTHING
      `)
        recordUsage(request.userId!, 'n8n')
        return reply.send(success({ agentId }))
      } catch (e) {
        request.log.error(e)
        return reply.status(500).send(error(500, `数据库写入失败: ${(e as Error).message}`))
      }
    },
  )
}
