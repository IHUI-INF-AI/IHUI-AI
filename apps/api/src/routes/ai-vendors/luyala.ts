/**
 * 路亚拉(luyala)视频/语音代理路由(迁移自 coze_zhs_py/api/luyala_proxy.py)。
 *
 * 代理 luyala 厂商的视频生成 / 语音合成 / 异步任务查询。
 * 凭据从环境变量读取:LUYALA_API_KEY / LUYALA_BASE_URL(默认 https://api.luyala.com)。
 *
 * 注册(server.ts):
 *   server.register(luyalaRoutes, { prefix: '/api/ai-vendors/luyala' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import {
  requireAuth,
  fetchWithTimeout,
  genId,
  taskStore,
  type AsyncTask,
} from './_shared.js'

const LUYALA_BASE_URL = process.env.LUYALA_BASE_URL ?? 'https://api.luyala.com'

function requireLuyalaKey(reply: FastifyReply): string | null {
  const key = process.env.LUYALA_API_KEY
  if (!key) {
    reply.status(503).send(error(503, 'Luyala 服务未配置(LUYALA_API_KEY)'))
    return null
  }
  return key
}

async function callLuyala(
  path: string,
  reply: FastifyReply,
  options: RequestInit = {},
  timeoutMs = 60_000,
): Promise<unknown | null> {
  const key = requireLuyalaKey(reply)
  if (!key) return null
  try {
    const resp = await fetchWithTimeout(
      `${LUYALA_BASE_URL}${path}`,
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          ...(options.headers ?? {}),
        },
      },
      timeoutMs,
    )
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      reply
        .status(502)
        .send(error(502, `Luyala 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`))
      return null
    }
    return data
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    reply.status(502).send(error(502, `Luyala 调用异常: ${msg}`))
    return null
  }
}

const videoSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
  duration: z.number().optional(),
  resolution: z.string().optional(),
})

const voiceSchema = z.object({
  text: z.string().min(1),
  voice: z.string().optional(),
  model: z.string().optional(),
  speed: z.number().optional(),
})

const taskIdParam = z.object({ id: z.string().min(1) })

export const luyalaRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // POST /video — 视频生成(异步提交)
  server.post('/video', async (request, reply) => {
    const body = videoSchema.parse(request.body)
    const data = await callLuyala('/v1/video/generate', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    const taskId = ((data as Record<string, unknown>).task_id as string | undefined) ?? genId('luyala')
    const task: AsyncTask = {
      taskId,
      userId: request.userId!,
      vendor: 'luyala',
      type: 'video',
      status: 'pending',
      result: data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    taskStore.set(taskId, task)
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  // POST /voice — 语音合成(同步返回音频)
  server.post('/voice', async (request, reply) => {
    const body = voiceSchema.parse(request.body)
    const data = await callLuyala('/v1/voice/synthesize', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    return reply.send(success(data))
  })

  // GET /tasks/:id — 任务状态查询(本地缓存 + 上游拉取最新状态)
  server.get('/tasks/:id', async (request, reply) => {
    const { id } = taskIdParam.parse(request.params)
    const task = taskStore.get(id)
    if (!task || task.vendor !== 'luyala') {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    if (task.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权访问该任务'))
    }
    // 终态直接返回
    if (task.status === 'succeeded' || task.status === 'failed') {
      return reply.send(success(task))
    }
    // 拉取上游最新状态
    const upstream = await callLuyala(`/v1/tasks/${encodeURIComponent(id)}`, reply, {
      method: 'GET',
    })
    if (upstream === null) return
    const u = upstream as Record<string, unknown>
    const status = String(u.status ?? '').toLowerCase()
    if (status === 'succeeded' || status === 'success' || status === 'done') {
      task.status = 'succeeded'
    } else if (status === 'failed' || status === 'error') {
      task.status = 'failed'
    } else if (status) {
      task.status = 'running'
    }
    task.result = upstream
    task.updatedAt = Date.now()
    return reply.send(success(task))
  })
}
