// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管智能体 · 运行账本内部写面（V2-04 / 01 §7.4）。
 *
 * 职责边界：
 * - ai-service 不直写库，只通过内部票调用这里；
 * - `POST /runs` 创建或更新 run，`runId` 已存在时按幂等成功返回；
 * - `POST /runs/:id/events` 追加事件，`(run_id, seq)` 重复返回 200；
 * - `POST /audit` 让 ai-service 补管理动作审计，不跨服务直写审计表。
 *
 * 状态机只在这里落库：`status` 事件是唯一能改 run 终态的事件；
 * 其它事件只刷新心跳与产物计数，避免“日志改了状态但账本没改”的双写分歧。
 */

import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import {
  agentDefinitions,
  agentRunEvents,
  agentRuns,
  type AgentRunEventType,
  type AgentRunMode,
  type AgentRunStatus,
} from '@ihui/database'
import { db } from '../db/index.js'
import { AppError } from '../errors/AppError.js'
import { httpStatusForErrorCode, type AgentErrorCode } from '@ihui/shared'
import { recordAuditLog } from './audit-log-service.js'
import { logger } from '../utils/logger.js'

const TERMINAL_STATUSES: readonly AgentRunStatus[] = ['succeeded', 'failed', 'canceled', 'timeout']

const RUN_STATUSES: readonly AgentRunStatus[] = [
  'queued',
  'running',
  'paused',
  'succeeded',
  'failed',
  'canceled',
  'timeout',
  'blocked',
]

function isRunStatus(value: unknown): value is AgentRunStatus {
  return typeof value === 'string' && (RUN_STATUSES as readonly string[]).includes(value)
}

const HEARTBEAT_STALE_MS = 5 * 60 * 1000
const HEARTBEAT_TIMEOUT_MS = 30 * 60 * 1000
const MAX_EVENT_PAYLOAD_BYTES = 16 * 1024
const PAYLOAD_PREVIEW_BYTES = 14 * 1024

export interface RunLedgerActor {
  userId: string
  requestId?: string
  traceId?: string
}

export interface CreateRunInput {
  runId?: string | null
  definitionId: string
  definitionVersion: number
  definitionName: string
  ownerUserId?: string | null
  teamId?: string | null
  parentRunId?: string | null
  dispatchId?: string | null
  sessionId?: string | null
  mode: AgentRunMode
  goal: string
  traceId: string
  status?: AgentRunStatus
  startedAt?: string | null
  metadata?: Record<string, unknown>
}

export interface UpdateRunInput {
  status?: AgentRunStatus
  inputTokens?: number
  outputTokens?: number
  costPoints?: string
  errorCode?: string | null
  errorMessage?: string | null
  artifactCount?: number
  startedAt?: string | null
  endedAt?: string | null
  metadata?: Record<string, unknown>
}

