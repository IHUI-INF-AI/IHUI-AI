// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  createAiTaskTemplate,
  listAiTaskTemplates,
  listAiTaskRuns,
  runAiTask,
  type TaskStepCaller,
} from '../services/ai-task-executor.js'
import { requirePermission } from '../plugins/require-permission.js'
import { error, success } from '../utils/response.js'

/**
 * AI 任务模板 HTTP API(HR-4,2026-11-11 立):模板 CRUD + 手动触发 + 执行历史。
 * 路由挂在 /api/ai-tasks(挂载点由主 agent 接线,本文件只声明 plugin)。
 */

/** 默认端点调用器:同进程内 fetch 到本机 API(回环端口),用于把端点当工具调用。
 *
 * 真实部署由主 agent 接线时按既有内部调用约定替换(若仓库已有内部 service-fetch helper)。
 * 本文件只提供「能跑」的默认实现:从环境变量取本机端口,回环 fetch 到 /api 前缀端点。
 */
const defaultCaller: TaskStepCaller = async (method, path, params) => {
  const port = process.env.PORT ?? '3000'
  const qs =
    method.toUpperCase() === 'GET' && Object.keys(params ?? {}).length
      ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`
      : ''
  const url = `http://127.0.0.1:${port}/api${path.startsWith('/') ? path : `/${path}`}${qs}`
  const res = await fetch(url, {
    method: method.toUpperCase(),
    headers: { 'content-type': 'application/json' },
    body: method.toUpperCase() === 'GET' ? undefined : JSON.stringify(params ?? {}),
  })
  if (!res.ok) throw new Error(`endpoint ${method} ${path} failed: ${res.status}`)
  return res.json()
}

const stepSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
  injectFromPrev: z.object({ into: z.string().min(1) }).optional(),
})

const createSchema = z.object({
  name: z.string().min(1).max(120),
  goal: z.string().min(1).max(1000),
  steps: z.array(stepSchema).min(1).max(50),
  triggerType: z.enum(['manual', 'cron', 'event']).optional(),
  cron: z.string().max(100).optional(),
})

const runSchema = z.object({
  manual: z.boolean().optional(),
  replayFromStep: z.number().int().min(0).optional(),
})

const listRunsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const aiTaskTemplatesRoutes: FastifyPluginAsync = async (app) => {
  // 模板列表(管理端回查/AI 工具枚举)
  app.get('/', { preHandler: requirePermission('hr:attendance:manage') }, async (_req, reply) => {
    const list = await listAiTaskTemplates()
    return reply.status(200).send(success({ list, total: list.length }))
  })

  // 建模板(一句话目标 → 落模板)
  app.post('/', { preHandler: requirePermission('hr:attendance:manage') }, async (req, reply) => {
    const input = createSchema.safeParse(req.body)
    if (!input.success) {
      return reply.status(400).send(error(400, '参数不合法'))
    }
    try {
      const created = await createAiTaskTemplate({
        name: input.data.name,
        goal: input.data.goal,
        steps: input.data.steps,
        triggerType: input.data.triggerType,
        cron: input.data.cron,
      })
      return reply.status(200).send(success(created))
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e)
      return reply.status(400).send(error(400, msg))
    }
  })

  // 手动触发执行(可指定 replayFromStep 重放自失败步续跑)
  app.post(
    '/:name/run',
    { preHandler: requirePermission('hr:attendance:manage') },
    async (req, reply) => {
      const { name } = z.object({ name: z.string().min(1) }).parse(req.params)
      const body = runSchema.safeParse(req.body ?? {})
      if (!body.success) {
        return reply.status(400).send(error(400, '参数不合法'))
      }
      try {
        const outcome = await runAiTask(name, defaultCaller, {
          manual: body.data.manual ?? true,
          replayFromStep: body.data.replayFromStep,
        })
        return reply.status(200).send(success(outcome))
      } catch (e) {
        const msg = String((e as { message?: string })?.message ?? e)
        return reply.status(400).send(error(400, msg))
      }
    },
  )

  // 执行历史(按模板名过滤,分页)
  app.get(
    '/:name/runs',
    { preHandler: requirePermission('hr:attendance:manage') },
    async (req, reply) => {
      const { name } = z.object({ name: z.string().min(1) }).parse(req.params)
      const q = listRunsSchema.safeParse(req.query ?? {})
      if (!q.success) {
        return reply.status(400).send(error(400, '参数不合法'))
      }
      const { list, total } = await listAiTaskRuns({
        templateName: name,
        limit: q.data.limit,
        offset: q.data.offset,
      })
      return reply.status(200).send(success({ list, total }))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
