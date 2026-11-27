// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管智能体 · 一次性审批与删除生命周期（R1 / 01 §6.4）。
 *
 * 关键纪律（与 approval_persistence 的 session/always 语义刻意不同）：
 * - 模型只能创建 pending 审批，不能直接删；
 * - 审批绑定 actor + definition + version + impactHash，执行前重跑预检；
 * - 审批 10 分钟过期，消费一次即失效，不存在"以后都允许"；
 * - 内置定义拒绝删除；软删保留 30 天才允许彻底删。
 */

import { createHash } from 'node:crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
import { agentDefinitions, agentManagementApprovals } from '@ihui/database'
import { httpStatusForErrorCode, type ApprovalStatus, type AgentErrorCode } from '@ihui/shared'
import { AppError } from '../errors/AppError.js'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import {
  canManageDefinition,
  findDefinitionOrThrow,
  toDefinitionView,
  writeDefinitionVersion,
  writeRegistryAudit,
  type AgentDefinitionView,
  type AgentRegistryActor,
} from './agent-registry-service.js'
import {
  buildPrecheckReport,
  precheckDefinitionDeletion,
  recheckBeforeExecution,
  verifyPrecheckToken,
  type PrecheckResult,
} from './agent-registry-precheck-service.js'

export const APPROVAL_TTL_MS = 10 * 60 * 1000
const DELETE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export interface AgentApprovalView {
  id: string
  action: 'delete' | 'purge' | 'rollback'
  status: ApprovalStatus
  definitionId: string | null
  definitionName: string
  definitionVersion: number
  impactSnapshot: Record<string, unknown>
  reason: string | null
  requestedAt: string
  decidedAt: string | null
  consumedAt: string | null
  expiresAt: string
  errorMessage: string | null
}

export interface DeleteApprovalResult {
  approvalId: string
  status: 'pending'
  expiresAt: string
  impact: Record<string, unknown>
  auditId?: string
}

export interface ApproveApprovalResult {
  approval: AgentApprovalView
  definition: AgentDefinitionView
  auditId: string
}

function fail(code: AgentErrorCode, message: string): never {
  throw new AppError(message, httpStatusForErrorCode(code), code)
}

function toApprovalView(row: typeof agentManagementApprovals.$inferSelect): AgentApprovalView {
  return {
    id: row.id,
    action: row.action,
    status: row.status,
    definitionId: row.definitionId,
    definitionName: row.definitionName,
    definitionVersion: row.definitionVersion,
    impactSnapshot: row.impactSnapshot,
    reason: row.reason,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    consumedAt: row.consumedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    errorMessage: row.errorMessage,
  }
}

async function loadApprovalOrThrow(
  id: string,
): Promise<typeof agentManagementApprovals.$inferSelect> {
  const rows = await db
    .select()
    .from(agentManagementApprovals)
    .where(eq(agentManagementApprovals.id, id))
    .limit(1)
  const row = rows[0]
  if (!row) fail('APPROVAL_NOT_FOUND', '审批不存在')
  return row
}

/** 预检入口（带管理权校验）。返回报告 + 一次性 token。 */
export async function precheckDelete(
  actor: AgentRegistryActor,
  definitionId: string,
): Promise<PrecheckResult> {
  const definition = await findDefinitionOrThrow(definitionId)
  if (!(await canManageDefinition(actor, definition))) {
    fail('AGENT_FORBIDDEN', '无权预检该智能体定义')
  }
  if (definition.isBuiltin) fail('AGENT_PROTECTED', '内置定义不能删除')
  if (definition.status === 'deleted') fail('AGENT_DELETED', '定义已经是删除状态')
  return precheckDefinitionDeletion(definition, actor.userId)
}

