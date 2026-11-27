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
import {
  resolveAgentDefinitionForInternal,
  snapshotAgentDefinitionsForInternal,
  type AgentRegistryActor,
} from '../services/agent-registry-service.js'
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
    return reply.send(
      withRequestId(
        request,
        success({
          items,
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
}
