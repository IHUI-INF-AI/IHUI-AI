// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管智能体 · 统一注册表公共端点（R1 / P1-07 / P1-08 / P1-11）。
 *
 * 挂载：`/api/agent-registry`。所有端点先过 requireAuth，再由服务层做
 * scope/owner/team 三档裁决；路由层不写业务判断，避免出现第二套权限口径。
 *
 * 本文件当前只放"定义 + 版本"面。删除预检/一次性审批/运行读取在后续切片补，
 * 但路径已经按 01 §4.2 固定，后补不会改前端契约。
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  AGENT_ROLE_VALUES,
  APPROVAL_STATUSES,
  DEFINITION_STATUSES,
  RUN_STATUSES,
  SCOPES,
  type AgentRegistryRole,
  type DefinitionStatus,
  type RunStatus,
  type Scope,
} from '@ihui/shared'
import { requireAuth } from '../plugins/require-permission.js'
import { AppError } from '../errors/AppError.js'
import { parseOrThrow, success } from '../utils/response.js'
import {
  approveApproval,
  createDeleteApproval,
  createPurgeApproval,
  getApproval,
  listApprovals,
  precheckDelete,
  rejectApproval,
  restoreAgentDefinition,
} from '../services/agent-registry-approval-service.js'
import {
  cloneAgentDefinition,
  createAgentDefinition,
  getAgentDefinition,
  getAgentDefinitionVersion,
  listAgentDefinitionVersions,
  listAgentDefinitions,
  rollbackAgentDefinition,
  setAgentDefinitionEnabled,
  updateAgentDefinition,
  type AgentRegistryActor,
  type CloneAgentDefinitionInput,
  type CreateAgentDefinitionInput,
  type UpdateAgentDefinitionInput,
} from '../services/agent-registry-service.js'
import {
  getAgentRun,
  getAgentRunStats,
  listAgentRunEvents,
  listDefinitionRuns,
  listOwnerRuns,
  listRunArtifacts,
} from '../services/agent-registry-runs-service.js'
import { runIdempotent } from '../services/agent-registry-idempotency.js'
import {
  publishAgentRegistryChanged,
  snapshotVersionFromUpdatedAt,
} from '../services/agent-registry-invalidation.js'

const uuidSchema = z.string().uuid('必须是 UUID')
const nameSchema = z.string().min(1).max(64)
const displayNameSchema = z.string().min(1).max(100)
const descriptionSchema = z.string().max(4000)
const jsonObjectSchema = z.record(z.string(), z.unknown())
const roleSchema = z.enum(AGENT_ROLE_VALUES)
const scopeSchema = z.enum(SCOPES)
const definitionStatusSchema = z.enum(DEFINITION_STATUSES)

const createDefinitionSchema = z.object({
  scope: scopeSchema,
  name: nameSchema,
  displayName: displayNameSchema,
  description: descriptionSchema.optional(),
  role: roleSchema.optional(),
  systemPrompt: z.string().max(32768).optional(),
  model: z.string().max(100).nullable().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(200000).nullable().optional(),
  tools: z.array(z.string().max(80)).max(64).optional(),
  skills: z.array(z.string().max(80)).max(64).optional(),
  permissions: jsonObjectSchema.optional(),
  memoryPolicy: jsonObjectSchema.optional(),
  budget: jsonObjectSchema.optional(),
  concurrencyLimit: z.number().int().min(1).max(8).optional(),
  isDispatchable: z.boolean().optional(),
  marketAgentId: uuidSchema.nullable().optional(),
  metadata: jsonObjectSchema.optional(),
  teamId: uuidSchema.nullable().optional(),
  reason: z.string().max(300).optional(),
})

const updateDefinitionSchema = z
  .object({
    ifVersion: z.number().int().positive(),
    name: nameSchema.optional(),
    displayName: displayNameSchema.optional(),
    description: descriptionSchema.optional(),
    role: roleSchema.optional(),
    systemPrompt: z.string().max(32768).optional(),
    model: z.string().max(100).nullable().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(200000).nullable().optional(),
    tools: z.array(z.string().max(80)).max(64).optional(),
    skills: z.array(z.string().max(80)).max(64).optional(),
    permissions: jsonObjectSchema.optional(),
    memoryPolicy: jsonObjectSchema.optional(),
    budget: jsonObjectSchema.optional(),
    concurrencyLimit: z.number().int().min(1).max(8).optional(),
    isDispatchable: z.boolean().optional(),
    marketAgentId: uuidSchema.nullable().optional(),
    metadata: jsonObjectSchema.optional(),
    changeSummary: z.string().max(300).optional(),
    reason: z.string().max(300).optional(),
  })
  .strict()

