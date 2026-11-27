// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管智能体 · 统一注册表服务（R1 / P1-07 / P1-08 / P1-11）。
 *
 * 本文件只做"定义"域：创建、读取、更新、克隆、启停、软删/恢复/彻底删。
 * 运行账本、预检、审批在各自的 service 里，避免一个文件承担三套状态机。
 *
 * 两条硬边界：
 * 1. 读可见性：非管理员只能看到 system + 自己的 personal + 自己所在团队的 team。
 * 2. 写权限：system 只允许管理员；personal 只允许 owner；team 只允许 owner/admin。
 *
 * 这里的权限判断只是 API 层的第一道闸；ai-service 的 AgentResolver 还会按
 * 同一份 scope/owner/team 再裁一次，防止内部票据被拿去跨用户读定义。
 */

import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm'
import {
  agentDefinitionVersions,
  agentDefinitions,
  agentManagementApprovals,
  agentRuns,
  teamMembers,
  type AgentDefinition,
} from '@ihui/database'
import {
  buildCloneAgentName,
  httpStatusForErrorCode,
  isAgentRole,
  isScope,
  normalizeAgentName,
  type AgentErrorCode,
  type AgentRegistryRole,
  type DefinitionStatus,
  type Scope,
} from '@ihui/shared'
import { AppError } from '../errors/AppError.js'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { recordAuditLog } from './audit-log-service.js'

/** 一次请求的调用主体。userId 必须来自令牌，不得来自 body。 */
export interface AgentRegistryActor {
  userId: string
  roleId: number
  requestId?: string
  traceId?: string
  ip?: string
  userAgent?: string
}

export interface AgentDefinitionStats {
  runs7d: number
  successRate: number
  costPoints7d: string
}

/** 定义的对外视图。systemPrompt 只在详情里返回，列表不返回。 */
export interface AgentDefinitionView {
  id: string
  ownerUserId: string | null
  teamId: string | null
  scope: Scope
  name: string
  displayName: string
  description: string
  role: AgentRegistryRole
  promptVersion: number
  model: string | null
  temperature: string
  maxTokens: number | null
  tools: string[]
  skills: string[]
  permissions: Record<string, unknown>
  memoryPolicy: Record<string, unknown>
  budget: Record<string, unknown>
  concurrencyLimit: number
  status: DefinitionStatus
  isBuiltin: boolean
  isDispatchable: boolean
  marketAgentId: string | null
  metadata: Record<string, unknown>
  version: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  purgeAfter: string | null
  systemPrompt?: string
  promptHash?: string
  promptLength?: number
  auditId?: string
  stats?: AgentDefinitionStats
}

export interface AgentDefinitionListQuery {
  scope?: Scope
  status?: DefinitionStatus
  role?: AgentRegistryRole
  teamId?: string
  search?: string
  limit?: number
  offset?: number
  cursor?: string
}

export interface AgentDefinitionListResult {
  list: AgentDefinitionView[]
  total: number
  limit: number
  offset: number
  nextCursor: string | null
}

export interface RollbackApprovalResult {
  requiresApproval: true
  approvalId: string
  status: 'pending'
  expiresAt: string
  activeRuns: number
  impactHash: string
  auditId?: string
}

export interface CreateAgentDefinitionInput {
  scope: Scope
  name: string
  displayName: string
  description?: string
  role?: AgentRegistryRole
  systemPrompt?: string
  model?: string | null
  temperature?: number
  maxTokens?: number | null
  tools?: string[]
  skills?: string[]
  permissions?: Record<string, unknown>
  memoryPolicy?: Record<string, unknown>
  budget?: Record<string, unknown>
  concurrencyLimit?: number
  isDispatchable?: boolean
  marketAgentId?: string | null
  metadata?: Record<string, unknown>
  teamId?: string | null
  reason?: string
}

export interface UpdateAgentDefinitionInput {
  ifVersion: number
  name?: string
  displayName?: string
  description?: string
  role?: AgentRegistryRole
  systemPrompt?: string
  model?: string | null
  temperature?: number
  maxTokens?: number | null
  tools?: string[]
  skills?: string[]
  permissions?: Record<string, unknown>
  memoryPolicy?: Record<string, unknown>
  budget?: Record<string, unknown>
  concurrencyLimit?: number
  isDispatchable?: boolean
  marketAgentId?: string | null
  metadata?: Record<string, unknown>
  changeSummary?: string
  reason?: string
}

export interface CloneAgentDefinitionInput {
  name?: string
  displayName?: string
  scope?: Scope
  teamId?: string | null
  reason?: string
}

const MAX_SYSTEM_PROMPT_LENGTH = 32_768
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function fail(code: AgentErrorCode, message: string): never {
  throw new AppError(message, httpStatusForErrorCode(code), code)
}

export function isRegistryAdmin(actor: AgentRegistryActor): boolean {
  return actor.roleId === 1
}

function isAdmin(actor: AgentRegistryActor): boolean {
  return isRegistryAdmin(actor)
}

function assertScopedNameValid(name: string, allowReserved: boolean): string {
  const normalized = normalizeAgentName(name)
  if (normalized.issues.includes('empty')) fail('AGENT_NAME_RESERVED', '名称不能为空')
  if (normalized.issues.includes('reserved') && !allowReserved) {
    fail('AGENT_NAME_RESERVED', `名称 ${normalized.name} 是保留名`)
  }
  if (normalized.issues.includes('invalid-characters')) {
    fail('AGENT_NAME_RESERVED', `名称 ${normalized.name} 含非法字符`)
  }
  return normalized.name
}

