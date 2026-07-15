/**
 * 多媒体生成代理子路由:Suno(5 端点)+ Sora2(4 端点)。
 */
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { buildSchema } from '../../utils/swagger.js'
import {
  requireAuth,
  callVendor,
  recordUsage,
  createTask,
  requireVendorKey,
  taskStore,
  VENDORS,
  taskIdParam,
  promptOnlyBody,
  type AsyncTask,
  type FastifyRequest,
  type FastifyReply,
  type FastifyPluginAsync,
} from './_shared.js'

const sunoGenerateBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  duration: z.number().optional(),
})

const sora2GenerateBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  duration: z.number().optional(),
  size: z.string().optional(),
})

export const mediaVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })

  // 4. Suno(音乐生成)— 5 端点
  server.post(
    '/suno/generate',
    {
      schema: buildSchema({
        summary: 'Suno 音乐生成',
        description: '代理调用 Suno v1/music/generations 接口生成音乐(异步任务)',
        tags: ['AI', 'Suno'],
        body: sunoGenerateBody,
      }),
    },
    async (request, reply) => {
      const body = sunoGenerateBody.parse(request.body)
      const data = await callVendor('suno', 'https://api.suno.ai/v1/music/generations', reply, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (data === null) return
      const task = createTask(request.userId!, 'suno', 'music', data)
      recordUsage(request.userId!, 'suno')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/suno/tasks',
    {
      schema: buildSchema({
        summary: 'Suno 当前用户任务列表',
        description: '返回当前登录用户的 Suno 异步任务列表',
        tags: ['AI', 'Suno'],
      }),
    },
    async (request, reply) => {
      const key = requireVendorKey('suno', reply)
      if (!key) return
      const list: AsyncTask[] = []
      for (const t of taskStore.values()) {
        if (t.vendor === 'suno' && t.userId === request.userId) list.push(t)
      }
      return reply.send(success(list))
    },
  )

  server.get(
    '/suno/tasks/:taskId',
    {
      schema: buildSchema({
        summary: 'Suno 任务详情',
        description: '按 taskId 查询 Suno 任务详情并同步上游状态',
        tags: ['AI', 'Suno'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      if (!task || task.vendor !== 'suno') {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const upstream = await callVendor(
        'suno',
        `https://api.suno.ai/v1/music/generations/${encodeURIComponent(taskId)}`,
        reply,
        { method: 'GET' },
      )
      if (upstream) task.result = upstream
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )

  server.post(
    '/suno/lyrics',
    {
      schema: buildSchema({
        summary: 'Suno 歌词生成',
        description: '代理调用 Suno v1/lyrics/generations 接口生成歌词',
        tags: ['AI', 'Suno'],
        body: promptOnlyBody,
      }),
    },
    async (request, reply) => {
      const body = promptOnlyBody.parse(request.body)
      const data = await callVendor('suno', 'https://api.suno.ai/v1/lyrics/generations', reply, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (data === null) return
      recordUsage(request.userId!, 'suno')
      return reply.send(success(data))
    },
  )

  server.get(
    '/suno/models',
    {
      schema: buildSchema({
        summary: 'Suno 模型列表',
        description: '代理调用 Suno v1/models 接口获取可用模型列表',
        tags: ['AI', 'Suno'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor('suno', 'https://api.suno.ai/v1/models', reply, {
        method: 'GET',
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )

  // 5. Sora2(OpenAI 视频)— 4 端点
  server.post(
    '/sora2/generate',
    {
      schema: buildSchema({
        summary: 'Sora2 视频生成',
        description: '代理调用 Sora2 v1/videos/generations 接口生成视频(异步任务)',
        tags: ['AI', 'Sora2'],
        body: sora2GenerateBody,
      }),
    },
    async (request, reply) => {
      const body = sora2GenerateBody.parse(request.body)
      const data = await callVendor(
        'sora2',
        `${VENDORS.sora2!.baseUrl}/v1/videos/generations`,
        reply,
        { method: 'POST', body: JSON.stringify(body) },
      )
      if (data === null) return
      const task = createTask(request.userId!, 'sora2', 'video', data)
      recordUsage(request.userId!, 'sora2')
      return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
    },
  )

  server.get(
    '/sora2/tasks',
    {
      schema: buildSchema({
        summary: 'Sora2 当前用户任务列表',
        description: '返回当前登录用户的 Sora2 异步任务列表',
        tags: ['AI', 'Sora2'],
      }),
    },
    async (request, reply) => {
      const list: AsyncTask[] = []
      for (const t of taskStore.values()) {
        if (t.vendor === 'sora2' && t.userId === request.userId) list.push(t)
      }
      return reply.send(success(list))
    },
  )

  server.get(
    '/sora2/tasks/:taskId',
    {
      schema: buildSchema({
        summary: 'Sora2 任务详情',
        description: '按 taskId 查询 Sora2 任务详情并同步上游状态',
        tags: ['AI', 'Sora2'],
        params: taskIdParam,
      }),
    },
    async (request, reply) => {
      const { taskId } = taskIdParam.parse(request.params)
      const task = taskStore.get(taskId)
      if (!task || task.vendor !== 'sora2') {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const upstream = await callVendor(
        'sora2',
        `${VENDORS.sora2!.baseUrl}/v1/videos/generations/${encodeURIComponent(taskId)}`,
        reply,
        { method: 'GET' },
      )
      if (upstream) task.result = upstream
      task.updatedAt = Date.now()
      return reply.send(success(task))
    },
  )

  server.get(
    '/sora2/models',
    {
      schema: buildSchema({
        summary: 'Sora2 模型列表',
        description: '代理调用 Sora2 v1/models 接口获取可用模型列表',
        tags: ['AI', 'Sora2'],
      }),
    },
    async (_request, reply) => {
      const data = await callVendor('sora2', `${VENDORS.sora2!.baseUrl}/v1/models`, reply, {
        method: 'GET',
      })
      if (data === null) return
      return reply.send(success(data))
    },
  )
}