/** 发起软删审批。只创建 pending，不执行删除。 */
export async function createDeleteApproval(
  actor: AgentRegistryActor,
  definitionId: string,
  precheckToken: string,
  reason: string | undefined,
): Promise<DeleteApprovalResult> {
  const definition = await findDefinitionOrThrow(definitionId)
  if (!(await canManageDefinition(actor, definition))) {
    fail('AGENT_FORBIDDEN', '无权删除该智能体定义')
  }
  if (definition.isBuiltin) fail('AGENT_PROTECTED', '内置定义不能删除')
  if (definition.status === 'deleted') fail('AGENT_DELETED', '定义已经是删除状态')

  const report = await buildPrecheckReport(definition)
  verifyPrecheckToken(precheckToken, actor.userId, report)
  if (report.blocking.length > 0) {
    fail('AGENT_DELETE_BLOCKED', '存在阻断项，不能发起删除')
  }

  const tokenHash = createHash('sha256').update(precheckToken).digest('hex')
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS)
  const inserted = await db
    .insert(agentManagementApprovals)
    .values({
      definitionId: definition.id,
      definitionName: definition.name,
      definitionVersion: definition.version,
      action: 'delete',
      actorUserId: actor.userId,
      status: 'pending',
      precheckTokenHash: tokenHash,
      impactHash: report.impactHash.replace(/^sha256:/, ''),
      impactSnapshot: report as unknown as Record<string, unknown>,
      reason: reason ?? null,
      requestId: actor.requestId ?? null,
      traceId: actor.traceId ?? null,
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
      expiresAt,
    })
    .returning()
  const approval = inserted[0]
  if (!approval) fail('AGENT_INTERNAL_ERROR', '创建审批后未返回行')

  const auditId = await writeRegistryAudit(
    actor,
    'agent.definition.delete_requested',
    definition,
    'success',
    {
      approvalId: approval.id,
      impactHash: report.impactHash,
    },
  )
  return {
    approvalId: approval.id,
    status: 'pending',
    expiresAt: approval.expiresAt.toISOString(),
    impact: report as unknown as Record<string, unknown>,
    auditId,
  }
}

/** 当前用户的审批列表。只返回自己的审批，不返回他人影响快照。 */
export async function listApprovals(
  actor: AgentRegistryActor,
  status: ApprovalStatus | undefined,
  limit = 20,
  offset = 0,
): Promise<{ items: AgentApprovalView[]; total: number }> {
  const filters = [eq(agentManagementApprovals.actorUserId, actor.userId)]
  if (status !== undefined) filters.push(eq(agentManagementApprovals.status, status))
  const where = and(...filters)
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(agentManagementApprovals)
      .where(where)
      .orderBy(desc(agentManagementApprovals.requestedAt))
      .limit(Math.min(Math.max(limit, 1), 100))
      .offset(Math.max(offset, 0)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentManagementApprovals)
      .where(where),
  ])
  return { items: rows.map(toApprovalView), total: countRows[0]?.count ?? 0 }
}

/** 审批详情。非本人按 404 处理，不泄漏是否存在。 */
export async function getApproval(
  actor: AgentRegistryActor,
  id: string,
): Promise<AgentApprovalView> {
  const row = await loadApprovalOrThrow(id)
  if (row.actorUserId !== actor.userId) fail('APPROVAL_NOT_FOUND', '审批不存在')
  return toApprovalView(row)
}

/** 拒绝。pending → rejected；不执行。 */
export async function rejectApproval(
  actor: AgentRegistryActor,
  id: string,
  reason: string | undefined,
): Promise<AgentApprovalView> {
  const row = await loadApprovalOrThrow(id)
  if (row.actorUserId !== actor.userId) fail('APPROVAL_NOT_FOUND', '审批不存在')
  if (row.status === 'consumed') fail('APPROVAL_CONSUMED', '审批已消费')
  if (row.status === 'expired') fail('APPROVAL_EXPIRED', '审批已过期')
  if (row.status !== 'pending' && row.status !== 'approved') {
    fail('APPROVAL_MISMATCH', `审批当前状态 ${row.status} 不能拒绝`)
  }
  const updated = await db
    .update(agentManagementApprovals)
    .set({ status: 'rejected', decidedAt: new Date(), reason: reason ?? row.reason })
    .where(
      and(eq(agentManagementApprovals.id, id), eq(agentManagementApprovals.status, row.status)),
    )
    .returning()
  const approval = updated[0]
  if (!approval) fail('APPROVAL_CONSUMED', '审批状态已变化')
  await writeRegistryAudit(
    actor,
    'agent.definition.delete_rejected',
    { id: row.definitionId ?? '', name: row.definitionName, version: row.definitionVersion },
    'success',
    { approvalId: id },
  )
  return toApprovalView(approval)
}