function assertPromptLength(systemPrompt: string | undefined): void {
  if (systemPrompt !== undefined && systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
    fail('AGENT_PROMPT_TOO_LONG', `提示词超长，最大 ${MAX_SYSTEM_PROMPT_LENGTH} 字符`)
  }
}

function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

export function toDefinitionView(row: AgentDefinition, withPrompt = false): AgentDefinitionView {
  const view: AgentDefinitionView = {
    id: row.id,
    ownerUserId: row.ownerUserId,
    teamId: row.teamId,
    scope: row.scope,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    role: row.role as AgentRegistryRole,
    promptVersion: row.promptVersion,
    model: row.model,
    temperature: String(row.temperature),
    maxTokens: row.maxTokens,
    tools: row.tools,
    skills: row.skills,
    permissions: row.permissions as Record<string, unknown>,
    memoryPolicy: row.memoryPolicy as Record<string, unknown>,
    budget: row.budget as Record<string, unknown>,
    concurrencyLimit: row.concurrencyLimit,
    status: row.status,
    isBuiltin: row.isBuiltin,
    isDispatchable: row.isDispatchable,
    marketAgentId: row.marketAgentId,
    metadata: row.metadata as Record<string, unknown>,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: toIso(row.deletedAt),
    purgeAfter: toIso(row.purgeAfter),
  }
  if (withPrompt) view.systemPrompt = row.systemPrompt
  return view
}

/** 版本快照的键集合必须完整；回滚缺一列就会把定义回滚成半截。 */
export function snapshotDefinition(row: AgentDefinition): Record<string, unknown> {
  return {
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    role: row.role,
    systemPrompt: row.systemPrompt,
    promptVersion: row.promptVersion,
    model: row.model,
    temperature: String(row.temperature),
    maxTokens: row.maxTokens,
    tools: row.tools,
    skills: row.skills,
    permissions: row.permissions,
    memoryPolicy: row.memoryPolicy,
    budget: row.budget,
    concurrencyLimit: row.concurrencyLimit,
    status: row.status,
    isDispatchable: row.isDispatchable,
    marketAgentId: row.marketAgentId,
    metadata: row.metadata,
  }
}

export async function writeDefinitionVersion(
  tx: Pick<typeof db, 'insert'>,
  definition: AgentDefinition,
  changeKind: 'create' | 'update' | 'clone' | 'rollback' | 'delete' | 'restore' | 'purge',
  actorUserId: string,
  changeSummary: string,
): Promise<void> {
  await tx.insert(agentDefinitionVersions).values({
    definitionId: definition.id,
    version: definition.version,
    changeKind,
    snapshot: snapshotDefinition(definition),
    changeSummary: changeSummary.slice(0, 300),
    actorUserId,
  })
}

type RegistryTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function writeRegistryAudit(
  actor: AgentRegistryActor,
  action: string,
  definition: Pick<AgentDefinition, 'id' | 'name' | 'version'>,
  result: 'success' | 'failure',
  metadata: Record<string, unknown>,
  tx?: RegistryTx,
): Promise<string> {
  const id = await recordAuditLog(
    {
      userId: actor.userId,
      action,
      resourceType: 'agent_definition',
      resourceId: definition.id,
      ip: actor.ip,
      userAgent: actor.userAgent,
      result,
      metadata: {
        ...metadata,
        name: definition.name,
        version: definition.version,
        requestId: actor.requestId ?? null,
        traceId: actor.traceId ?? null,
      },
    },
    tx,
  )
  if (id === undefined) {
    if (result === 'success') fail('AUDIT_UNAVAILABLE', '审计链写入失败，动作已拒绝')
    return ''
  }
  return id
}

async function teamIdsForUser(actor: AgentRegistryActor): Promise<string[]> {
  if (isAdmin(actor)) return []
  const rows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, actor.userId), inArray(teamMembers.role, ['owner', 'admin'])))
  return rows.map((row) => row.teamId)
}

async function teamIdsForMember(actor: AgentRegistryActor): Promise<string[]> {
  const rows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, actor.userId))
  return rows.map((row) => row.teamId)
}

export async function canReadDefinition(
  actor: AgentRegistryActor,
  row: AgentDefinition,
): Promise<boolean> {
  if (isAdmin(actor)) return true
  if (row.scope === 'system') return true
  if (row.scope === 'personal') return row.ownerUserId === actor.userId
  if (row.scope === 'team' && row.teamId !== null) {
    const rows = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, row.teamId), eq(teamMembers.userId, actor.userId)))
      .limit(1)
    return rows.length > 0
  }
  return false
}

async function assertCanManage(actor: AgentRegistryActor, row: AgentDefinition): Promise<void> {
  if (await canManageDefinition(actor, row)) return
  fail('AGENT_FORBIDDEN', '无权管理该智能体定义')
}

