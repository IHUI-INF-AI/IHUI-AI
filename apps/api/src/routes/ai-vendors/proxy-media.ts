/**
 * 多媒体生成代理子路由:Suno(5 端点)+ Sora2(4 端点)。
 */
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
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

export const mediaVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })

  // 4. Suno(音乐生成)— 5 端点
  server.post('/suno/generate', async (request, reply) => {
    const body = z
      .object({
        prompt: z.string().optional(),
        model: z.string().optional(),
        duration: z.number().optional(),
      })
      .parse(request.body)
    const data = await callVendor('suno', 'https://api.suno.ai/v1/music/generations', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    const task = createTask(request.userId!, 'suno', 'music', data)
    recordUsage(request.userId!, 'suno')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  server.get('/suno/tasks', async (request, reply) => {
    const key = requireVendorKey('suno', reply)
    if (!key) return
    const list: AsyncTask[] = []
    for (const t of taskStore.values()) {
      if (t.vendor === 'suno' && t.userId === request.userId) list.push(t)
    }
    return reply.send(success(list))
  })

  server.get('/suno/tasks/:taskId', async (request, reply) => {
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
  })

  server.post('/suno/lyrics', async (request, reply) => {
    const body = promptOnlyBody.parse(request.body)
    const data = await callVendor('suno', 'https://api.suno.ai/v1/lyrics/generations', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    recordUsage(request.userId!, 'suno')
    return reply.send(success(data))
  })

  server.get('/suno/models', async (_request, reply) => {
    const data = await callVendor('suno', 'https://api.suno.ai/v1/models', reply, { method: 'GET' })
    if (data === null) return
    return reply.send(success(data))
  })

  // 5. Sora2(OpenAI 视频)— 4 端点
  server.post('/sora2/generate', async (request, reply) => {
    const body = z
      .object({
        prompt: z.string().optional(),
        model: z.string().optional(),
        duration: z.number().optional(),
        size: z.string().optional(),
      })
      .parse(request.body)
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
  })

  server.get('/sora2/tasks', async (request, reply) => {
    const list: AsyncTask[] = []
    for (const t of taskStore.values()) {
      if (t.vendor === 'sora2' && t.userId === request.userId) list.push(t)
    }
    return reply.send(success(list))
  })

  server.get('/sora2/tasks/:taskId', async (request, reply) => {
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
  })

  server.get('/sora2/models', async (_request, reply) => {
    const data = await callVendor('sora2', `${VENDORS.sora2!.baseUrl}/v1/models`, reply, {
      method: 'GET',
    })
    if (data === null) return
    return reply.send(success(data))
  })
}
