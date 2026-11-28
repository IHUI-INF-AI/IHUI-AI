// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管智能体 · 运行账本只读面（R1 / §4.2 runs 端点）。
 *
 * 写入口在 R2：ai-service 经内部票写 `agent_runs` / `agent_run_events`。
 * 这里只读，目的是让控制台能看"跑没跑、到哪步、花了多少、产物是什么"。
 * 读权限按 owner / 定义可见性 / 管理员三档，不信任前端传 owner。
 */

import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { agentDefinitions, agentRunEvents, agentRuns } from '@ihui/database'
import { httpStatusForErrorCode, type AgentErrorCode, type RunStatus } from '@ihui/shared'
import { AppError } from '../errors/AppError.js'
import { db } from '../db/index.js'
import { canReadDefinition, type AgentRegistryActor } from './agent-registry-service.js'

export interface AgentRunView {
  id: string
  definitionId: string | null
  definitionName: string
  definitionVersion: number
  ownerUserId: string
  teamId: string | null
  parentRunId: string | null
  dispatchId: string | null
  sessionId: string | null
  mode: string
  goal: string
  status: string
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

export interface AgentRunEventView {
  seq: number
  type: string
  payload: Record<string, unknown>
  createdAt: string
}

function fail(code: AgentErrorCode, message: string): never {
  throw new AppError(message, httpStatusForErrorCode(code), code)
}

function isAdmin(actor: AgentRegistryActor): boolean {
  return actor.roleId >= 1
}

function toRunView(row: typeof agentRuns.$inferSelect): AgentRunView {
  return {
    id: row.id,
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
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    lastHeartbeatAt: row.lastHeartbeatAt?.toISOString() ?? null,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    costPoints: String(row.costPoints),
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    artifactCount: row.artifactCount,
    traceId: row.traceId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function assertRunVisible(
  actor: AgentRegistryActor,
  run: typeof agentRuns.$inferSelect,
): Promise<void> {
  if (isAdmin(actor)) return
  if (run.ownerUserId === actor.userId) return
  if (run.definitionId !== null) {
    const rows = await db
      .select()
      .from(agentDefinitions)
      .where(eq(agentDefinitions.id, run.definitionId))
      .limit(1)
    const definition = rows[0]
    if (definition && (await canReadDefinition(actor, definition))) return
  }
  fail('AGENT_NOT_FOUND', '运行不存在或不可见')
}

async function loadRunOrThrow(runId: string): Promise<typeof agentRuns.$inferSelect> {
  const rows = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1)
  const row = rows[0]
  if (!row) fail('AGENT_RUN_NOT_FOUND', '运行不存在')
  return row
}

/** 某个定义下的运行列表。定义不可见时按 404，不返回空列表。 */
export async function listDefinitionRuns(
  actor: AgentRegistryActor,
  definitionId: string,
  query: { status?: RunStatus; limit?: number; offset?: number } = {},
): Promise<{ items: AgentRunView[]; total: number }> {
  const defRows = await db
    .select()
    .from(agentDefinitions)
    .where(eq(agentDefinitions.id, definitionId))
    .limit(1)
  const definition = defRows[0]
  if (!definition || !(await canReadDefinition(actor, definition))) {
    fail('AGENT_NOT_FOUND', '定义不存在或不可见')
  }

  const filters = [eq(agentRuns.definitionId, definitionId)]
  if (query.status !== undefined) filters.push(eq(agentRuns.status, query.status))
  const where = and(...filters)
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(agentRuns)
      .where(where)
      .orderBy(desc(agentRuns.createdAt))
      .limit(Math.min(Math.max(query.limit ?? 20, 1), 100))
      .offset(Math.max(query.offset ?? 0, 0)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentRuns)
      .where(where),
  ])
  return { items: rows.map(toRunView), total: countRows[0]?.count ?? 0 }
}

/**
 * 我的运行列表(2026-11-28):
 * 总管右侧只展示"这次对话里由总管派出去"的智能体,不是注册表的模板。
 * 以 sessionId 收口;owner 永远是当前用户,不信任前端传 owner。
 */