export async function canManageDefinition(
  actor: AgentRegistryActor,
  row: AgentDefinition,
): Promise<boolean> {
  if (isAdmin(actor)) return true
  if (row.scope === 'personal' && row.ownerUserId === actor.userId) return true
  if (row.scope === 'team' && row.teamId !== null) {
    const rows = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, row.teamId), eq(teamMembers.userId, actor.userId)))
      .limit(1)
    if (rows[0]?.role === 'owner' || rows[0]?.role === 'admin') return true
  }
  return false
}

function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex')
}

export async function findDefinitionOrThrow(id: string): Promise<AgentDefinition> {
  const rows = await db.select().from(agentDefinitions).where(eq(agentDefinitions.id, id)).limit(1)
  const row = rows[0]
  if (!row) fail('AGENT_NOT_FOUND', '智能体定义不存在')
  return row
}

interface DefinitionCursor {
  updatedAt: Date
  id: string
}

function decodeDefinitionCursor(raw: string): DefinitionCursor {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    const separator = decoded.lastIndexOf('|')
    if (separator <= 0) throw new Error('separator missing')
    const id = decoded.slice(separator + 1)
    const updatedAt = new Date(decoded.slice(0, separator))
    if (!id || Number.isNaN(updatedAt.getTime())) throw new Error('cursor malformed')
    return { updatedAt, id }
  } catch {
    throw new AppError('分页游标非法', 400, 'INVALID_CURSOR')
  }
}

function encodeDefinitionCursor(updatedAt: Date, id: string): string {
  return Buffer.from(`${updatedAt.toISOString()}|${id}`, 'utf8').toString('base64url')
}

/** 列表。非管理员只返回可见集合；team 过滤同时校验成员关系。 */
export async function listAgentDefinitions(
  actor: AgentRegistryActor,
  query: AgentDefinitionListQuery = {},
): Promise<AgentDefinitionListResult> {
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const offset = Math.max(query.offset ?? 0, 0)

  const filters = []
  if (query.scope !== undefined) filters.push(eq(agentDefinitions.scope, query.scope))
  if (query.status !== undefined) filters.push(eq(agentDefinitions.status, query.status))
  if (query.role !== undefined) filters.push(eq(agentDefinitions.role, query.role))
  if (query.teamId !== undefined) filters.push(eq(agentDefinitions.teamId, query.teamId))
  if (query.search !== undefined && query.search.trim() !== '') {
    const term = `%${query.search.trim()}%`
    filters.push(
      or(
        sql`${agentDefinitions.name} ILIKE ${term}`,
        sql`${agentDefinitions.displayName} ILIKE ${term}`,
      ),
    )
  }

  if (!isAdmin(actor)) {
    const teams = await teamIdsForMember(actor)
    const visible = [
      eq(agentDefinitions.scope, 'system'),
      and(eq(agentDefinitions.scope, 'personal'), eq(agentDefinitions.ownerUserId, actor.userId)),
    ]
    if (teams.length > 0) {
      visible.push(and(eq(agentDefinitions.scope, 'team'), inArray(agentDefinitions.teamId, teams)))
    }
    filters.push(or(...visible))
  }

  const whereBase = filters.length > 0 ? and(...filters) : undefined
  const cursor = query.cursor ? decodeDefinitionCursor(query.cursor) : null
  if (cursor) {
    filters.push(
      or(
        lt(agentDefinitions.updatedAt, cursor.updatedAt),
        and(eq(agentDefinitions.updatedAt, cursor.updatedAt), lt(agentDefinitions.id, cursor.id)),
      ),
    )
  }
  const wherePage = filters.length > 0 ? and(...filters) : undefined
  const effectiveOffset = cursor ? 0 : offset

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(agentDefinitions)
      .where(wherePage)
      .orderBy(desc(agentDefinitions.updatedAt), desc(agentDefinitions.id))
      .limit(limit + 1)
      .offset(effectiveOffset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentDefinitions)
      .where(whereBase),
  ])

  const pageRows = rows.slice(0, limit)
  const hasMore = rows.length > limit
  const nextCursor =
    hasMore && pageRows.length > 0
      ? encodeDefinitionCursor(
          pageRows[pageRows.length - 1]!.updatedAt,
          pageRows[pageRows.length - 1]!.id,
        )
      : null

  const statsByDefinition = new Map<string, AgentDefinitionStats>()
  if (pageRows.length > 0) {
    const statRows = await db
      .select({
        definitionId: agentRuns.definitionId,
        runs7d: sql<number>`count(*)::int`,
        successRate: sql<string>`coalesce(avg(case when ${agentRuns.status} = 'succeeded' then 1.0 else 0.0 end), 0)::text`,
        costPoints7d: sql<string>`coalesce(sum(${agentRuns.costPoints}), 0)::text`,
      })
      .from(agentRuns)
      .where(
        and(
          inArray(
            agentRuns.definitionId,
            pageRows.map((row) => row.id),
          ),
          gte(agentRuns.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        ),
      )
      .groupBy(agentRuns.definitionId)
    for (const stat of statRows) {
      if (!stat.definitionId) continue
      statsByDefinition.set(stat.definitionId, {
        runs7d: stat.runs7d,
        successRate: Math.round(Number(stat.successRate) * 10_000) / 10_000,
        costPoints7d: stat.costPoints7d,
      })
    }
  }

  return {
    list: pageRows.map((row) => ({
      ...toDefinitionView(row),
      ...(statsByDefinition.has(row.id) ? { stats: statsByDefinition.get(row.id) } : {}),
    })),
    total: countRows[0]?.count ?? 0,
    limit,
    offset: effectiveOffset,
    nextCursor,
  }
}

