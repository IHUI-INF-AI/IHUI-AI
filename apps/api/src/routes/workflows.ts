import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import {
  createWorkflow,
  findWorkflows,
  findWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  createInstance,
  findInstances,
  findInstanceById,
  updateInstanceStatus,
  cancelInstance,
  createTasks,
  findTasks,
  createLog,
  findLogs,
  type CreateTaskInput,
} from '../db/workflow-queries.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// 条件求值（简化版）
//   支持: "true" / "false" / "field==value" 形式
//   其他字符串按真值判断
// =============================================================================

function evaluateCondition(condition: string, context: unknown): boolean {
  if (condition === 'true') return true
  if (condition === 'false') return false
  const match = condition.match(/^(\w+)\s*==\s*(.+)$/)
  if (match && context && typeof context === 'object') {
    const ctx = context as Record<string, unknown>
    const field = match[1] as string
    const value = match[2] as string
    return String(ctx[field]) === value.trim().replace(/^['"]|['"]$/g, '')
  }
  return Boolean(condition)
}
import { buildResponseSchema, paginationQuerySchema } from '../utils/api-schemas.js'

// =============================================================================
// Zod schemas
// =============================================================================

const TRIGGER_TYPES = ['manual', 'schedule', 'event', 'webhook'] as const
const STEP_TYPES = [
  'echo',
  'skill',
  'llm',
  'condition',
  'delay',
  'loop',
  'parallel',
  'tool',
  'action',
] as const

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const createWorkflowSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(128, '名称最多 128 字符'),
  description: z.string().max(2000).optional(),
  triggerType: z.enum(TRIGGER_TYPES).default('manual'),
  triggerConfig: z.any().optional(),
  steps: z.array(z.any()).min(1, '至少需要一个步骤').max(100),
})

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2000).optional(),
  triggerType: z.enum(TRIGGER_TYPES).optional(),
  triggerConfig: z.any().optional(),
  steps: z.array(z.any()).max(100).optional(),
  isActive: z.boolean().optional(),
})

const triggerSchema = z.object({
  projectId: z.uuid().optional(),
  context: z.any().optional(),
})

const listInstancesQuery = z.object({
  ...paginationQuery,
  workflowId: z.uuid().optional(),
  status: z.string().optional(),
})

// =============================================================================
// 路由
// =============================================================================