export async function listOwnerRuns(
  actor: AgentRegistryActor,
  query: {
    sessionId?: string
    status?: RunStatus
    limit?: number
    offset?: number
  } = {},
): Promise<{ items: AgentRunView[]; total: number }> {
  const filters = [eq(agentRuns.ownerUserId, actor.userId)]
  if (query.sessionId) {
    // 总管派发时把 chat session 写进 metadata.masterSessionId;老 run 的 session_id
    // 是运行自己的会话载体,不能再当"哪次总管对话"用,所以这里只认 metadata。
    filters.push(
      sql`${agentRuns.metadata}->>'masterSessionId' = ${query.sessionId}`,
    )
  }
  if (query.status !== undefined) filters.push(eq(agentRuns.status, query.status))
  const where = and(...filters)
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(agentRuns)
      .where(where)
      .orderBy(desc(agentRuns.createdAt))
      .limit(Math.min(Math.max(query.limit ?? 50, 1), 100))
      .offset(Math.max(query.offset ?? 0, 0)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentRuns)
      .where(where),
  ])
  return { items: rows.map(toRunView), total: countRows[0]?.count ?? 0 }
}

export async function getAgentRun(actor: AgentRegistryActor, runId: string): Promise<AgentRunView> {
  const run = await loadRunOrThrow(runId)
  await assertRunVisible(actor, run)
  return toRunView(run)
}

/** 事件按 seq 升序；afterSeq 用于断线续读，limit 默认 50 最大 200。 */
export async function listAgentRunEvents(
  actor: AgentRegistryActor,
  runId: string,
  query: { afterSeq?: number; limit?: number } = {},
): Promise<{ items: AgentRunEventView[]; nextSeq: number | null; truncated: boolean }> {
  const run = await loadRunOrThrow(runId)
  await assertRunVisible(actor, run)
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200)
  const filters = [eq(agentRunEvents.runId, runId)]
  if (query.afterSeq !== undefined) filters.push(gt(agentRunEvents.seq, query.afterSeq))
  const rows = await db
    .select()
    .from(agentRunEvents)
    .where(and(...filters))
    .orderBy(asc(agentRunEvents.seq))
    .limit(limit + 1)
  const page = rows.slice(0, limit)
  const truncated = page.some((row) => row.payload?.truncated === true)
  return {
    items: page.map((row) => ({
      seq: row.seq,
      type: row.type,
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
    })),
    nextSeq: rows.length > limit ? (page[page.length - 1]?.seq ?? null) : null,
    truncated,
  }
}

/** 产物只返回引用，不返回正文。 */
export async function listRunArtifacts(
  actor: AgentRegistryActor,
  runId: string,
): Promise<{ items: Array<Record<string, unknown>>; count: number }> {
  const run = await loadRunOrThrow(runId)
  await assertRunVisible(actor, run)
  const rows = await db
    .select({ payload: agentRunEvents.payload })
    .from(agentRunEvents)
    .where(and(eq(agentRunEvents.runId, runId), inArray(agentRunEvents.type, ['artifact'])))
    .orderBy(asc(agentRunEvents.seq))
    .limit(500)
  const items = rows.map((row) => row.payload)
  return { items, count: items.length }
}

/** 统计：tokens/points/耗时/步数/重试/预算 hold。以账本为准，不由前端累加。 */
export async function getAgentRunStats(
  actor: AgentRegistryActor,
  runId: string,
): Promise<Record<string, unknown>> {
  const run = await loadRunOrThrow(runId)
  await assertRunVisible(actor, run)
  const [stepRows, errorRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentRunEvents)
      .where(and(eq(agentRunEvents.runId, runId), inArray(agentRunEvents.type, ['step', 'tool']))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentRunEvents)
      .where(and(eq(agentRunEvents.runId, runId), eq(agentRunEvents.type, 'error'))),
  ])
  const durationMs =
    run.startedAt && run.endedAt ? run.endedAt.getTime() - run.startedAt.getTime() : null
  return {
    runId: run.id,
    status: run.status,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    tokens: run.inputTokens + run.outputTokens,
    costPoints: String(run.costPoints),
    durationMs,
    stepCount: stepRows[0]?.count ?? 0,
    errorCount: errorRows[0]?.count ?? 0,
    artifactCount: run.artifactCount,
    budgetHold: run.metadata.budgetHold ?? null,
  }
}