/** 内部快照：绕过可见性，返回全部定义（含墓碑）与完整提示词，仅供内部票据调用。 */
export async function snapshotAgentDefinitionsForInternal(input: {
  updatedAfter?: Date
  includeDeleted?: boolean
  limit?: number
}): Promise<AgentDefinitionView[]> {
  const filters = []
  if (input.updatedAfter) filters.push(gte(agentDefinitions.updatedAt, input.updatedAfter))
  if (!input.includeDeleted) filters.push(sql`${agentDefinitions.status} <> 'deleted'`)
  const rows = await db
    .select()
    .from(agentDefinitions)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(agentDefinitions.updatedAt), desc(agentDefinitions.id))
    .limit(Math.min(Math.max(input.limit ?? 500, 1), 1000))
  return rows.map((row) => toDefinitionView(row, true))
}

/**
 * 内部解析：按 id 或 name 找定义，再做一次与 API 相同的可见性裁切。
 * systemPrompt 对内部票据完整返回，因为运行时必须拿到提示词才能执行。
 */
export async function resolveAgentDefinitionForInternal(
  actor: AgentRegistryActor,
  input: {
    id?: string
    name?: string
    scope?: Scope
    teamId?: string
    ownerUserId?: string
  },
): Promise<AgentDefinitionView> {
  if (input.id) {
    const row = await findDefinitionOrThrow(input.id)
    if (row.status === 'deleted') fail('AGENT_DELETED', '定义已删除')
    if (!(await canReadDefinition(actor, row))) fail('AGENT_FORBIDDEN', '无权解析该定义')
    return toDefinitionView(row, true)
  }
  if (!input.name) fail('AGENT_NOT_FOUND', '缺少 id 或 name')
  const filters = [
    eq(agentDefinitions.name, input.name),
    sql`${agentDefinitions.status} <> 'deleted'`,
  ]
  if (input.scope !== undefined) filters.push(eq(agentDefinitions.scope, input.scope))
  if (input.teamId !== undefined) filters.push(eq(agentDefinitions.teamId, input.teamId))
  if (input.ownerUserId !== undefined) {
    filters.push(eq(agentDefinitions.ownerUserId, input.ownerUserId))
  }
  const rows = await db
    .select()
    .from(agentDefinitions)
    .where(and(...filters))
    .limit(20)
  const candidates: AgentDefinition[] = []
  for (const row of rows) {
    if (await canReadDefinition(actor, row)) candidates.push(row)
  }
  if (candidates.length === 0) fail('AGENT_NOT_FOUND', `没有可见的定义 ${input.name}`)
  const priority: Record<Scope, number> = { personal: 0, team: 1, system: 2 }
  candidates.sort((left, right) => priority[left.scope] - priority[right.scope])
  return toDefinitionView(candidates[0]!, true)
}

/** 详情。systemPrompt 只对 owner/team_admin/admin 返回；其余可见者拿到 hash 与长度。 */
export async function getAgentDefinition(
  actor: AgentRegistryActor,
  id: string,
): Promise<AgentDefinitionView> {
  const row = await findDefinitionOrThrow(id)
  if (!(await canReadDefinition(actor, row))) fail('AGENT_FORBIDDEN', '无权查看该智能体定义')
  const view = toDefinitionView(row, false)
  if (await canManageDefinition(actor, row)) {
    view.systemPrompt = row.systemPrompt
  } else {
    view.promptHash = hashPrompt(row.systemPrompt)
    view.promptLength = row.systemPrompt.length
  }
  return view
}

