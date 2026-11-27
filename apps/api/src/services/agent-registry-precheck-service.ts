// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 总管智能体 · 删除预检（R1 / 01 §6.3）。
 *
 * 这一层的职责只有一个：在软删/彻底删之前，把"这个定义还被谁引用"变成
 * 一份可复核、可哈希、可过期的报告。审批行绑定 impactHash；执行前必须重跑，
 * 任何新增阻断都会把动作挡回去。
 *
 * 与 01 §6.3 的差异必须显式记录，不能假装 12/12：
 * - `runs`/`dispatch`/`jobs`/`sessions`/`cron`/`workflow`/`team`/`market`/`memory`/`audit`/`external`
 *   在本仓有可查询的落点，逐域真查；
 * - `a2a` 在本仓没有卡片表（a2a_service 只是代码路径），标记 `unverified`，
 *   不伪造 0，也不拿它当阻断。
 * 因此返回里同时有 `blocking/warnings/unverified` 三桶；UI 必须把第三桶原文展示。
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { AgentDefinition } from '@ihui/database'
import { httpStatusForErrorCode, type AgentErrorCode } from '@ihui/shared'
import { AppError } from '../errors/AppError.js'
import { config } from '../config/index.js'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'

export const PRECHECK_TTL_MS = 10 * 60 * 1000

export type PrecheckDomain =
  | 'runs'
  | 'dispatch'
  | 'jobs'
  | 'sessions'
  | 'cron'
  | 'workflow'
  | 'team'
  | 'market'
  | 'a2a'
  | 'memory'
  | 'audit'
  | 'external'

export interface PrecheckFinding {
  domain: PrecheckDomain
  count: number
  ids: string[]
  hint?: string
}

export interface PrecheckUnverified {
  domain: PrecheckDomain
  reason: string
}

export interface PrecheckReport {
  definitionId: string
  version: number
  blocking: PrecheckFinding[]
  warnings: PrecheckFinding[]
  unverified: PrecheckUnverified[]
  impactHash: string
}

export interface PrecheckResult extends PrecheckReport {
  precheckToken: string
  expiresAt: string
}

interface PrecheckTokenPayload {
  v: 1
  actor: string
  definitionId: string
  version: number
  impactHash: string
  expiresAt: number
}

function fail(code: AgentErrorCode, message: string): never {
  throw new AppError(message, httpStatusForErrorCode(code), code)
}

function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  const maybe = raw as { rows?: Record<string, unknown>[] }
  return Array.isArray(maybe.rows) ? maybe.rows : []
}

function idsOf(raw: unknown): string[] {
  return rowsOf(raw)
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .slice(0, 100)
}

function quotePattern(term: string): string {
  return `%${term.replace(/[%_]/g, '\\$&')}%`
}

async function probe(
  domain: PrecheckDomain,
  query: () => Promise<unknown>,
): Promise<{ ids: string[]; error?: string }> {
  try {
    return { ids: idsOf(await query()) }
  } catch (error) {
    logger.warn('[agent-registry] precheck domain query failed', {
      domain,
      error: (error as Error).message,
    })
    return { ids: [], error: (error as Error).message }
  }
}

function finding(domain: PrecheckDomain, ids: string[], hint?: string): PrecheckFinding {
  return { domain, count: ids.length, ids, ...(hint === undefined ? {} : { hint }) }
}

