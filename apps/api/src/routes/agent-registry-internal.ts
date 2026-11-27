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
import { parseOrThrow, success } from '../utils/response.js'

function withRequestId<T>(request: { id: string }, data: T): T & { requestId: string } {
  return { ...data, requestId: request.id }
}

const scopeSchema = z.enum(['personal', 'team', 'system'])

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
}