const cloneDefinitionSchema = z
  .object({
    name: nameSchema.optional(),
    displayName: displayNameSchema.optional(),
    scope: scopeSchema.optional(),
    teamId: uuidSchema.nullable().optional(),
    reason: z.string().max(300).optional(),
  })
  .strict()

const listQuerySchema = z.object({
  scope: scopeSchema.optional(),
  status: definitionStatusSchema.optional(),
  role: roleSchema.optional(),
  q: z.string().max(100).optional(),
  teamId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  cursor: z.string().max(200).optional(),
})

const enableSchema = z
  .object({ ifVersion: z.number().int().positive(), reason: z.string().max(300).optional() })
  .strict()
const rollbackSchema = z
  .object({
    targetVersion: z.number().int().positive(),
    ifVersion: z.number().int().positive(),
    reason: z.string().max(300).optional(),
  })
  .strict()

const deleteApprovalSchema = z
  .object({
    precheckToken: z.string().min(20).max(4096),
    reason: z.string().max(300).optional(),
  })
  .strict()

const purgeApprovalSchema = z
  .object({
    confirmName: z.string().min(1).max(32),
    reason: z.string().max(300).optional(),
  })
  .strict()

const approveSchema = z
  .object({
    typedName: z.string().min(1).max(100),
    reason: z.string().max(300).optional(),
  })
  .strict()

const rejectSchema = z.object({ reason: z.string().max(300).optional() }).strict()