/** 12 域逐域探测。返回的三桶由规格 §6.3 的阻断/警告条件决定。 */
export async function buildPrecheckReport(definition: AgentDefinition): Promise<PrecheckReport> {
  const id = definition.id
  const name = definition.name
  const activeDefinition = sql`${id}::uuid`
  const blocking: PrecheckFinding[] = []
  const warnings: PrecheckFinding[] = []
  const unverified: PrecheckUnverified[] = []

  const runs = await probe('runs', () =>
    db.execute(sql`
      SELECT id::text AS id FROM agent_runs
      WHERE definition_id = ${activeDefinition}
        AND status IN ('queued', 'running', 'paused', 'blocked')
      LIMIT 100
    `),
  )
  if (runs.error) unverified.push({ domain: 'runs', reason: runs.error })
  if (runs.ids.length > 0) blocking.push(finding('runs', runs.ids, '先 stop 或等待运行结束'))

  const dispatch = await probe('dispatch', () =>
    db.execute(sql`
      SELECT DISTINCT dispatch_id AS id FROM agent_runs
      WHERE definition_id = ${activeDefinition}
        AND dispatch_id IS NOT NULL
        AND status IN ('queued', 'running', 'paused', 'blocked')
      LIMIT 100
    `),
  )
  if (dispatch.error) unverified.push({ domain: 'dispatch', reason: dispatch.error })
  if (dispatch.ids.length > 0) blocking.push(finding('dispatch', dispatch.ids, '有活跃派单'))

  const jobs = await probe('jobs', () =>
    db.execute(sql`
      SELECT id::text AS id FROM agent_tasks
      WHERE status IN ('pending', 'running')
        AND (payload->>'agentDefinitionId' = ${id}
          OR payload->>'definitionId' = ${id}
          OR payload->>'agentName' = ${name})
      LIMIT 100
    `),
  )
  if (jobs.error) unverified.push({ domain: 'jobs', reason: jobs.error })
  if (jobs.ids.length > 0) blocking.push(finding('jobs', jobs.ids, '有后台任务在跑'))

  const sessions = await probe('sessions', () =>
    db.execute(sql`
      SELECT id FROM agent_runtime_sessions
      WHERE status = 'active'
        AND (metadata->>'agentDefinitionId' = ${id}
          OR metadata->>'definitionId' = ${id}
          OR metadata->>'agentName' = ${name})
      LIMIT 100
    `),
  )
  if (sessions.error) unverified.push({ domain: 'sessions', reason: sessions.error })
  if (sessions.ids.length > 0) blocking.push(finding('sessions', sessions.ids, '有活跃会话'))

  const cron = await probe('cron', () =>
    db.execute(sql`
      SELECT id::text AS id FROM schedule_tasks
      WHERE enabled = true
        AND (parameters ILIKE ${quotePattern(id)} OR parameters ILIKE ${quotePattern(name)})
      LIMIT 100
    `),
  )
  if (cron.error) unverified.push({ domain: 'cron', reason: cron.error })
  if (cron.ids.length > 0) blocking.push(finding('cron', cron.ids, '有启用中的定时任务引用'))

  const workflow = await probe('workflow', () =>
    db.execute(sql`
      SELECT id::text AS id FROM workflows
      WHERE is_active = true
        AND (steps::text ILIKE ${quotePattern(id)}
          OR steps::text ILIKE ${quotePattern(name)}
          OR trigger_config::text ILIKE ${quotePattern(id)}
          OR trigger_config::text ILIKE ${quotePattern(name)})
      LIMIT 100
    `),
  )
  if (workflow.error) unverified.push({ domain: 'workflow', reason: workflow.error })
  if (workflow.ids.length > 0) blocking.push(finding('workflow', workflow.ids, '有启用工作流引用'))

  const team = await probe('team', () =>
    db.execute(sql`
      SELECT DISTINCT team_id::text AS id FROM agent_team_members
      WHERE left_at IS NULL
        AND member_kind = 'agent'
        AND (member_id = ${name} OR member_id = ${id})
      LIMIT 100
    `),
  )
  if (team.error) unverified.push({ domain: 'team', reason: team.error })
  if (team.ids.length > 0) {
    warnings.push(finding('team', team.ids, '仍是协作团队成员；删除后成员位会空'))
  }

  const market = definition.marketAgentId
    ? await probe('market', () =>
        db.execute(sql`
          SELECT agent_id::text AS id FROM agents
          WHERE agent_id = ${definition.marketAgentId}::uuid
            AND status = 'published'
          LIMIT 1
        `),
      )
    : { ids: [] }
  if ('error' in market && market.error) unverified.push({ domain: 'market', reason: market.error })
  if (market.ids.length > 0) blocking.push(finding('market', market.ids, '有在售市场商品'))

  // 本仓没有 a2a 卡片表；不伪造 0。
  unverified.push({ domain: 'a2a', reason: '本仓无 a2a 卡片表，无法在 API 侧判定' })

  const memory = await probe('memory', () =>
    db.execute(sql`
      SELECT id::text AS id FROM user_memories
      WHERE status = 'active'
        AND (metadata->>'agentDefinitionId' = ${id}
          OR metadata->>'definitionId' = ${id}
          OR metadata->>'agentName' = ${name})
      LIMIT 100
    `),
  )
  if (memory.error) unverified.push({ domain: 'memory', reason: memory.error })
  if (memory.ids.length > 0)
    warnings.push(finding('memory', memory.ids, '有记忆引用；删除后记忆不会自动清'))

  // 排除本次删除/清除/回滚请求自己写下的三条审计：审批创建会在预检之后写一条
  // `*_requested`，若把它计入 impactHash，执行前复检必然判定“影响面变化”，
  // 审批永远批不过。其余管理动作仍计为警告，保留“近 7 天有人动过”的证据。
  const auditRows = await probe('audit', () =>
    db.execute(sql`
      SELECT id::text AS id FROM audit_logs_chain
      WHERE resource_type = 'agent_definition'
        AND resource_id = ${id}
        AND timestamp >= now() - interval '7 days'
        AND action NOT IN (
          'agent.definition.delete_requested',
          'agent.definition.purge_requested',
          'agent.definition.rollback_requested'
        )
      LIMIT 100
    `),
  )
  if (auditRows.error) unverified.push({ domain: 'audit', reason: auditRows.error })
  if (auditRows.ids.length > 0) {
    warnings.push(finding('audit', auditRows.ids, '近 7 天有管理动作，审计链会保留'))
  }

  const externalRefs = Array.isArray(definition.metadata?.externalRefs)
    ? (definition.metadata.externalRefs as unknown[])
    : []
  const requiredRefs: string[] = []
  const optionalRefs: string[] = []
  for (const ref of externalRefs) {
    if (typeof ref === 'string') optionalRefs.push(ref)
    else if (typeof ref === 'object' && ref !== null) {
      const record = ref as Record<string, unknown>
      const refId =
        typeof record.id === 'string'
          ? record.id
          : typeof record.name === 'string'
            ? record.name
            : JSON.stringify(record)
      if (record.required === true) requiredRefs.push(refId)
      else optionalRefs.push(refId)
    }
  }
  if (requiredRefs.length > 0) {
    blocking.push(finding('external', requiredRefs, 'metadata.externalRefs 标记为 required'))
  }
  if (optionalRefs.length > 0) warnings.push(finding('external', optionalRefs, '有普通外部引用'))

  const report: PrecheckReport = {
    definitionId: id,
    version: definition.version,
    blocking: sortFindings(blocking),
    warnings: sortFindings(warnings),
    unverified,
    impactHash: '',
  }
  report.impactHash = computeImpactHash(report)
  return report
}