/** 批准并执行软删。行锁 + 状态 CAS + 重跑预检，三者缺一不可。 */
export async function approveApproval(
  actor: AgentRegistryActor,
  id: string,
  typedName: string,
  reason: string | undefined,
): Promise<ApproveApprovalResult> {
  const row = await loadApprovalOrThrow(id)
  if (row.actorUserId !== actor.userId) fail('APPROVAL_NOT_FOUND', '审批不存在')
  if (row.status === 'consumed') fail('APPROVAL_CONSUMED', '审批已消费')
  if (row.status === 'expired') fail('APPROVAL_EXPIRED', '审批已过期')
  if (row.status !== 'pending') fail('APPROVAL_MISMATCH', `审批当前状态 ${row.status} 不能批准`)
  if (row.expiresAt.getTime() <= Date.now()) {
    await db
      .update(agentManagementApprovals)
      .set({ status: 'expired', decidedAt: new Date() })
      .where(
        and(eq(agentManagementApprovals.id, id), eq(agentManagementApprovals.status, 'pending')),
      )
    fail('APPROVAL_EXPIRED', '审批已过期')
  }
  if (typedName !== row.definitionName) {
    fail('APPROVAL_MISMATCH', '输入的定义名与审批目标不一致')
  }
  if (row.action !== 'delete') {
    fail('FEATURE_DISABLED', `审批动作 ${row.action} 的执行为后续切片`)
  }

  const definition = await findDefinitionOrThrow(row.definitionId ?? '')
  if (!(await canManageDefinition(actor, definition))) {
    fail('AGENT_FORBIDDEN', '无权执行该审批')
  }
  if (definition.isBuiltin) fail('AGENT_PROTECTED', '内置定义不能删除')
  if (definition.status === 'deleted') fail('AGENT_DELETED', '定义已经是删除状态')
  if (definition.version !== row.definitionVersion) {
    fail('APPROVAL_MISMATCH', '定义版本已变化，审批失效')
  }
  await recheckBeforeExecution(definition, `sha256:${row.impactHash}`)

  try {
    const executed = await db.transaction(async (tx) => {
      const locked = await tx
        .select()
        .from(agentManagementApprovals)
        .where(eq(agentManagementApprovals.id, id))
        .for('update')
        .limit(1)
      const lockedRow = locked[0]
      if (!lockedRow) fail('APPROVAL_NOT_FOUND', '审批不存在')
      if (lockedRow.status !== 'pending') fail('APPROVAL_CONSUMED', '审批已被处理')

      const now = new Date()
      const deleted = await tx
        .update(agentDefinitions)
        .set({
          status: 'deleted',
          deletedAt: now,
          purgeAfter: new Date(now.getTime() + DELETE_RETENTION_MS),
          version: definition.version + 1,
          updatedBy: actor.userId,
          updatedAt: now,
        })
        .where(
          and(
            eq(agentDefinitions.id, definition.id),
            eq(agentDefinitions.version, definition.version),
          ),
        )
        .returning()
      const updatedDefinition = deleted[0]
      if (!updatedDefinition) fail('AGENT_VERSION_CONFLICT', '定义版本已变化，审批失效')

      await writeDefinitionVersion(
        tx,
        updatedDefinition,
        'delete',
        actor.userId,
        reason ?? '审批删除',
      )

      const consumed = await tx
        .update(agentManagementApprovals)
        .set({
          status: 'consumed',
          decidedAt: now,
          consumedAt: now,
          errorMessage: null,
        })
        .where(
          and(eq(agentManagementApprovals.id, id), eq(agentManagementApprovals.status, 'pending')),
        )
        .returning()
      const consumedRow = consumed[0]
      if (!consumedRow) fail('APPROVAL_CONSUMED', '审批已被处理')
      return { updatedDefinition, consumedRow }
    })

    const auditId = await writeRegistryAudit(
      actor,
      'agent.definition.deleted',
      executed.updatedDefinition,
      'success',
      {
        approvalId: id,
        precheckHash: row.precheckTokenHash,
        impactHash: row.impactHash,
      },
    )
    return {
      approval: toApprovalView(executed.consumedRow),
      definition: toDefinitionView(executed.updatedDefinition),
      auditId,
    }
  } catch (error) {
    if (error instanceof AppError) {
      await db
        .update(agentManagementApprovals)
        .set({ status: 'failed', errorMessage: error.message.slice(0, 500) })
        .where(
          and(eq(agentManagementApprovals.id, id), eq(agentManagementApprovals.status, 'pending')),
        )
        .catch(() => undefined)
      throw error
    }
    logger.warn('[agent-registry] approve failed', { error: (error as Error).message })
    fail('AGENT_INTERNAL_ERROR', '执行删除失败')
  }
}

