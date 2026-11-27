// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管智能体 · 内部注册表只读面（R1 / 01 §4.5）。
 *
 * 只给第一方服务（ai-service / 调度器）用票据访问：
 * - `GET /snapshot`：定义全量快照（含墓碑，含完整提示词），用于 R2 的本地缓存校准；
 * - `GET /definitions/resolve`：按 id 或 name 解析，再做一次与公开 API 相同的可见性裁切。
 *
 * 写入型内部端点（runs / events / ops）留给 R2：那边要定义运行状态机的 CAS 规则，
 * 在 R1 里先造一套会逼 R2 兼容两套语义。
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { checkInternalServiceToken } from '../plugins/internal-service-token.js'
import { AppError } from '../errors/AppError.js'
import {
  cloneAgentDefinition,
  createAgentDefinition,
  getAgentDefinition,
  listAgentDefinitionVersions,
  listAgentDefinitions,
  resolveAgentDefinitionForInternal,
  rollbackAgentDefinition,
  setAgentDefinitionEnabled,
  snapshotAgentDefinitionsForInternal,
  updateAgentDefinition,
  type AgentRegistryActor,
  type CreateAgentDefinitionInput,
  type UpdateAgentDefinitionInput,
} from '../services/agent-registry-service.js'
import {
  createDeleteApproval,
  precheckDelete,
  restoreAgentDefinition,
} from '../services/agent-registry-approval-service.js'
import {
  getAgentRun,
  getAgentRunStats,
  listAgentRunEvents,
  listDefinitionRuns,
  listRunArtifacts,
} from '../services/agent-registry-runs-service.js'
import {
  publishAgentRegistryChanged,
  snapshotVersionFromUpdatedAt,
} from '../services/agent-registry-invalidation.js'
import {
  appendRunEvent,
  createOrUpdateRun,
  recordInternalAgentAudit,
  updateRun,
  type CreateRunInput,
  type UpdateRunInput,
} from '../services/agent-registry-run-write-service.js'
import { parseOrThrow, success } from '../utils/response.js'

function withRequestId<T>(request: { id: string }, data: T): T & { requestId: string } {
  return { ...data, requestId: request.id }
}

const scopeSchema = z.enum(['personal', 'team', 'system'])
const uuidSchema = z.string().uuid()

const snapshotQuerySchema = z.object({
  updatedAfter: z.iso.datetime().optional(),
  includeDeleted: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => (typeof value === 'boolean' ? value : value === 'true'))
    .optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
})

const resolveQuerySchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(32).optional(),
    scope: scopeSchema.optional(),
    teamId: z.string().uuid().optional(),
    ownerUserId: z.string().uuid().optional(),
  })
  .refine((value) => value.id !== undefined || value.name !== undefined, {
    message: '必须提供 id 或 name',
  })

function actorOf(request: Parameters<typeof checkInternalServiceToken>[0]): AgentRegistryActor {
  return {
    userId: request.userId ?? '',
    roleId: request.internalUserRoleId ?? 0,
    requestId: request.id,
  }
}

const runModeSchema = z.enum([
  'single',
  'parallel',
  'pipeline',
  'debate',
  'vote',
  'critique',
  'decomposed',
  'team',
  'recursive',
])

const runStatusSchema = z.enum([
  'queued',
  'running',
  'paused',
  'succeeded',
  'failed',
  'canceled',
  'timeout',
  'blocked',
])

const eventTypeSchema = z.enum([
  'status',
  'step',
  'tool',
  'error',
  'artifact',
  'steer',
  'checkpoint',
  'approval',
  'note',
])