/** 创建。system 只允许管理员；personal 自动归 owner；team 校验团队管理权。 */
export async function createAgentDefinition(
  actor: AgentRegistryActor,
  input: CreateAgentDefinitionInput,
): Promise<AgentDefinitionView> {
  if (!isScope(input.scope)) fail('AGENT_SCOPE_INVALID', '作用域非法')
  if (input.scope === 'system' && !isAdmin(actor)) {
    fail('AGENT_FORBIDDEN', '只有管理员可以创建 system 定义')
  }
  if (input.scope === 'team') {
    if (!input.teamId) fail('AGENT_SCOPE_INVALID', 'team 定义必须指定 teamId')
    const teams = await teamIdsForUser(actor)
    if (!isAdmin(actor) && !teams.includes(input.teamId)) {
      fail('AGENT_FORBIDDEN', '只有团队 owner/admin 可以创建团队定义')
    }
  }
  if (input.role !== undefined && !isAgentRole(input.role)) {
    fail('AGENT_SCOPE_INVALID', '角色非法')
  }
  assertPromptLength(input.systemPrompt)

  const name = assertScopedNameValid(input.name, isAdmin(actor) && input.scope === 'system')
  const ownerUserId = input.scope === 'system' ? null : actor.userId
  const teamId = input.scope === 'team' ? (input.teamId ?? null) : null

  try {
    const inserted = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(agentDefinitions)
        .values({
          ownerUserId,
          teamId,
          scope: input.scope,
          name,
          displayName: input.displayName.trim(),
          description: input.description ?? '',
          role: input.role ?? 'custom',
          systemPrompt: input.systemPrompt ?? '',
          model: input.model ?? null,
          temperature: String(input.temperature ?? 0.7),
          maxTokens: input.maxTokens ?? null,
          tools: input.tools ?? [],
          skills: input.skills ?? [],
          permissions: input.permissions ?? {},
          memoryPolicy: input.memoryPolicy ?? {},
          budget: input.budget ?? {},
          concurrencyLimit: input.concurrencyLimit ?? 2,
          isBuiltin: false,
          isDispatchable: input.isDispatchable ?? true,
          marketAgentId: input.marketAgentId ?? null,
          metadata: input.metadata ?? {},
          createdBy: actor.userId,
          updatedBy: actor.userId,
        })
        .returning()
      const row = rows[0]
      if (!row) fail('AGENT_INTERNAL_ERROR', '创建定义后未返回行')
      await writeDefinitionVersion(tx, row, 'create', actor.userId, input.reason ?? '创建定义')
      return row
    })
    const auditId = await writeRegistryAudit(
      actor,
      'agent.definition.created',
      inserted,
      'success',
      {
        scope: inserted.scope,
        teamId: inserted.teamId,
      },
    )
    return { ...toDefinitionView(inserted, true), auditId }
  } catch (error) {
    if (error instanceof AppError) throw error
    const code = pgErrorCode(error)
    if (code === '23505') fail('AGENT_NAME_TAKEN', `名称 ${name} 已被占用`)
    if (code === '23514') fail('AGENT_SCOPE_INVALID', '作用域与 owner/team 组合不合法')
    logger.warn('[agent-registry] create failed', { error: (error as Error).message })
    fail('AGENT_INTERNAL_ERROR', '创建智能体定义失败')
  }
}

/** 更新。ifVersion 必填，CAS 失败返回 AGENT_VERSION_CONFLICT 并带当前版本。 */
export async function updateAgentDefinition(
  actor: AgentRegistryActor,
  id: string,
  input: UpdateAgentDefinitionInput,
): Promise<AgentDefinitionView> {
  const current = await findDefinitionOrThrow(id)
  await assertCanManage(actor, current)
  if (current.version !== input.ifVersion) {
    throw new AppError(
      `版本冲突，当前版本 ${current.version}`,
      httpStatusForErrorCode('AGENT_VERSION_CONFLICT'),
      'AGENT_VERSION_CONFLICT',
    )
  }
  if (current.isBuiltin) {
    fail('AGENT_PROTECTED', '内置定义只允许启停，不允许改字段')
  }
  assertPromptLength(input.systemPrompt)

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = assertScopedNameValid(input.name, false)
  if (input.displayName !== undefined) patch.displayName = input.displayName.trim()
  if (input.description !== undefined) patch.description = input.description
  if (input.role !== undefined) {
    if (!isAgentRole(input.role)) fail('AGENT_SCOPE_INVALID', '角色非法')
    patch.role = input.role
  }
  if (input.systemPrompt !== undefined) {
    patch.systemPrompt = input.systemPrompt
    patch.promptVersion = current.promptVersion + 1
  }
  if (input.model !== undefined) patch.model = input.model
  if (input.temperature !== undefined) patch.temperature = String(input.temperature)
  if (input.maxTokens !== undefined) patch.maxTokens = input.maxTokens
  if (input.tools !== undefined) patch.tools = input.tools
  if (input.skills !== undefined) patch.skills = input.skills
  if (input.permissions !== undefined) patch.permissions = input.permissions
  if (input.memoryPolicy !== undefined) patch.memoryPolicy = input.memoryPolicy
  if (input.budget !== undefined) patch.budget = input.budget
  if (input.concurrencyLimit !== undefined) patch.concurrencyLimit = input.concurrencyLimit
  if (input.isDispatchable !== undefined) patch.isDispatchable = input.isDispatchable
  if (input.marketAgentId !== undefined) patch.marketAgentId = input.marketAgentId
  if (input.metadata !== undefined) patch.metadata = input.metadata

  if (Object.keys(patch).length === 0) {
    fail('AGENT_INTERNAL_ERROR', '没有可更新的字段')
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(agentDefinitions)
        .set({
          ...patch,
          version: current.version + 1,
          updatedBy: actor.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(agentDefinitions.id, id), eq(agentDefinitions.version, input.ifVersion)))
        .returning()
      const row = rows[0]
      if (!row) {
        throw new AppError(
          `版本冲突，当前版本 ${current.version}`,
          httpStatusForErrorCode('AGENT_VERSION_CONFLICT'),
          'AGENT_VERSION_CONFLICT',
        )
      }
      await writeDefinitionVersion(
        tx,
        row,
        'update',
        actor.userId,
        input.changeSummary ?? '更新定义',
      )
      return row
    })
    const auditId = await writeRegistryAudit(
      actor,
      'agent.definition.updated',
      updated,
      'success',
      {
        ifVersion: input.ifVersion,
        changeSummary: input.changeSummary ?? null,
      },
    )
    return { ...toDefinitionView(updated, true), auditId }
  } catch (error) {
    if (error instanceof AppError) throw error
    const code = pgErrorCode(error)
    if (code === '23505') fail('AGENT_NAME_TAKEN', '名称已被占用')
    if (code === '23514') fail('AGENT_SCOPE_INVALID', '更新后的字段违反约束')
    logger.warn('[agent-registry] update failed', { error: (error as Error).message })
    fail('AGENT_INTERNAL_ERROR', '更新智能体定义失败')
  }
}