export interface RunLedgerView {
  runId: string
  definitionId: string | null
  definitionName: string
  definitionVersion: number
  ownerUserId: string
  teamId: string | null
  parentRunId: string | null
  dispatchId: string | null
  sessionId: string | null
  mode: AgentRunMode
  goal: string
  status: AgentRunStatus
  displayStatus: AgentRunStatus | 'stale' | 'unknown'
  startedAt: string | null
  endedAt: string | null
  lastHeartbeatAt: string | null
  inputTokens: number
  outputTokens: number
  costPoints: string
  errorCode: string | null
  errorMessage: string | null
  artifactCount: number
  traceId: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface RunEventView {
  id: number
  runId: string
  seq: number
  type: AgentRunEventType
  payload: Record<string, unknown>
  createdAt: string
}

function fail(code: AgentErrorCode, message: string): never {
  throw new AppError(message, httpStatusForErrorCode(code), code)
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null
}

function displayStatusOf(
  status: AgentRunStatus,
  lastHeartbeatAt: Date | null,
): RunLedgerView['displayStatus'] {
  if (status !== 'running' || lastHeartbeatAt === null) return status
  const age = Date.now() - lastHeartbeatAt.getTime()
  if (age > HEARTBEAT_TIMEOUT_MS) return 'timeout'
  if (age > HEARTBEAT_STALE_MS) return 'stale'
  return status
}

function toView(row: typeof agentRuns.$inferSelect): RunLedgerView {
  return {
    runId: row.id,
    definitionId: row.definitionId,
    definitionName: row.definitionName,
    definitionVersion: row.definitionVersion,
    ownerUserId: row.ownerUserId,
    teamId: row.teamId,
    parentRunId: row.parentRunId,
    dispatchId: row.dispatchId,
    sessionId: row.sessionId,
    mode: row.mode,
    goal: row.goal,
    status: row.status,
    displayStatus: displayStatusOf(row.status, row.lastHeartbeatAt),
    startedAt: iso(row.startedAt),
    endedAt: iso(row.endedAt),
    lastHeartbeatAt: iso(row.lastHeartbeatAt),
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    costPoints: row.costPoints,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    artifactCount: row.artifactCount,
    traceId: row.traceId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toEventView(row: typeof agentRunEvents.$inferSelect): RunEventView {
  return {
    id: Number(row.id),
    runId: row.runId,
    seq: row.seq,
    type: row.type,
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
  }
}

async function findRunOrThrow(runId: string): Promise<typeof agentRuns.$inferSelect> {
  const rows = await dbSelectRun(runId)
  const row = rows[0]
  if (!row) fail('AGENT_RUN_NOT_FOUND', '运行不存在')
  return row
}

async function dbSelectRun(runId: string) {
  return db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1)
}

async function assertOwner(
  actor: RunLedgerActor,
  row: typeof agentRuns.$inferSelect,
): Promise<void> {
  if (row.ownerUserId !== actor.userId) {
    fail('AGENT_FORBIDDEN', '无权写入该运行账本')
  }
}

async function assertDefinitionDispatchable(definitionId: string): Promise<void> {
  const rows = await db
    .select({ status: agentDefinitions.status })
    .from(agentDefinitions)
    .where(eq(agentDefinitions.id, definitionId))
    .limit(1)
  const row = rows[0]
  if (!row) fail('AGENT_NOT_FOUND', '定义不存在')
  if (row.status === 'deleted') fail('AGENT_DELETED', '定义已删除，不能创建运行')
  if (row.status !== 'active') fail('AGENT_DISABLED', '定义未启用，不能创建运行')
}

/** 创建或幂等更新 run。runId 已存在时只在请求带更新字段时写，否则原样返回。 */
export async function createOrUpdateRun(
  actor: RunLedgerActor,
  input: CreateRunInput,
): Promise<{ run: RunLedgerView; created: boolean }> {
  if (input.runId) {
    const existingRows = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, input.runId))
      .limit(1)
    const existing = existingRows[0]
    if (existing) {
      await assertOwner(actor, existing)
      const hasUpdate = hasRunUpdate(input)
      if (!hasUpdate) return { run: toView(existing), created: false }
      const patch = toRunPatch(input)
      return { run: await applyRunUpdate(actor, existing, patch), created: false }
    }
  }

  const ownerUserId = input.ownerUserId ?? actor.userId
  if (ownerUserId !== actor.userId) {
    fail('AGENT_FORBIDDEN', '不能替其他用户创建运行')
  }
  await assertDefinitionDispatchable(input.definitionId)

  const runId = input.runId ?? randomUUID()
  const status = input.status ?? 'queued'
  const now = new Date()
  const inserted = await db
    .insert(agentRuns)
    .values({
      id: runId,
      definitionId: input.definitionId,
      definitionName: input.definitionName,
      definitionVersion: input.definitionVersion,
      ownerUserId,
      teamId: input.teamId ?? null,
      parentRunId: input.parentRunId ?? null,
      dispatchId: input.dispatchId ?? null,
      sessionId: input.sessionId ?? null,
      mode: input.mode,
      goal: input.goal,
      status,
      startedAt: input.startedAt ? new Date(input.startedAt) : status === 'running' ? now : null,
      lastHeartbeatAt: status === 'running' ? now : null,
      traceId: input.traceId,
      metadata: input.metadata ?? {},
    })
    .onConflictDoNothing()
    .returning()
  const row = inserted[0]
  if (!row) {
    const racedRows = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1)
    const raced = racedRows[0]
    if (!raced) fail('AGENT_INTERNAL_ERROR', '创建运行失败')
    await assertOwner(actor, raced)
    return { run: toView(raced), created: false }
  }
  return { run: toView(row), created: true }
}

