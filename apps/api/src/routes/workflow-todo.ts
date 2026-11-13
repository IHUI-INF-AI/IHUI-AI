// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { claimTodo, listTodos, resolveTodo, todoSummary } from '../services/workflow-todo.js'
import { requirePermission } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { buildSchema } from '../utils/swagger.js'

/**
 * 流程待办路由(HR-6 第 4 期,2026-11-13 立)。
 *
 * 把"需要人决策的点"暴露成可操作条目:
 *   列表(按状态/来源/严重度过滤) → 认领 → 结清或忽略。
 *
 * 权限沿用 hr:attendance:manage —— 待办全是考勤/薪资流程产生的,
 * HR 管理员本就该能处理;不另立权限点以免增加授权维护成本。
 * (若将来出现跨模块待办,再拆权限。)
 */

const HR_MANAGE = 'hr:attendance:manage'

const listQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'ignored', 'all']).optional(),
  sourceType: z.string().max(80).optional(),
  sourceRef: z.string().max(120).optional(),
  severity: z.enum(['blocker', 'warn', 'info']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const workflowTodoRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 1. GET /api/workflow-todos — 待办列表
  // ==========================================================================
  server.get(
    '/',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['流程待办'],
        summary: '待办列表(默认只看 open)',
        description: '按 lastSeenAt 倒序:最近一次被流程确认仍存在的排在前面。',
      }),
    },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      const result = await listTodos(parsed.data)
      reply.send(success(result))
    },
  )

  // ==========================================================================
  // 2. GET /api/workflow-todos/summary — 计数摘要(角标用)
  // ==========================================================================
  server.get(
    '/summary',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['流程待办'],
        summary: '待办计数摘要(按严重度分组)',
      }),
    },
    async (request, reply) => {
      const q = request.query as { sourceType?: string }
      const summary = await todoSummary(q.sourceType)
      reply.send(success(summary))
    },
  )

  // ==========================================================================
  // 3. POST /api/workflow-todos/:id/claim — 认领/取消认领
  // ==========================================================================
  server.post(
    '/:id/claim',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['流程待办'],
        summary: '认领待办(传 assign=false 取消认领)',
      }),
    },
    async (request, reply) => {
      const params = request.params as { id: string }
      const parsedId = z.string().uuid().safeParse(params.id)
      if (!parsedId.success) {
        reply.status(400).send(error(400, '待办 id 格式不正确', 'VALIDATION_FAILED'))
        return
      }
      const body = request.body as { assign?: boolean } | undefined
      // 内部服务 token 通道只注入 request.userId,不用 request.user;
      // 两处都取,避免内部调用认领时记不上人。
      const userId = request.userId ?? (request.user as { id?: string } | undefined)?.id ?? null
      const assign = body?.assign !== false
      try {
        const todo = await claimTodo(parsedId.data, assign ? userId : null)
        reply.send(success(todo))
      } catch (err) {
        if (err instanceof AppError) {
          reply.status(err.statusCode).send(error(err.statusCode, err.message, err.errorCode))
          return
        }
        throw err
      }
    },
  )

  // ==========================================================================
  // 4. POST /api/workflow-todos/:id/resolve — 结清或忽略
  // ==========================================================================
  server.post(
    '/:id/resolve',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        tags: ['流程待办'],
        summary: '结清或忽略待办(必须填写处理说明)',
        description:
          '处理说明是事后追责与复盘的唯一依据,不允许空着关门。' +
          '已结清的待办不会被后续流程重跑重新打开(不打扰)。',
      }),
    },
    async (request, reply) => {
      const params = request.params as { id: string }
      const parsedId = z.string().uuid().safeParse(params.id)
      if (!parsedId.success) {
        reply.status(400).send(error(400, '待办 id 格式不正确', 'VALIDATION_FAILED'))
        return
      }
      const bodySchema = z.object({
        status: z.enum(['resolved', 'ignored']),
        note: z.string().min(1).max(2000),
      })
      const parsedBody = bodySchema.safeParse(request.body)
      if (!parsedBody.success) {
        reply
          .status(400)
          .send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误', 'VALIDATION_FAILED'))
        return
      }
      // 内部服务 token 通道只注入 request.userId,不用 request.user;
      // 两处都取,避免内部调用认领时记不上人。
      const userId = request.userId ?? (request.user as { id?: string } | undefined)?.id ?? null
      try {
        const todo = await resolveTodo({
          todoId: parsedId.data,
          status: parsedBody.data.status,
          resolvedBy: userId,
          note: parsedBody.data.note,
        })
        reply.send(success(todo))
      } catch (err) {
        if (err instanceof AppError) {
          reply.status(err.statusCode).send(error(err.statusCode, err.message, err.errorCode))
          return
        }
        throw err
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