const createRunSchema = z
  .object({
    runId: z.string().uuid().nullish(),
    definitionId: z.string().uuid(),
    definitionVersion: z.number().int().min(1),
    definitionName: z.string().min(1).max(100),
    ownerUserId: z.string().uuid().nullish(),
    teamId: z.string().uuid().nullish(),
    parentRunId: z.string().uuid().nullish(),
    dispatchId: z.string().min(1).max(64).nullish(),
    sessionId: z.string().min(1).max(64).nullish(),
    mode: runModeSchema,
    goal: z.string().min(1).max(20_000),
    traceId: z.string().min(1).max(64),
    status: runStatusSchema.optional(),
    startedAt: z.iso.datetime().nullish(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const updateRunSchema = z
  .object({
    status: runStatusSchema.optional(),
    inputTokens: z.number().int().min(0).optional(),
    outputTokens: z.number().int().min(0).optional(),
    costPoints: z
      .string()
      .regex(/^\d{1,12}(\.\d{1,4})?$/, 'costPoints 必须是 12,4 精度内的小数')
      .optional(),
    errorCode: z.string().max(64).nullish(),
    errorMessage: z.string().max(2000).nullish(),
    artifactCount: z.number().int().min(0).optional(),
    startedAt: z.iso.datetime().nullish(),
    endedAt: z.iso.datetime().nullish(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const appendEventSchema = z
  .object({
    seq: z.number().int().min(1),
    type: eventTypeSchema,
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict()

const internalAuditSchema = z
  .object({
    action: z.string().min(8).max(96),
    resourceType: z.string().min(1).max(64),
    resourceId: z.string().uuid().nullish(),
    result: z.enum(['success', 'failure']).default('success'),
    metadata: z.record(z.string(), z.unknown()).optional(),
    ip: z.string().max(64).nullish(),
    userAgent: z.string().max(512).nullish(),
  })
  .strict()

const registryOpsSchema = z
  .object({
    action: z.enum([
      'list',
      'inspect',
      'create',
      'update',
      'clone',
      'disable',
      'enable',
      'rollback',
      'precheck_delete',
      'delete',
      'restore',
      'run_list',
      'run_get',
      'run_logs',
      'run_artifacts',
      'run_stats',
      'health',
    ]),
    id: z.string().uuid().optional(),
    runId: z.string().uuid().optional(),
    definitionId: z.string().uuid().optional(),
    name: z.string().min(1).max(64).optional(),
    displayName: z.string().min(1).max(100).optional(),
    description: z.string().max(4000).optional(),
    scope: scopeSchema.optional(),
    teamId: z.string().uuid().nullish(),
    role: z.string().max(32).optional(),
    systemPrompt: z.string().max(32768).optional(),
    model: z.string().max(100).nullish(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(200000).nullish(),
    tools: z.array(z.string().max(80)).max(64).optional(),
    skills: z.array(z.string().max(80)).max(64).optional(),
    permissions: z.record(z.string(), z.unknown()).optional(),
    memoryPolicy: z.record(z.string(), z.unknown()).optional(),
    budget: z.record(z.string(), z.unknown()).optional(),
    concurrencyLimit: z.number().int().min(1).max(8).optional(),
    isDispatchable: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    ifVersion: z.number().int().positive().optional(),
    targetVersion: z.number().int().positive().optional(),
    precheckToken: z.string().min(20).max(4096).optional(),
    reason: z.string().max(500).optional(),
    query: z.string().max(80).optional(),
    status: z.enum(['active', 'disabled', 'deleted']).optional(),
    runStatus: z
      .enum(['queued', 'running', 'paused', 'succeeded', 'failed', 'canceled', 'timeout', 'blocked'])
      .optional(),
    afterSeq: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    cursor: z.string().max(256).optional(),
    includeVersions: z.boolean().default(false),
  })
  .strict()

function requireField<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null) {
    throw new AppError(`action 缺少字段 ${name}`, 400, 'AGENT_ACTION_INVALID')
  }
  return value
}

export async function agentRegistryInternalRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('preHandler', async (request, reply) => {
    const ok = await checkInternalServiceToken(request, reply, { scope: 'agent-registry' })
    if (!ok) return reply
  })

  server.get('/snapshot', async (request, reply) => {
    const query = parseOrThrow(snapshotQuerySchema, request.query)
    const updatedAfter = query.updatedAfter ? new Date(query.updatedAfter) : undefined
    const items = await snapshotAgentDefinitionsForInternal({
      updatedAfter,
      includeDeleted: query.includeDeleted ?? true,
      limit: query.limit,
    })
    const version = items.reduce((max, item) => {
      const parsed = Date.parse(item.updatedAt)
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max
    }, 0)
    return reply.send(
      withRequestId(
        request,
        success({
          items,
          version,
          serverTime: new Date().toISOString(),
          updatedAfter: query.updatedAfter ?? null,
        }),
      ),
    )
  })

  server.get('/definitions/resolve', async (request, reply) => {
    const query = parseOrThrow(resolveQuerySchema, request.query)
    const resolved = await resolveAgentDefinitionForInternal(actorOf(request), {
      id: query.id,
      name: query.name,
      scope: query.scope,
      teamId: query.teamId,
      ownerUserId: query.ownerUserId,
    })
    return reply.send(
      withRequestId(
        request,
        success({
          definition: resolved,
          resolvedBy: {
            userId: request.userId ?? null,
            requestId: request.id,
          },
        }),
      ),
    )
  })

  server.post('/runs', async (request, reply) => {
    const body = parseOrThrow(createRunSchema, request.body)
    const result = await createOrUpdateRun(actorOf(request), body as CreateRunInput)
    return reply.status(result.created ? 201 : 200).send(withRequestId(request, success(result)))
  })

  server.patch('/runs/:id', async (request, reply) => {
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const patch = parseOrThrow(updateRunSchema, request.body)
    const run = await updateRun(actorOf(request), params.id, patch as UpdateRunInput)
    return reply.send(withRequestId(request, success({ run })))
  })

  server.post('/runs/:id/events', async (request, reply) => {
    const params = parseOrThrow(z.object({ id: uuidSchema }), request.params)
    const body = parseOrThrow(appendEventSchema, request.body)
    const result = await appendRunEvent(actorOf(request), params.id, body)
    return reply.status(result.duplicate ? 200 : 201).send(withRequestId(request, success(result)))
  })

  server.post('/audit', async (request, reply) => {
    const body = parseOrThrow(internalAuditSchema, request.body)
    const auditId = await recordInternalAgentAudit(actorOf(request), body)
    return reply.status(201).send(withRequestId(request, success({ auditId })))
  })

  /**
   * 给总管工具的注册表 action 面（P3-04）。只暴露定义域动作；
   * `purge` 永远不在这里，模型不能彻底删除。删除/回滚仍只创建审批，
   * 不代替用户在卡片上确认。
   */
  server.post('/ops', async (request, reply) => {
    const body = parseOrThrow(registryOpsSchema, request.body)
    const actor = actorOf(request)
    let result: unknown

    switch (body.action) {
      case 'list':
        result = await listAgentDefinitions(actor, {
          status: body.status,
          search: body.query,
          limit: body.limit,
          cursor: body.cursor,
        })
        break
      case 'inspect': {
        const definition = await getAgentDefinition(
          actor,
          requireField(body.id, 'id'),
        )
        result = body.includeVersions
          ? {
              definition,
              versions: await listAgentDefinitionVersions(actor, definition.id, 50),
            }
          : definition
        break
      }
      case 'create':
        result = await createAgentDefinition(actor, {
          scope: requireField(body.scope, 'scope') as 'personal' | 'team' | 'system',
          name: requireField(body.name, 'name'),
          displayName: requireField(body.displayName, 'displayName'),
          description: body.description,
          role: body.role,
          systemPrompt: requireField(body.systemPrompt, 'systemPrompt'),
          model: body.model,
          temperature: body.temperature,
          maxTokens: body.maxTokens,
          tools: body.tools,
          skills: body.skills,
          permissions: body.permissions,
          memoryPolicy: body.memoryPolicy,
          budget: body.budget,
          concurrencyLimit: body.concurrencyLimit,
          isDispatchable: body.isDispatchable,
          metadata: body.metadata,
          teamId: body.teamId,
          reason: body.reason,
        } as CreateAgentDefinitionInput)
        break
      case 'update':
        result = await updateAgentDefinition(actor, requireField(body.id, 'id'), {
          ifVersion: requireField(body.ifVersion, 'ifVersion'),
          name: body.name,
          displayName: body.displayName,
          description: body.description,
          role: body.role,
          systemPrompt: body.systemPrompt,
          model: body.model,
          temperature: body.temperature,
          maxTokens: body.maxTokens,
          tools: body.tools,
          skills: body.skills,
          permissions: body.permissions,
          memoryPolicy: body.memoryPolicy,
          budget: body.budget,
          concurrencyLimit: body.concurrencyLimit,
          isDispatchable: body.isDispatchable,
          metadata: body.metadata,
          reason: body.reason,
        } as UpdateAgentDefinitionInput)
        break
      case 'clone':
        result = await cloneAgentDefinition(actor, requireField(body.id, 'id'), {
          name: requireField(body.name, 'name'),
          displayName: body.displayName,
          scope: body.scope as 'personal' | 'team' | 'system' | undefined,
          teamId: body.teamId,
          reason: body.reason,
        })
        break
      case 'disable':
        result = await setAgentDefinitionEnabled(
          actor,
          requireField(body.id, 'id'),
          false,
          requireField(body.ifVersion, 'ifVersion'),
        )
        break
      case 'enable':
        result = await setAgentDefinitionEnabled(
          actor,
          requireField(body.id, 'id'),
          true,
          requireField(body.ifVersion, 'ifVersion'),
        )
        break
      case 'rollback':
        result = await rollbackAgentDefinition(
          actor,
          requireField(body.id, 'id'),
          requireField(body.targetVersion, 'targetVersion'),
          requireField(body.ifVersion, 'ifVersion'),
        )
        break
      case 'precheck_delete':
        result = await precheckDelete(actor, requireField(body.id, 'id'))
        break
      case 'delete':
        result = await createDeleteApproval(
          actor,
          requireField(body.id, 'id'),
          requireField(body.precheckToken, 'precheckToken'),
          body.reason,
        )
        break
      case 'restore':
        result = await restoreAgentDefinition(actor, requireField(body.id, 'id'))
        break
      case 'run_list':
        result = await listDefinitionRuns(actor, requireField(body.definitionId, 'definitionId'), {
          status: body.runStatus,
          limit: body.limit,
          offset: 0,
        })
        break
      case 'run_get':
        result = await getAgentRun(actor, requireField(body.runId, 'runId'))
        break
      case 'run_logs':
        result = await listAgentRunEvents(actor, requireField(body.runId, 'runId'), {
          afterSeq: body.afterSeq,
          limit: body.limit,
        })
        break
      case 'run_artifacts':
        result = await listRunArtifacts(actor, requireField(body.runId, 'runId'))
        break
      case 'run_stats':
        result = await getAgentRunStats(actor, requireField(body.runId, 'runId'))
        break
      case 'health':
        result = {
          ok: true,
          service: 'agent-registry',
          serverTime: new Date().toISOString(),
        }
        break
      default:
        throw new AppError(`未知 action ${String(body.action)}`, 400, 'AGENT_ACTION_INVALID')
    }

    const mutating =
      ![
        'list',
        'inspect',
        'precheck_delete',
        'delete',
        'run_list',
        'run_get',
        'run_logs',
        'run_artifacts',
        'run_stats',
        'health',
      ].includes(body.action) &&
      !(typeof result === 'object' && result !== null && 'requiresApproval' in result)
    if (mutating) {
      const record =
        result !== null && typeof result === 'object'
          ? (result as Record<string, unknown>)
          : {}
      await publishAgentRegistryChanged(request.server, {
        version: snapshotVersionFromUpdatedAt(record.updatedAt),
        ids: typeof record.id === 'string' ? [record.id] : [],
        action: `internal.${body.action}`,
      })
    }

    return reply.send(withRequestId(request, success({ action: body.action, result })))
  })
}