const approvalListQuerySchema = z.object({
  status: z.enum(APPROVAL_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  cursor: z.string().max(200).optional(),
})

const definitionRunsQuerySchema = z.object({
  status: z.enum(RUN_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  cursor: z.string().max(200).optional(),
})

/** 我的运行列表:总管右侧按本次对话 sessionId 收口,只列自己派出去的智能体。 */
const ownerRunsQuerySchema = z.object({
  sessionId: z.string().min(1).max(64).optional(),
  status: z.enum(RUN_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const runLogsQuerySchema = z.object({
  afterSeq: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

function actorOf(request: FastifyRequest): AgentRegistryActor {
  const userId = request.userId
  if (!userId) {
    throw Object.assign(new Error('Authentication required'), { statusCode: 401 })
  }
  return {
    userId,
    roleId: request.jwtPayload?.roleId ?? request.internalUserRoleId ?? 0,
    requestId: request.id,
    traceId: (request.headers['x-trace-id'] as string | undefined) ?? undefined,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  }
}

function withRequestId<T>(request: FastifyRequest, data: T): T & { requestId: string } {
  return { ...data, requestId: request.id }
}

async function notifyRegistryChanged(
  request: FastifyRequest,
  action: string,
  data: unknown,
): Promise<void> {
  const record =
    data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const id = typeof record.id === 'string' ? record.id : undefined
  await publishAgentRegistryChanged(request.server, {
    version: snapshotVersionFromUpdatedAt(record.updatedAt),
    ids: id ? [id] : [],
    action,
  })
}

/**
 * 灰度开关（01 §11.1）。默认开启，只有显式 `false` 才关闭：
 * 这不是 rollout 默认，而是本仓已经上线服务的 kill switch 口径 ——
 * 开关名必须能在一分钟内把写面打回只读，同时不改变开发/测试的默认可用性。
 */
function assertRegistryWriteEnabled(request: FastifyRequest): void {
  const path = request.url.split('?')[0] ?? request.url
  const method = request.method
  if (method === 'GET' || method === 'HEAD') return
  if (method === 'POST' && path.endsWith('/precheck-delete')) return

  if (process.env.AGENT_REGISTRY_WRITE === 'false') {
    throw new AppError('注册表写面已关闭（AGENT_REGISTRY_WRITE=false）', 503, 'FEATURE_DISABLED')
  }

  const destructive =
    method === 'DELETE' ||
    path.endsWith('/purge') ||
    path.endsWith('/restore') ||
    path.includes('/approvals/')
  if (destructive && process.env.AGENT_REGISTRY_DELETE === 'false') {
    throw new AppError('注册表删除面已关闭（AGENT_REGISTRY_DELETE=false）', 503, 'FEATURE_DISABLED')
  }
}

export const agentRegistryRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAuth)
  server.addHook('preHandler', async (request) => assertRegistryWriteEnabled(request))

  server.get('/definitions', async (request, reply) => {
    const actor = actorOf(request)
    const query = parseOrThrow(listQuerySchema, request.query)
    const result = await listAgentDefinitions(actor, {
      scope: query.scope as Scope | undefined,
      status: query.status as DefinitionStatus | undefined,
      role: query.role as AgentRegistryRole | undefined,
      teamId: query.teamId,
      search: query.q,
      limit: query.limit,
      offset: query.offset,
      cursor: query.cursor,
    })
    return reply.send(
      withRequestId(
        request,
        success({
          items: result.list,
          total: result.total,
          nextCursor: result.nextCursor,
          limit: result.limit,
          offset: result.offset,
        }),
      ),
    )
  })

  server.post('/definitions', async (request, reply) => {
    const actor = actorOf(request)
    const body = parseOrThrow(createDefinitionSchema, request.body)
    return runIdempotent(request.server, request, reply, 'definitions.create', async () => {
      const created = await createAgentDefinition(actor, body as CreateAgentDefinitionInput)
      await notifyRegistryChanged(request, 'definition.created', created)
      return {
        statusCode: 201,
        body: withRequestId(request, success(created)),
      }
    })
  })

  server.get('/definitions/:id', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const definition = await getAgentDefinition(actor, params.id)
    return reply.send(withRequestId(request, success(definition)))
  })

  server.patch('/definitions/:id', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const body = parseOrThrow(updateDefinitionSchema, request.body)
    const updated = await updateAgentDefinition(
      actor,
      params.id,
      body as UpdateAgentDefinitionInput,
    )
    await notifyRegistryChanged(request, 'definition.updated', updated)
    return reply.send(withRequestId(request, success(updated)))
  })

  server.post('/definitions/:id/clone', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const body = parseOrThrow(cloneDefinitionSchema, request.body ?? {})
    return runIdempotent(request.server, request, reply, 'definitions.clone', async () => {
      const cloned = await cloneAgentDefinition(actor, params.id, body as CloneAgentDefinitionInput)
      await notifyRegistryChanged(request, 'definition.cloned', cloned)
      return {
        statusCode: 201,
        body: withRequestId(request, success(cloned)),
      }
    })
  })

  server.post('/definitions/:id/enable', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const body = parseOrThrow(enableSchema, request.body)
    return runIdempotent(request.server, request, reply, 'definitions.enable', async () => {
      const updated = await setAgentDefinitionEnabled(actor, params.id, true, body.ifVersion)
      await notifyRegistryChanged(request, 'definition.enabled', updated)
      return { statusCode: 200, body: withRequestId(request, success(updated)) }
    })
  })

  server.post('/definitions/:id/disable', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const body = parseOrThrow(enableSchema, request.body)
    return runIdempotent(request.server, request, reply, 'definitions.disable', async () => {
      const updated = await setAgentDefinitionEnabled(actor, params.id, false, body.ifVersion)
      await notifyRegistryChanged(request, 'definition.disabled', updated)
      return { statusCode: 200, body: withRequestId(request, success(updated)) }
    })
  })

  server.get('/definitions/:id/versions', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const query = parseOrThrow(
      z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }),
      request.query,
    )
    const versions = await listAgentDefinitionVersions(actor, params.id, query.limit)
    return reply.send(withRequestId(request, success({ items: versions })))
  })

  server.get('/definitions/:id/versions/:version', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(
      z.object({ id: uuidSchema, version: z.coerce.number().int().positive() }),
      request.params,
    )
    const version = await getAgentDefinitionVersion(actor, params.id, params.version)
    return reply.send(withRequestId(request, success(version)))
  })

  server.post('/definitions/:id/rollback', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const body = parseOrThrow(rollbackSchema, request.body)
    return runIdempotent(request.server, request, reply, 'definitions.rollback', async () => {
      const result = await rollbackAgentDefinition(
        actor,
        params.id,
        body.targetVersion,
        body.ifVersion,
      )
      if ('requiresApproval' in result) {
        return { statusCode: 428, body: withRequestId(request, success(result)) }
      }
      await notifyRegistryChanged(request, 'definition.rolled_back', result)
      return { statusCode: 200, body: withRequestId(request, success(result)) }
    })
  })

  server.post('/definitions/:id/precheck-delete', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const report = await precheckDelete(actor, params.id)
    return reply.send(withRequestId(request, success(report)))
  })

  server.delete('/definitions/:id', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const body = parseOrThrow(deleteApprovalSchema, request.body)
    return runIdempotent(request.server, request, reply, 'definitions.delete', async () => {
      const approval = await createDeleteApproval(actor, params.id, body.precheckToken, body.reason)
      return { statusCode: 202, body: withRequestId(request, success(approval)) }
    })
  })

  server.post('/definitions/:id/purge', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const body = parseOrThrow(purgeApprovalSchema, request.body)
    return runIdempotent(request.server, request, reply, 'definitions.purge', async () => {
      const approval = await createPurgeApproval(actor, params.id, body.confirmName, body.reason)
      return { statusCode: 202, body: withRequestId(request, success(approval)) }
    })
  })

  server.post('/definitions/:id/restore', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    return runIdempotent(request.server, request, reply, 'definitions.restore', async () => {
      const restored = await restoreAgentDefinition(actor, params.id)
      await notifyRegistryChanged(request, 'definition.restored', restored)
      return { statusCode: 200, body: withRequestId(request, success(restored)) }
    })
  })

  server.get('/approvals', async (request, reply) => {
    const actor = actorOf(request)
    const query = parseOrThrow(approvalListQuerySchema, request.query)
    const result = await listApprovals(actor, query.status, query.limit, query.offset)
    return reply.send(
      withRequestId(
        request,
        success({ items: result.items, total: result.total, nextCursor: null }),
      ),
    )
  })

  server.get('/approvals/:id', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const approval = await getApproval(actor, params.id)
    return reply.send(withRequestId(request, success(approval)))
  })

  server.post('/approvals/:id/approve', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const body = parseOrThrow(approveSchema, request.body)
    return runIdempotent(request.server, request, reply, 'approvals.approve', async () => {
      const result = await approveApproval(actor, params.id, body.typedName, body.reason)
      await notifyRegistryChanged(request, 'approval.approved', result)
      return { statusCode: 200, body: withRequestId(request, success(result)) }
    })
  })

  server.post('/approvals/:id/reject', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const body = parseOrThrow(rejectSchema, request.body)
    return runIdempotent(request.server, request, reply, 'approvals.reject', async () => {
      const approval = await rejectApproval(actor, params.id, body.reason)
      return { statusCode: 200, body: withRequestId(request, success(approval)) }
    })
  })

  server.get('/definitions/:id/runs', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const query = parseOrThrow(definitionRunsQuerySchema, request.query)
    const result = await listDefinitionRuns(actor, params.id, {
      status: query.status as RunStatus | undefined,
      limit: query.limit,
      offset: query.offset,
    })
    return reply.send(
      withRequestId(
        request,
        success({ items: result.items, total: result.total, nextCursor: null }),
      ),
    )
  })

  /**
   * 总管右侧「智能体」的真实数据面(2026-11-28):
   * 不是注册表模板,而是"这次对话里总管派出去、已经跑起来/跑完的智能体"。
   * 前端传当前总管 chat 的 sessionId,后端按 owner + session 收口。
   */
  server.get('/runs', async (request, reply) => {
    const actor = actorOf(request)
    const query = parseOrThrow(ownerRunsQuerySchema, request.query)
    const result = await listOwnerRuns(actor, {
      sessionId: query.sessionId,
      status: query.status as RunStatus | undefined,
      limit: query.limit,
      offset: query.offset,
    })
    return reply.send(
      withRequestId(
        request,
        success({ items: result.items, total: result.total, nextCursor: null }),
      ),
    )
  })

  server.get('/runs/:runId', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ runId: uuidSchema }), request.params)
    const run = await getAgentRun(actor, params.runId)
    return reply.send(withRequestId(request, success(run)))
  })

  server.get('/runs/:runId/logs', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ runId: uuidSchema }), request.params)
    const query = parseOrThrow(runLogsQuerySchema, request.query)
    const result = await listAgentRunEvents(actor, params.runId, query)
    return reply.send(withRequestId(request, success(result)))
  })

  server.get('/runs/:runId/artifacts', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ runId: uuidSchema }), request.params)
    const result = await listRunArtifacts(actor, params.runId)
    return reply.send(withRequestId(request, success(result)))
  })

  server.get('/runs/:runId/stats', async (request, reply) => {
    const actor = actorOf(request)
    const params = parseOrThrow(z.object({ runId: uuidSchema }), request.params)
    const stats = await getAgentRunStats(actor, params.runId)
    return reply.send(withRequestId(request, success(stats)))
  })
}