function hasRunUpdate(input: CreateRunInput): boolean {
  return input.status !== undefined || input.metadata !== undefined || input.startedAt !== undefined
}

function toRunPatch(input: CreateRunInput): UpdateRunInput {
  return {
    status: input.status,
    metadata: input.metadata,
    startedAt: input.startedAt,
  }
}

/** 更新 run。终态不可回到非终态，相同终态幂等。 */
export async function updateRun(
  actor: RunLedgerActor,
  runId: string,
  patch: UpdateRunInput,
): Promise<RunLedgerView> {
  const existing = await findRunOrThrow(runId)
  await assertOwner(actor, existing)
  return applyRunUpdate(actor, existing, patch)
}

async function applyRunUpdate(
  _actor: RunLedgerActor,
  existing: typeof agentRuns.$inferSelect,
  patch: UpdateRunInput,
): Promise<RunLedgerView> {
  if (patch.status !== undefined) {
    if (TERMINAL_STATUSES.includes(existing.status) && patch.status !== existing.status) {
      fail('AGENT_RUN_NOT_ACTIVE', '终态运行不能改状态')
    }
  }
  const now = new Date()
  const set: Partial<typeof agentRuns.$inferInsert> = {
    updatedAt: now,
  }
  if (patch.status !== undefined) {
    set.status = patch.status
    if (patch.status === 'running') {
      set.startedAt = existing.startedAt ?? now
      set.lastHeartbeatAt = now
      set.endedAt = null
    }
    if (TERMINAL_STATUSES.includes(patch.status)) {
      set.endedAt = existing.endedAt ?? now
    }
  }
  if (patch.inputTokens !== undefined) set.inputTokens = patch.inputTokens
  if (patch.outputTokens !== undefined) set.outputTokens = patch.outputTokens
  if (patch.costPoints !== undefined) set.costPoints = patch.costPoints
  if (patch.errorCode !== undefined) set.errorCode = patch.errorCode
  if (patch.errorMessage !== undefined) set.errorMessage = patch.errorMessage
  if (patch.artifactCount !== undefined) set.artifactCount = patch.artifactCount
  if (patch.startedAt !== undefined)
    set.startedAt = patch.startedAt ? new Date(patch.startedAt) : null
  if (patch.endedAt !== undefined) set.endedAt = patch.endedAt ? new Date(patch.endedAt) : null
  if (patch.metadata !== undefined) {
    set.metadata = { ...existing.metadata, ...patch.metadata }
  }

  const updated = await db
    .update(agentRuns)
    .set(set)
    .where(eq(agentRuns.id, existing.id))
    .returning()
  const row = updated[0]
  if (!row) fail('AGENT_INTERNAL_ERROR', '更新运行失败')
  return toView(row)
}

function capPayload(payload: Record<string, unknown>): {
  payload: Record<string, unknown>
  truncated: boolean
} {
  const json = JSON.stringify(payload)
  if (Buffer.byteLength(json, 'utf8') <= MAX_EVENT_PAYLOAD_BYTES) {
    return { payload, truncated: false }
  }
  return {
    payload: {
      truncated: true,
      originalBytes: Buffer.byteLength(json, 'utf8'),
      preview: json.slice(0, PAYLOAD_PREVIEW_BYTES),
    },
    truncated: true,
  }
}

/**
 * 追加事件。重复 `(runId,seq)` 返回已有事件且 `duplicate=true`，不重复改状态/计数。
 * `type=status` 的 payload 必须带 `status`，它是唯一改 run 状态的通道。
 */