function sortFindings(findings: PrecheckFinding[]): PrecheckFinding[] {
  return [...findings]
    .sort((a, b) => a.domain.localeCompare(b.domain))
    .map((item) => ({
      ...item,
      ids: [...item.ids].sort(),
    }))
}

/** 规范化：域排序、id 排序、只取会影响执行的字段；报告里不带时间/随机值。 */
export function computeImpactHash(report: PrecheckReport): string {
  const normalize = (findings: PrecheckFinding[]) =>
    [...findings]
      .sort((a, b) => a.domain.localeCompare(b.domain))
      .map((item) => ({ domain: item.domain, ids: [...item.ids].sort() }))
  const canonical = JSON.stringify({
    definitionId: report.definitionId,
    version: report.version,
    blocking: normalize(report.blocking),
    warnings: normalize(report.warnings),
    unverified: report.unverified
      .map((item) => ({ domain: item.domain, reason: item.reason }))
      .sort((a, b) => a.domain.localeCompare(b.domain)),
  })
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

function sign(payloadB64: string): string {
  return createHmac('sha256', config.JWT_SECRET).update(payloadB64).digest('base64url')
}

/** 生成 10 分钟预检 token；token 只返回一次，库/审批只存它的 hash。 */
export function issuePrecheckToken(
  actorUserId: string,
  report: PrecheckReport,
  now = Date.now(),
): { token: string; expiresAt: string; tokenHash: string } {
  const payload: PrecheckTokenPayload = {
    v: 1,
    actor: actorUserId,
    definitionId: report.definitionId,
    version: report.version,
    impactHash: report.impactHash,
    expiresAt: now + PRECHECK_TTL_MS,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const token = `pc_${payloadB64}.${sign(payloadB64)}`
  return {
    token,
    expiresAt: new Date(payload.expiresAt).toISOString(),
    tokenHash: createHash('sha256').update(token).digest('hex'),
  }
}

/** 校验预检 token：签名 → 过期 → actor/定义/版本/hash 逐项绑定。 */
export function verifyPrecheckToken(
  token: string,
  actorUserId: string,
  report: PrecheckReport,
  now = Date.now(),
): PrecheckTokenPayload {
  if (!token.startsWith('pc_')) fail('AGENT_PREVIEW_REQUIRED', '删除前必须先做预检')
  const [payloadB64, signature] = token.slice(3).split('.')
  if (!payloadB64 || !signature) fail('AGENT_PREVIEW_REQUIRED', '预检 token 格式非法')
  const expected = sign(payloadB64)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    fail('APPROVAL_MISMATCH', '预检 token 签名不匹配')
  }
  let payload: PrecheckTokenPayload
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as PrecheckTokenPayload
  } catch {
    fail('AGENT_PREVIEW_REQUIRED', '预检 token 无法解析')
  }
  if (payload.v !== 1 || payload.actor !== actorUserId) {
    fail('APPROVAL_MISMATCH', '预检 token 不属于当前用户')
  }
  if (payload.definitionId !== report.definitionId || payload.version !== report.version) {
    fail('APPROVAL_MISMATCH', '定义或版本已变化，请重新预检')
  }
  if (payload.impactHash !== report.impactHash) {
    fail('AGENT_DELETE_BLOCKED', '预检后影响面发生变化，请重新预检')
  }
  if (payload.expiresAt <= now) {
    fail('AGENT_PREVIEW_EXPIRED', '预检已过期，请重新预检')
  }
  return payload
}

/** 预检入口：报告 + token。调用方必须先做管理权校验。 */
export async function precheckDefinitionDeletion(
  definition: AgentDefinition,
  actorUserId: string,
): Promise<PrecheckResult> {
  const report = await buildPrecheckReport(definition)
  const issued = issuePrecheckToken(actorUserId, report)
  return {
    ...report,
    precheckToken: issued.token,
    expiresAt: issued.expiresAt,
  }
}

/** 执行前复核：hash 必须一致且不得有阻断。 */
export async function recheckBeforeExecution(
  definition: AgentDefinition,
  expectedImpactHash: string,
): Promise<PrecheckReport> {
  const report = await buildPrecheckReport(definition)
  if (report.impactHash !== expectedImpactHash) {
    fail('AGENT_DELETE_BLOCKED', '预检后影响面发生变化，请重新预检')
  }
  if (report.blocking.length > 0) {
    fail('AGENT_DELETE_BLOCKED', '仍有阻断项，不能执行删除')
  }
  return report
}