/** 克隆。名称按 -copy / -copy-N 规则避让；目标作用域默认与源相同。 */
export async function cloneAgentDefinition(
  actor: AgentRegistryActor,
  sourceId: string,
  input: CloneAgentDefinitionInput = {},
): Promise<AgentDefinitionView> {
  const source = await findDefinitionOrThrow(sourceId)
  if (!(await canReadDefinition(actor, source))) fail('AGENT_FORBIDDEN', '无权克隆该智能体定义')
  // system 定义的 prompt 对普通用户只给 hash；克隆会复制全文，所以只放给管理员。
  if (source.scope === 'system' && !isAdmin(actor)) {
    fail('AGENT_FORBIDDEN', '只有管理员可以克隆 system 定义')
  }
  const scope = input.scope ?? source.scope
  if (scope === 'system' && !isAdmin(actor))
    fail('AGENT_FORBIDDEN', '只有管理员可以克隆为 system 定义')
  if (scope === 'team') {
    const teamId = input.teamId ?? source.teamId
    if (!teamId) fail('AGENT_SCOPE_INVALID', 'team 定义必须指定 teamId')
    const teams = await teamIdsForUser(actor)
    if (!isAdmin(actor) && !teams.includes(teamId)) {
      fail('AGENT_FORBIDDEN', '只有团队 owner/admin 可以克隆团队定义')
    }
  }

  const name = input.name
    ? assertScopedNameValid(input.name, false)
    : buildCloneAgentName(source.name)

  const inserted = await createAgentDefinition(actor, {
    scope,
    teamId: scope === 'team' ? (input.teamId ?? source.teamId) : null,
    name,
    displayName: input.displayName ?? `${source.displayName} 副本`,
    description: source.description,
    role: source.role as AgentRegistryRole,
    systemPrompt: source.systemPrompt,
    model: source.model,
    temperature: Number(source.temperature),
    maxTokens: source.maxTokens,
    tools: source.tools,
    skills: source.skills,
    permissions: source.permissions as Record<string, unknown>,
    memoryPolicy: source.memoryPolicy as Record<string, unknown>,
    budget: source.budget as Record<string, unknown>,
    concurrencyLimit: source.concurrencyLimit,
    isDispatchable: source.isDispatchable,
    marketAgentId: source.marketAgentId,
    metadata: { ...(source.metadata as Record<string, unknown>), clonedFrom: source.id },
    reason: input.reason ?? `克隆自 ${source.name}`,
  })
  return inserted
}

/** 启停。内置可停用不可删；停用不改变版本之外的状态机。 */
export async function setAgentDefinitionEnabled(
  actor: AgentRegistryActor,
  id: string,
  enabled: boolean,
  ifVersion: number,
): Promise<AgentDefinitionView> {
  const current = await findDefinitionOrThrow(id)
  await assertCanManage(actor, current)
  if (current.status === 'deleted') fail('AGENT_DELETED', '定义已删除，不能启停')
  if (current.version !== ifVersion) {
    throw new AppError(
      `版本冲突，当前版本 ${current.version}`,
      httpStatusForErrorCode('AGENT_VERSION_CONFLICT'),
      'AGENT_VERSION_CONFLICT',
    )
  }
  const status: DefinitionStatus = enabled ? 'active' : 'disabled'
  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .update(agentDefinitions)
      .set({ status, version: current.version + 1, updatedBy: actor.userId, updatedAt: new Date() })
      .where(and(eq(agentDefinitions.id, id), eq(agentDefinitions.version, ifVersion)))
      .returning()
    const row = rows[0]
    if (!row) {
      throw new AppError(
        `版本冲突，当前版本 ${current.version}`,
        httpStatusForErrorCode('AGENT_VERSION_CONFLICT'),
        'AGENT_VERSION_CONFLICT',
      )
    }
    await writeDefinitionVersion(tx, row, 'update', actor.userId, enabled ? '启用定义' : '停用定义')
    return row
  })
  const auditId = await writeRegistryAudit(
    actor,
    enabled ? 'agent.definition.enabled' : 'agent.definition.disabled',
    updated,
    'success',
    {},
  )
  return { ...toDefinitionView(updated, true), auditId }
}

export interface AgentDefinitionVersionView {
  version: number
  changeKind: string
  changeSummary: string
  actorUserId: string | null
  createdAt: string
}

/** 版本列表。只返回元信息，不返回快照全文，避免一页拉走几十份提示词。 */
export async function listAgentDefinitionVersions(
  actor: AgentRegistryActor,
  id: string,
  limit = 50,
): Promise<AgentDefinitionVersionView[]> {
  const definition = await findDefinitionOrThrow(id)
  if (!(await canReadDefinition(actor, definition))) fail('AGENT_FORBIDDEN', '无权查看该定义版本')
  const capped = Math.min(Math.max(limit, 1), 100)
  const rows = await db
    .select({
      version: agentDefinitionVersions.version,
      changeKind: agentDefinitionVersions.changeKind,
      changeSummary: agentDefinitionVersions.changeSummary,
      actorUserId: agentDefinitionVersions.actorUserId,
      createdAt: agentDefinitionVersions.createdAt,
    })
    .from(agentDefinitionVersions)
    .where(eq(agentDefinitionVersions.definitionId, id))
    .orderBy(desc(agentDefinitionVersions.version))
    .limit(capped)
  return rows.map((row) => ({
    version: row.version,
    changeKind: row.changeKind,
    changeSummary: row.changeSummary,
    actorUserId: row.actorUserId,
    createdAt: row.createdAt.toISOString(),
  }))
}

