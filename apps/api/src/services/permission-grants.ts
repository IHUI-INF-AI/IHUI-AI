// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 审批授权记忆的持久化(2026-11-04 立)
 *
 * 存储复用 `user_preferences` 的独立 group,零迁移(与 `agent` group 存默认权限档同一套路):
 *   group='permission' key='grants' → JSON 数组,元素即 `ApprovalGrant`。
 *
 * 为什么要持久化而不是只放进程内存:授权是**人类做出的决定**,重启后仍应生效;
 * 但**过期判定必须在判定侧**(`decideApproval` 的 `expiresAt` 校验),存储侧只是搬运,
 * 不得靠"UI 不显示"来假装失效。
 *
 * 自动复核用的 `history` 是会话内近因,放进程内存即可:它的语义是"刚被人工放行过的
 * 同一请求再次到来",跨重启复用反而会放大风险。内存条目定长(每用户 200 条)防泄漏。
 */

import { randomUUID } from 'node:crypto'

import type {
  ApprovalGrant,
  ApprovalHistoryEntry,
  ApprovalGrantScope,
} from '@ihui/shared/permission'

import {
  USER_PREFERENCE_GROUPS,
  findUserPreferences,
  upsertUserPreference,
} from '../db/user-preferences-queries.js'

const GRANTS_KEY = 'grants'
const MAX_HISTORY_PER_USER = 200
/** 授权默认 TTL:24h。显式过期是硬要求,不允许生成"永不过期"的授权。 */
export const DEFAULT_GRANT_TTL_SECONDS = 24 * 60 * 60
export const MAX_GRANT_TTL_SECONDS = 30 * 24 * 60 * 60

const recentApprovals = new Map<string, ApprovalHistoryEntry[]>()

function isGrant(value: unknown): value is ApprovalGrant {
  if (!value || typeof value !== 'object') return false
  const g = value as Record<string, unknown>
  const scope = g.scope
  if (scope !== 'workspace' && scope !== 'agent' && scope !== 'global') return false
  return (
    typeof g.id === 'string' &&
    typeof g.tool === 'string' &&
    typeof g.matchPattern === 'string' &&
    typeof g.expiresAt === 'number' &&
    typeof g.createdAt === 'number' &&
    typeof g.grantedBy === 'string'
  )
}

/** 读取并过滤掉过期/畸形行;到期行同时从存储里清走(不留垃圾)。 */
export async function loadPermissionGrants(
  userId: string,
  now = Date.now(),
): Promise<ApprovalGrant[]> {
  const { list } = await findUserPreferences(userId, USER_PREFERENCE_GROUPS.permission)
  const row = list.find((r) => r.key === GRANTS_KEY)
  if (!row?.value) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(row.value)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const all = parsed.filter(isGrant)
  const active = all.filter((g) => g.expiresAt > now)
  if (active.length !== all.length) {
    await upsertUserPreference(
      userId,
      USER_PREFERENCE_GROUPS.permission,
      GRANTS_KEY,
      JSON.stringify(active),
    )
  }
  return active
}

export interface CreateGrantInput {
  tool: string
  matchPattern: string
  scope: ApprovalGrantScope
  workspaceId?: string
  agentId?: string
  ttlSeconds?: number
}

/** 创建授权。scope=workspace/agent 时对应 id 必填 —— 缺失直接报错,不做"放之四海"的默认。 */
export async function createPermissionGrant(
  userId: string,
  input: CreateGrantInput,
  now = Date.now(),
): Promise<ApprovalGrant> {
  if (!input.tool.trim() || !input.matchPattern.trim()) {
    throw new Error('tool 与 matchPattern 不能为空')
  }
  if (input.scope === 'workspace' && !input.workspaceId?.trim()) {
    throw new Error('scope=workspace 必须提供 workspaceId')
  }
  if (input.scope === 'agent' && !input.agentId?.trim()) {
    throw new Error('scope=agent 必须提供 agentId')
  }
  const ttl = Math.min(
    Math.max(input.ttlSeconds ?? DEFAULT_GRANT_TTL_SECONDS, 60),
    MAX_GRANT_TTL_SECONDS,
  )
  const grant: ApprovalGrant = {
    id: randomUUID(),
    tool: input.tool.trim(),
    matchPattern: input.matchPattern.trim(),
    scope: input.scope,
    workspaceId: input.scope === 'workspace' ? input.workspaceId?.trim() : undefined,
    agentId: input.scope === 'agent' ? input.agentId?.trim() : undefined,
    createdAt: now,
    expiresAt: now + ttl * 1000,
    grantedBy: userId,
  }
  const existing = await loadPermissionGrants(userId, now)
  // 同 (tool, matchPattern, scope, 对应 id) 只保留一条:重复授权刷新 TTL,不叠行。
  const deduped = existing.filter(
    (g) =>
      !(
        g.tool === grant.tool &&
        g.matchPattern === grant.matchPattern &&
        g.scope === grant.scope &&
        g.workspaceId === grant.workspaceId &&
        g.agentId === grant.agentId
      ),
  )
  await upsertUserPreference(
    userId,
    USER_PREFERENCE_GROUPS.permission,
    GRANTS_KEY,
    JSON.stringify([...deduped, grant]),
  )
  return grant
}

/** 撤销接口的存储落地。返回是否确有该行被删除(不存在 → false,由路由给 404)。 */
export async function revokePermissionGrant(
  userId: string,
  grantId: string,
  now = Date.now(),
): Promise<boolean> {
  const existing = await loadPermissionGrants(userId, now)
  const next = existing.filter((g) => g.id !== grantId)
  if (next.length === existing.length) return false
  await upsertUserPreference(
    userId,
    USER_PREFERENCE_GROUPS.permission,
    GRANTS_KEY,
    JSON.stringify(next),
  )
  return true
}

/** 记录一次真实的人工结论,供自动复核比对(同主体/同工作区/同规则/同目标)。 */
export function recordApprovalHistory(userId: string, entry: ApprovalHistoryEntry): void {
  const list = recentApprovals.get(userId) ?? []
  list.push(entry)
  if (list.length > MAX_HISTORY_PER_USER) list.splice(0, list.length - MAX_HISTORY_PER_USER)
  recentApprovals.set(userId, list)
}

export function listApprovalHistory(userId: string): ApprovalHistoryEntry[] {
  return recentApprovals.get(userId) ?? []
}

/** 测试/止损用:清空某用户的近因历史(不触碰持久化授权)。 */
export function clearApprovalHistory(userId: string): void {
  recentApprovals.delete(userId)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
