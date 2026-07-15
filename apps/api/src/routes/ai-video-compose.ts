/**
 * 一键视频编排路由(迁移自 coze_zhs_py/api/one_click_video.py)。
 *
 * 多步骤状态机:script(脚本生成) → material(素材收集) →
 * compose(视频合成) → subtitle(字幕)。失败或手动触发可重新生成单步骤。
 *
 * 复用 ai-vendors/_shared.ts 的 callVendor 调用 dashscope 视频生成能力。
 *
 * 注册(server.ts):
 *   server.register(aiVideoComposeRoutes, { prefix: '/api/ai-video-compose' })
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import {
  requireAuth,
  callVendor,
  recordUsage,
  genId,
} from './ai-vendors/_shared.js'

type StepName = 'script' | 'material' | 'compose' | 'subtitle'
type StepStatus = 'pending' | 'running' | 'succeeded' | 'failed'

interface ChatChoiceMessage {
  message?: { content?: string }
}

function extractScriptText(result: unknown, fallback: string): string {
  if (result && typeof result === 'object') {
    const obj = result as { choices?: ChatChoiceMessage[] }
    const content = obj.choices?.[0]?.message?.content
    if (typeof content === 'string' && content) return content
  }
  return fallback
}

interface ComposeStep {
  name: StepName
  status: StepStatus
  result?: unknown
  error?: string
  startedAt?: number
  finishedAt?: number
}

interface ComposeTask {
  id: string
  userId: string
  prompt: string
  model?: string
  steps: Record<StepName, ComposeStep>
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  createdAt: number
  updatedAt: number
}

const taskStore = new Map<string, ComposeTask>()

const STEP_ORDER: StepName[] = ['script', 'material', 'compose', 'subtitle']

function newSteps(): Record<StepName, ComposeStep> {
  return {
    script: { name: 'script', status: 'pending' },
    material: { name: 'material', status: 'pending' },
    compose: { name: 'compose', status: 'pending' },
    subtitle: { name: 'subtitle', status: 'pending' },
  }
}

async function runStep(
  task: ComposeTask,
  step: StepName,
  reply: FastifyReply,
): Promise<boolean> {
  const s = task.steps[step]
  s.status = 'running'
  s.startedAt = Date.now()
  s.error = undefined
  task.updatedAt = Date.now()
  try {
    let result: unknown = null
    if (step === 'script') {
      result = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        reply,
        {
          method: 'POST',
          body: JSON.stringify({
            model: task.model ?? 'qwen-plus',
            messages: [
              { role: 'system', content: '你是视频脚本编剧,根据用户需求输出一段分镜脚本' },
              { role: 'user', content: task.prompt },
            ],
          }),
        },
      )
    } else if (step === 'material') {
      result = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
        reply,
        {
          method: 'POST',
          body: JSON.stringify({ prompt: task.prompt, model: 'wanx-v1' }),
        },
      )
    } else if (step === 'compose') {
      const scriptText = extractScriptText(task.steps.script.result, task.prompt)
      result = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
        reply,
        {
          method: 'POST',
          body: JSON.stringify({ prompt: scriptText, model: task.model ?? 'wanx2.1-t2v-turbo' }),
        },
      )
    } else {
      const scriptText = extractScriptText(task.steps.script.result, task.prompt)
      result = await callVendor(
        'dashscope',
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        reply,
        {
          method: 'POST',
          body: JSON.stringify({
            model: 'qwen-plus',
            messages: [
              { role: 'system', content: '根据视频脚本生成 SRT 字幕,分段时间戳' },
              { role: 'user', content: scriptText },
            ],
          }),
        },
      )
    }
    if (result === null) {
      s.status = 'failed'
      s.error = '上游调用失败'
      s.finishedAt = Date.now()
      return false
    }
    s.status = 'succeeded'
    s.result = result
    s.finishedAt = Date.now()
    recordUsage(task.userId, 'dashscope')
    return true
  } catch (e) {
    s.status = 'failed'
    s.error = (e as Error).message
    s.finishedAt = Date.now()
    return false
  }
}

const createSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
})

const idParam = z.object({ id: z.string().min(1) })

const regenerateSchema = z.object({
  step: z.enum(['script', 'material', 'compose', 'subtitle']),
})

export const aiVideoComposeRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // POST / — 创建编排任务并顺序执行全部步骤
  server.post('/', async (request, reply) => {
    const body = createSchema.parse(request.body)
    const task: ComposeTask = {
      id: genId('compose'),
      userId: request.userId!,
      prompt: body.prompt,
      model: body.model,
      steps: newSteps(),
      status: 'running',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    taskStore.set(task.id, task)
    for (const step of STEP_ORDER) {
      const ok = await runStep(task, step, reply)
      if (!ok) {
        task.status = 'failed'
        task.updatedAt = Date.now()
        return reply.send(success(task))
      }
    }
    task.status = 'succeeded'
    task.updatedAt = Date.now()
    return reply.status(201).send(success(task))
  })

  // GET /:id — 查询任务状态
  server.get('/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const task = taskStore.get(id)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    if (task.userId !== request.userId) return reply.status(403).send(error(403, '无权访问该任务'))
    return reply.send(success(task))
  })

  // POST /:id/regenerate — 重新生成某步骤(及其后续步骤)
  server.post('/:id/regenerate', async (request, reply) => {
    const { id } = idParam.parse(request.params)
    const body = regenerateSchema.parse(request.body)
    const task = taskStore.get(id)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    if (task.userId !== request.userId) return reply.status(403).send(error(403, '无权操作该任务'))
    const startIdx = STEP_ORDER.indexOf(body.step)
    if (startIdx < 0) return reply.status(400).send(error(400, '无效的步骤名'))
    task.status = 'running'
    task.updatedAt = Date.now()
    for (const step of STEP_ORDER.slice(startIdx)) {
      const ok = await runStep(task, step, reply)
      if (!ok) {
        task.status = 'failed'
        task.updatedAt = Date.now()
        return reply.send(success(task))
      }
    }
    task.status = 'succeeded'
    task.updatedAt = Date.now()
    return reply.send(success(task))
  })
}