/** 恢复。30 天内、名称仍可用、定义确实处于 deleted。 */
export async function restoreAgentDefinition(
  actor: AgentRegistryActor,
  id: string,
): Promise<AgentDefinitionView> {
  const definition = await findDefinitionOrThrow(id)
  if (!(await canManageDefinition(actor, definition))) {
    fail('AGENT_FORBIDDEN', '无权恢复该智能体定义')
  }
  if (definition.status !== 'deleted' || definition.purgeAfter === null) {
    fail('AGENT_NOT_RESTORABLE', '定义不处于可恢复的删除状态')
  }
  if (definition.purgeAfter.getTime() <= Date.now()) {
    fail('AGENT_NOT_RESTORABLE', '已过 30 天保留期，不能恢复')
  }

  const conflict = await db
    .select({ id: agentDefinitions.id })
    .from(agentDefinitions)
    .where(
      and(
        eq(agentDefinitions.scope, definition.scope),
        eq(agentDefinitions.name, definition.name),
        definition.scope === 'personal'
          ? eq(agentDefinitions.ownerUserId, definition.ownerUserId ?? '')
          : definition.scope === 'team'
            ? eq(agentDefinitions.teamId, definition.teamId ?? '')
            : sql`true`,
        eq(agentDefinitions.status, 'active'),
      ),
    )
    .limit(1)
  if (conflict.length > 0) fail('AGENT_NAME_TAKEN', '同名定义已存在，不能恢复')

  const restored = await db.transaction(async (tx) => {
    const rows = await tx
      .update(agentDefinitions)
      .set({
        status: 'active',
        deletedAt: null,
        purgeAfter: null,
        version: definition.version + 1,
        updatedBy: actor.userId,
        updatedAt: new Date(),
      })
      .where(and(eq(agentDefinitions.id, id), eq(agentDefinitions.version, definition.version)))
      .returning()
    const row = rows[0]
    if (!row) fail('AGENT_VERSION_CONFLICT', '定义版本已变化，请重试')
    await writeDefinitionVersion(tx, row, 'restore', actor.userId, '恢复定义')
    return row
  })
  const auditId = await writeRegistryAudit(
    actor,
    'agent.definition.restored',
    restored,
    'success',
    {
      fromDeletedAt: definition.deletedAt?.toISOString() ?? null,
    },
  )
  return { ...toDefinitionView(restored, true), auditId }
}