export const workflowRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有工作流路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  })

  // POST /workflows - 创建工作流
  server.post(
    '/workflows',
    {
      schema: {
        summary: '创建工作流',
        description: '创建新的工作流(至少需要一个步骤)',
        tags: ['workflows'],
        body: {
          type: 'object',
          required: ['name', 'steps'],
          properties: {
            name: { type: 'string', maxLength: 128, description: '工作流名称' },
            description: { type: 'string', maxLength: 2000, description: '描述(可选)' },
            triggerType: {
              type: 'string',
              enum: ['manual', 'schedule', 'event', 'webhook'],
              default: 'manual',
              description: '触发类型(默认 manual)',
            },
            triggerConfig: {
              type: 'object',
              additionalProperties: true,
              description: '触发配置(可选)',
            },
            steps: {
              type: 'array',
              minItems: 1,
              items: { type: 'object', additionalProperties: true },
              description: '步骤列表(至少一个)',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createWorkflowSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const workflow = await createWorkflow({
        name: parsed.data.name,
        description: parsed.data.description,
        triggerType: parsed.data.triggerType,
        triggerConfig: parsed.data.triggerConfig,
        steps: parsed.data.steps,
        createdBy: request.userId!,
      })
      return reply.status(201).send(success({ workflow }))
    },
  )

  // GET /workflows - 工作流列表（分页）
  server.get(
    '/workflows',
    {
      schema: {
        summary: '工作流列表',
        description: '分页查询工作流列表',
        tags: ['workflows'],
        querystring: {
          type: 'object',
          properties: {
            ...paginationQuerySchema,
          },
        },
        response: buildResponseSchema(400, 401),
      },
    },
    async (request, reply) => {
      const parsed = z.object(paginationQuery).safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize } = parsed.data
      const { list, total } = await findWorkflows({ page, pageSize })
      return reply.send(success({ list, total, page, pageSize }))
    },
  )

  // GET /workflows/instances - 实例列表（分页，支持 workflowId/status 筛选）
  // 注意：静态路径需在 /:id 之前注册，Fastify 会优先匹配静态路由
  server.get('/workflows/instances', async (request, reply) => {
    const parsed = listInstancesQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, workflowId, status } = parsed.data
    const { list, total } = await findInstances({ page, pageSize, workflowId, status })
    return reply.send(success({ list, total, page, pageSize }))
  })

  // GET /workflows/instances/timeout - 检查并标记超时实例
  // 静态路径，必须放在 /instances/:id 之前，避免 timeout 被当作 :id
  server.get('/workflows/instances/timeout', async (_request, reply) => {
    // 查询 running 实例（findInstances 支持 status 过滤）
    const { list } = await findInstances({ page: 1, pageSize: 100, status: 'running' })
    const now = new Date()
    const timedOut: string[] = []
    for (const inst of list) {
      const ctx = (inst.context ?? {}) as Record<string, unknown>
      const timeout = typeof ctx.timeout === 'number' ? ctx.timeout : null
      if (timeout !== null && inst.startedAt) {
        const elapsed = now.getTime() - new Date(inst.startedAt).getTime()
        if (elapsed > timeout) {
          await updateInstanceStatus(inst.id, 'timeout', { completedAt: now })
          await createLog({
            instanceId: inst.id,
            level: 'warn',
            message: `实例超时 (${elapsed}ms > ${timeout}ms)`,
            data: { elapsed, timeout },
          })
          timedOut.push(inst.id)
        }
      }
    }
    return reply.send(success({ timedOut, count: timedOut.length }))
  })

  // GET /workflows/instances/:id - 实例详情（含 tasks）
  server.get('/workflows/instances/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const instance = await findInstanceById(parsed.data.id)
    if (!instance) {
      return reply.status(404).send(error(404, '实例不存在'))
    }
    const tasks = await findTasks(instance.id)
    return reply.send(success({ instance, tasks }))
  })

  // GET /workflows/instances/:id/tasks - 实例任务列表
  server.get('/workflows/instances/:id/tasks', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const instance = await findInstanceById(parsed.data.id)
    if (!instance) {
      return reply.status(404).send(error(404, '实例不存在'))
    }
    const tasks = await findTasks(instance.id)
    return reply.send(success({ list: tasks }))
  })

  // GET /workflows/instances/:id/logs - 实例日志
  server.get('/workflows/instances/:id/logs', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const instance = await findInstanceById(parsed.data.id)
    if (!instance) {
      return reply.status(404).send(error(404, '实例不存在'))
    }
    const parsedQ = z.object(paginationQuery).safeParse(request.query)
    if (!parsedQ.success) {
      return reply.status(400).send(error(400, parsedQ.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsedQ.data
    const { list, total } = await findLogs(instance.id, { page, pageSize })
    return reply.send(success({ list, total, page, pageSize }))
  })

  // POST /workflows/instances/:id/cancel - 取消运行中实例
  server.post('/workflows/instances/:id/cancel', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const instance = await findInstanceById(parsed.data.id)
    if (!instance) {
      return reply.status(404).send(error(404, '实例不存在'))
    }
    if (instance.status === 'completed' || instance.status === 'cancelled') {
      return reply.status(400).send(error(400, '实例已结束，无法取消'))
    }
    const cancelled = await cancelInstance(instance.id)
    await createLog({
      instanceId: instance.id,
      level: 'info',
      message: '实例已被手动取消',
    })
    return reply.send(success({ instance: cancelled }))
  })

  // POST /workflows/instances/:id/retry - 重试失败实例
  server.post('/workflows/instances/:id/retry', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const instance = await findInstanceById(parsed.data.id)
    if (!instance) {
      return reply.status(404).send(error(404, '实例不存在'))
    }
    if (instance.status !== 'failed') {
      return reply.status(400).send(error(400, '仅失败实例可重试'))
    }
    const reset = await updateInstanceStatus(instance.id, 'pending', {
      error: null,
      startedAt: null,
      completedAt: null,
    })
    await createLog({
      instanceId: instance.id,
      level: 'info',
      message: '实例已被手动重试',
    })
    return reply.send(success({ instance: reset }))
  })

  // GET /workflows/:id - 工作流详情
  server.get('/workflows/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const workflow = await findWorkflowById(parsed.data.id)
    if (!workflow) {
      return reply.status(404).send(error(404, '工作流不存在'))
    }
    return reply.send(success({ workflow }))
  })

  // PATCH /workflows/:id - 更新工作流（仅创建者）
  server.patch('/workflows/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = updateWorkflowSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findWorkflowById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '工作流不存在'))
    }
    if (existing.createdBy !== request.userId) {
      return reply.status(403).send(error(403, '无权修改该工作流'))
    }
    const updated = await updateWorkflow(parsed.data.id, body.data)
    return reply.send(success({ workflow: updated }))
  })

  // DELETE /workflows/:id - 删除工作流（仅创建者）
  server.delete('/workflows/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findWorkflowById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '工作流不存在'))
    }
    if (existing.createdBy !== request.userId) {
      return reply.status(403).send(error(403, '无权删除该工作流'))
    }
    await deleteWorkflow(parsed.data.id)
    return reply.send(success({ deleted: true }))
  })

  // POST /workflows/:id/trigger - 手动触发工作流，创建 instance + 按步骤派发任务
  server.post(
    '/workflows/:id/trigger',
    {
      schema: {
        summary: '触发工作流',
        description: '手动触发指定工作流,创建实例并按步骤派发任务',
        tags: ['workflows'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: '工作流 ID' },
          },
        },
        body: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid', description: '关联项目 ID(可选)' },
            context: {
              type: 'object',
              additionalProperties: true,
              description: '触发上下文数据(可选)',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = triggerSchema.safeParse(request.body ?? {})
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const workflow = await findWorkflowById(parsed.data.id)
      if (!workflow) {
        return reply.status(404).send(error(404, '工作流不存在'))
      }
      if (!workflow.isActive) {
        return reply.status(400).send(error(400, '工作流未启用'))
      }

      // 合并 triggerConfig.timeout 到实例上下文，供超时检查端点使用
      const triggerConfig = (workflow.triggerConfig ?? {}) as Record<string, unknown>
      const triggerContext = (body.data.context ?? {}) as Record<string, unknown>
      const instanceContext: Record<string, unknown> = { ...triggerContext }
      const timeoutMs =
        typeof triggerConfig.timeout === 'number' && triggerConfig.timeout > 0
          ? triggerConfig.timeout
          : null
      if (timeoutMs !== null) {
        instanceContext.timeout = timeoutMs
      }

      // 创建实例（初始 pending）
      const instance = await createInstance({
        workflowId: workflow.id,
        projectId: body.data.projectId,
        context: instanceContext,
      })

      // 配置了超时则进入 running 并记录开始时间，供超时检查端点判断
      if (timeoutMs !== null) {
        await updateInstanceStatus(instance.id, 'running', { startedAt: new Date() })
      }

      // 触发后按步骤定义派发任务（condition/delay/action/loop）
      const steps = Array.isArray(workflow.steps) ? (workflow.steps as unknown[]) : []
      const taskInputs: CreateTaskInput[] = []
      let stepIdx = 0

      for (const raw of steps) {
        const step = (raw ?? {}) as Record<string, unknown>
        const type =
          typeof step.type === 'string' && (STEP_TYPES as readonly string[]).includes(step.type)
            ? step.type
            : 'echo'

        const stepName =
          typeof step.name === 'string' && step.name.length > 0 ? step.name : `step-${stepIdx + 1}`
        const stepInput = step.input ?? step.config

        // echo / skill / llm / tool / action 均创建可执行任务
        if (
          type === 'echo' ||
          type === 'skill' ||
          type === 'llm' ||
          type === 'tool' ||
          type === 'action'
        ) {
          taskInputs.push({
            instanceId: instance.id,
            stepIndex: stepIdx++,
            name: stepName,
            type,
            input: stepInput,
          })
        } else if (type === 'condition') {
          const conditionStr = typeof step.condition === 'string' ? step.condition : ''
          const condResult = evaluateCondition(conditionStr, triggerContext)
          await createLog({
            instanceId: instance.id,
            level: 'info',
            message: `条件 ${conditionStr} = ${condResult}`,
          })
          const branchSteps = condResult ? step.thenSteps : step.elseSteps
          if (Array.isArray(branchSteps)) {
            for (const bs of branchSteps) {
              const b = (bs ?? {}) as Record<string, unknown>
              const bName =
                typeof b.name === 'string' && b.name.length > 0 ? b.name : `action-${stepIdx + 1}`
              taskInputs.push({
                instanceId: instance.id,
                stepIndex: stepIdx++,
                name: bName,
                type: 'action',
                input: b.config,
              })
            }
          }
        } else if (type === 'delay') {
          const duration = typeof step.duration === 'number' ? step.duration : 0
          await createLog({
            instanceId: instance.id,
            level: 'info',
            message: `延迟 ${duration}ms`,
          })
        } else if (type === 'loop') {
          const count = typeof step.count === 'number' ? step.count : 0
          for (let i = 0; i < count; i++) {
            taskInputs.push({
              instanceId: instance.id,
              stepIndex: stepIdx++,
              name: `${stepName}[${i}]`,
              type: 'loop',
              input: stepInput,
            })
          }
        } else if (type === 'parallel' && Array.isArray(step.steps)) {
          let parallelCount = 0
          for (const subRaw of step.steps) {
            const subStep = (subRaw ?? {}) as Record<string, unknown>
            const subType =
              typeof subStep.type === 'string' &&
              (STEP_TYPES as readonly string[]).includes(subStep.type)
                ? subStep.type
                : 'echo'
            const subName =
              typeof subStep.name === 'string' && subStep.name.length > 0
                ? subStep.name
                : `parallel-${stepIdx + 1}`
            taskInputs.push({
              instanceId: instance.id,
              stepIndex: stepIdx++,
              name: subName,
              type: subType,
              input: subStep.input ?? subStep.config,
            })
            parallelCount++
          }
          await createLog({
            instanceId: instance.id,
            level: 'info',
            message: `并行执行 ${parallelCount} 个任务`,
          })
        }
      }

      const tasks = await createTasks(taskInputs)

      await createLog({
        instanceId: instance.id,
        level: 'info',
        message: `工作流 "${workflow.name}" 已被手动触发，共 ${tasks.length} 个任务`,
        data: { workflowId: workflow.id, taskCount: tasks.length },
      })

      // 重新查询以反映 running 状态变更
      const finalInstance = await findInstanceById(instance.id)
      return reply.status(201).send(success({ instance: finalInstance ?? instance, tasks }))
    },
  )
}