export async function appendRunEvent(
  actor: RunLedgerActor,
  runId: string,
  input: { seq: number; type: AgentRunEventType; payload?: Record<string, unknown> },
): Promise<{
  event: RunEventView
  run: RunLedgerView
  duplicate: boolean
  payloadTruncated: boolean
}> {
  const existingRun = await findRunOrThrow(runId)
  await assertOwner(actor, existingRun)
  const { payload, truncated } = capPayload(input.payload ?? {})

  const outcome = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(agentRunEvents)
      .values({
        runId,
        seq: input.seq,
        type: input.type,
        payload,
      })
      .onConflictDoNothing()
      .returning()
    const event = inserted[0]
    if (!event) {
      const dupRows = await tx
        .select()
        .from(agentRunEvents)
        .where(and(eq(agentRunEvents.runId, runId), eq(agentRunEvents.seq, input.seq)))
        .limit(1)
      const dup = dupRows[0]
      if (!dup) fail('AGENT_INTERNAL_ERROR', '事件重复但找不到原行')
      return { event: dup, run: existingRun, duplicate: true }
    }

    const now = new Date()
    const set: Partial<typeof agentRuns.$inferInsert> = {
      lastHeartbeatAt: now,
      updatedAt: now,
    }
    if (input.type === 'artifact') {
      set.artifactCount = sql`${agentRuns.artifactCount} + 1` as unknown as number
    }
    if (input.type === 'status') {
      const raw = payload.status
      const next = isRunStatus(raw) ? raw : undefined
      if (!next) fail('AGENT_INTERNAL_ERROR', 'status 事件缺少合法 payload.status')
      if (TERMINAL_STATUSES.includes(existingRun.status) && next !== existingRun.status) {
        fail('AGENT_RUN_NOT_ACTIVE', '终态运行不能改状态')
      }
      set.status = next
      if (next === 'running') {
        set.startedAt = existingRun.startedAt ?? now
        set.endedAt = null
      }
      if (TERMINAL_STATUSES.includes(next)) {
        set.endedAt = existingRun.endedAt ?? now
        // canceled / timeout 也需要保留原因（如用户取消、优雅停止、超时爆炸），
        // 否则 run 行只剩状态，控制台和排障都读不到 errorCode。
        if (next === 'failed' || next === 'canceled' || next === 'timeout') {
          if (typeof payload.errorCode === 'string') set.errorCode = payload.errorCode.slice(0, 64)
          if (typeof payload.errorMessage === 'string') {
            set.errorMessage = payload.errorMessage.slice(0, 2000)
          }
        }
      }
    }
    const updated = await tx.update(agentRuns).set(set).where(eq(agentRuns.id, runId)).returning()
    const row = updated[0]
    if (!row) fail('AGENT_RUN_NOT_FOUND', '运行不存在')
    return { event, run: row, duplicate: false }
  })

  return {
    event: toEventView(outcome.event),
    run: toView(outcome.run),
    duplicate: outcome.duplicate,
    payloadTruncated: truncated,
  }
}

/** 内部审计：只允许 agent.* 管理动作，避免 ai-service 借内部票写任意审计。 */
export async function recordInternalAgentAudit(
  actor: RunLedgerActor,
  input: {
    action: string
    resourceType: string
    resourceId?: string | null
    result?: 'success' | 'failure'
    metadata?: Record<string, unknown>
    ip?: string | null
    userAgent?: string | null
  },
): Promise<string> {
  if (!input.action.startsWith('agent.')) {
    fail('AGENT_FORBIDDEN', '内部审计只接受 agent.* 动作')
  }
  const id = await recordAuditLog({
    userId: actor.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? undefined,
    ip: input.ip ?? undefined,
    userAgent: input.userAgent ?? undefined,
    result: input.result ?? 'success',
    metadata: {
      ...input.metadata,
      requestId: actor.requestId ?? null,
      traceId: actor.traceId ?? null,
    },
  })
  if (!id) fail('AUDIT_UNAVAILABLE', '审计链写入失败')
  logger.info('[agent-registry] internal audit written', {
    auditId: id,
    action: input.action,
    resourceId: input.resourceId ?? null,
  })
  return id
}