/** 单版本快照。systemPrompt 同样按管理权裁剪。 */
export async function getAgentDefinitionVersion(
  actor: AgentRegistryActor,
  id: string,
  version: number,
): Promise<{ version: number; changeKind: string; snapshot: Record<string, unknown> }> {
  const definition = await findDefinitionOrThrow(id)
  if (!(await canReadDefinition(actor, definition))) fail('AGENT_FORBIDDEN', '无权查看该定义版本')
  const rows = await db
    .select()
    .from(agentDefinitionVersions)
    .where(
      and(
        eq(agentDefinitionVersions.definitionId, id),
        eq(agentDefinitionVersions.version, version),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) fail('AGENT_NOT_FOUND', '版本不存在')
  const snapshot = { ...row.snapshot }
  if (!(await canManageDefinition(actor, definition))) {
    const prompt = typeof snapshot.systemPrompt === 'string' ? snapshot.systemPrompt : ''
    delete snapshot.systemPrompt
    snapshot.promptHash = hashPrompt(prompt)
    snapshot.promptLength = prompt.length
  }
  return {
    version: row.version,
    changeKind: row.changeKind,
    snapshot,
  }
}

export interface RollbackUpdateFields {
  name: string
  displayName: string
  description: string
  role: string
  systemPrompt: string
  promptVersion: number
  model: string | null
  temperature: string
  maxTokens: number | null
  tools: string[]
  skills: string[]
  permissions: Record<string, unknown>
  memoryPolicy: Record<string, unknown>
  budget: Record<string, unknown>
  concurrencyLimit: number
  status: DefinitionStatus
  isDispatchable: boolean
  marketAgentId: string | null
  metadata: Record<string, unknown>
}

/** 从已校验的版本快照生成可写字段；回滚审批执行与直滚共用同一套键。 */
export function rollbackUpdateFromSnapshot(
  snapshot: Record<string, unknown>,
  version: number,
  updatedBy: string,
): RollbackUpdateFields & { version: number; updatedBy: string; updatedAt: Date } {
  const required = [
    'name',
    'displayName',
    'description',
    'role',
    'systemPrompt',
    'promptVersion',
    'model',
    'temperature',
    'maxTokens',
    'tools',
    'skills',
    'permissions',
    'memoryPolicy',
    'budget',
    'concurrencyLimit',
    'status',
    'isDispatchable',
    'marketAgentId',
    'metadata',
  ]
  const missing = required.filter((key) => !(key in snapshot))
  if (missing.length > 0) {
    fail('AGENT_INTERNAL_ERROR', `版本快照缺字段: ${missing.join(',')}`)
  }
  return {
    name: String(snapshot.name),
    displayName: String(snapshot.displayName),
    description: String(snapshot.description),
    role: String(snapshot.role),
    systemPrompt: String(snapshot.systemPrompt),
    promptVersion: Number(snapshot.promptVersion),
    model: snapshot.model === null ? null : String(snapshot.model),
    temperature: String(snapshot.temperature),
    maxTokens: snapshot.maxTokens === null ? null : Number(snapshot.maxTokens),
    tools: snapshot.tools as string[],
    skills: snapshot.skills as string[],
    permissions: snapshot.permissions as Record<string, unknown>,
    memoryPolicy: snapshot.memoryPolicy as Record<string, unknown>,
    budget: snapshot.budget as Record<string, unknown>,
    concurrencyLimit: Number(snapshot.concurrencyLimit),
    status: snapshot.status as DefinitionStatus,
    isDispatchable: Boolean(snapshot.isDispatchable),
    marketAgentId: snapshot.marketAgentId === null ? null : String(snapshot.marketAgentId),
    metadata: snapshot.metadata as Record<string, unknown>,
    version,
    updatedBy,
    updatedAt: new Date(),
  }
}

async function createRollbackApproval(
  actor: AgentRegistryActor,
  current: AgentDefinition,
  targetVersion: number,
  targetSnapshot: Record<string, unknown>,
  impactHash: string,
  activeRuns: number,
): Promise<string> {
  const placeholderToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  const inserted = await db
    .insert(agentManagementApprovals)
    .values({
      definitionId: current.id,
      definitionName: current.name,
      definitionVersion: current.version,
      action: 'rollback',
      actorUserId: actor.userId,
      status: 'pending',
      precheckTokenHash: createHash('sha256').update(placeholderToken).digest('hex'),
      impactHash: impactHash.replace(/^sha256:/, ''),
      impactSnapshot: {
        kind: 'rollback',
        targetVersion,
        targetSnapshot,
        activeRuns,
      },
      reason: `回滚到 v${targetVersion}`,
      requestId: actor.requestId ?? null,
      traceId: actor.traceId ?? null,
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
      expiresAt,
    })
    .returning({ id: agentManagementApprovals.id })
  const approval = inserted[0]
  if (!approval) fail('AGENT_INTERNAL_ERROR', '创建回滚审批后未返回行')
  await writeRegistryAudit(actor, 'agent.definition.rollback_requested', current, 'success', {
    approvalId: approval.id,
    targetVersion,
    activeRuns,
    impactHash,
  })
  return approval.id
}

/** 回滚。无活跃运行时直接生成 version+1；有活跃运行时创建一次性审批。 */
export async function rollbackAgentDefinition(
  actor: AgentRegistryActor,
  id: string,
  targetVersion: number,
  ifVersion: number,
): Promise<AgentDefinitionView | RollbackApprovalResult> {
  const current = await findDefinitionOrThrow(id)
  await assertCanManage(actor, current)
  if (current.version !== ifVersion) {
    throw new AppError(
      `版本冲突，当前版本 ${current.version}`,
      httpStatusForErrorCode('AGENT_VERSION_CONFLICT'),
      'AGENT_VERSION_CONFLICT',
    )
  }
  if (current.status === 'deleted') fail('AGENT_DELETED', '已删除的定义不能回滚')

  const versionRows = await db
    .select()
    .from(agentDefinitionVersions)
    .where(
      and(
        eq(agentDefinitionVersions.definitionId, id),
        eq(agentDefinitionVersions.version, targetVersion),
      ),
    )
    .limit(1)
  const target = versionRows[0]
  if (!target) fail('AGENT_NOT_FOUND', '目标版本不存在')

  const activeRows = await db
    .select({ id: agentRuns.id, status: agentRuns.status })
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.definitionId, id),
        inArray(agentRuns.status, ['queued', 'running', 'paused', 'blocked']),
      ),
    )
    .orderBy(desc(agentRuns.startedAt))
    .limit(50)
  const activeRuns = activeRows.length

  if (activeRuns > 0) {
    const impactHash = `sha256:${createHash('sha256')
      .update(
        JSON.stringify({
          kind: 'rollback',
          definitionId: id,
          definitionVersion: current.version,
          targetVersion,
          targetSnapshot: target.snapshot,
        }),
      )
      .digest('hex')}`
    const approvalId = await createRollbackApproval(
      actor,
      current,
      targetVersion,
      target.snapshot,
      impactHash,
      activeRuns,
    )
    return {
      requiresApproval: true,
      approvalId,
      status: 'pending',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      activeRuns,
      impactHash,
    }
  }

  const snap = target.snapshot as Record<string, unknown>
  const required = [
    'name',
    'displayName',
    'description',
    'role',
    'systemPrompt',
    'promptVersion',
    'model',
    'temperature',
    'maxTokens',
    'tools',
    'skills',
    'permissions',
    'memoryPolicy',
    'budget',
    'concurrencyLimit',
    'status',
    'isDispatchable',
    'marketAgentId',
    'metadata',
  ]
  const missing = required.filter((key) => !(key in snap))
  if (missing.length > 0) {
    fail('AGENT_INTERNAL_ERROR', `版本快照缺字段: ${missing.join(',')}`)
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(agentDefinitions)
        .set({
          name: String(snap.name),
          displayName: String(snap.displayName),
          description: String(snap.description),
          role: String(snap.role),
          systemPrompt: String(snap.systemPrompt),
          promptVersion: Number(snap.promptVersion),
          model: snap.model === null ? null : String(snap.model),
          temperature: String(snap.temperature),
          maxTokens: snap.maxTokens === null ? null : Number(snap.maxTokens),
          tools: snap.tools as string[],
          skills: snap.skills as string[],
          permissions: snap.permissions as Record<string, unknown>,
          memoryPolicy: snap.memoryPolicy as Record<string, unknown>,
          budget: snap.budget as Record<string, unknown>,
          concurrencyLimit: Number(snap.concurrencyLimit),
          status: snap.status as DefinitionStatus,
          isDispatchable: Boolean(snap.isDispatchable),
          marketAgentId: snap.marketAgentId === null ? null : String(snap.marketAgentId),
          metadata: snap.metadata as Record<string, unknown>,
          version: current.version + 1,
          updatedBy: actor.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(agentDefinitions.id, id), eq(agentDefinitions.version, ifVersion)))
        .returning()
      const row = rows[0]
      if (!row) {
        throw new AppError(
          `版本冲突，当前版本 ${current.version}`,
          httpStatusForErrorCode('AGENT_VERSION_CONFLICT'),
          'AGENT_VERSION_CONFLICT',
        )
      }
      await writeDefinitionVersion(tx, row, 'rollback', actor.userId, `回滚到 v${targetVersion}`)
      return row
    })
    const auditId = await writeRegistryAudit(
      actor,
      'agent.definition.rolled_back',
      updated,
      'success',
      {
        fromVersion: current.version,
        toVersion: targetVersion,
        newVersion: updated.version,
      },
    )
    return { ...toDefinitionView(updated, true), auditId }
  } catch (error) {
    if (error instanceof AppError) throw error
    const code = pgErrorCode(error)
    if (code === '23505') fail('AGENT_NAME_TAKEN', '回滚目标版本名称已被占用')
    logger.warn('[agent-registry] rollback failed', { error: (error as Error).message })
    fail('AGENT_INTERNAL_ERROR', '回滚定义失败')
  }
}
