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

import { USER_PREFERENCE_GROUPS, findUserPreferences } from '../db/user-preferences-queries.js'
import { db } from '../db/index.js'
import { userPreferences } from '@ihui/database'
import { and, eq } from 'drizzle-orm'

/** 授权写回必须落在这个事务连接上,否则行锁与写语句不在同一事务里,锁形同虚设。 */
type GrantsTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

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

/** 把存储里的原始 JSON 解析成合法授权行(纯函数,无副作用,不写回)。 */
function parseGrants(value: string | null | undefined, now: number): ApprovalGrant[] {
  if (!value) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isGrant).filter((g) => g.expiresAt > now)
}

/** 读取并过滤掉过期/畸形行;到期行同时从存储里清走(不留垃圾)。 */
export async function loadPermissionGrants(
  userId: string,
  now = Date.now(),
): Promise<ApprovalGrant[]> {
  const { list } = await findUserPreferences(userId, USER_PREFERENCE_GROUPS.permission)
  const row = list.find((r) => r.key === GRANTS_KEY)

  const active = parseGrants(row?.value, now)
  // 原值里确有"过期/畸形"行才写回,避免每次读都产生无谓写入。
  const rawCount = (() => {
    if (!row?.value) return 0
    try {
      const v: unknown = JSON.parse(row.value)
      return Array.isArray(v) ? v.length : 0
    } catch {
      return 0
    }
  })()
  if (row?.value && active.length !== rawCount) {
    // 清理过期/畸形行的写回也必须走行锁:否则 GET 拿旧快照写回,会把并发新建的授权一起覆盖掉。
    await withGrantsLock(userId, (tx, current) => writeGrants(tx, userId, current))
  }
  return active
}

/**
 * 事务内锁读当前授权整行(F-419):
 * `SELECT ... FOR UPDATE` 锁住 (userId, permission, grants) 这一行,把 load→filter→写
 * 的读-改-写收进**同一事务**,并发 create/revoke/清理在此串行化 —— 撤销不会再被并发创建
 * 用旧快照复活,新授权也不会被旧快照覆盖。写回必须用回调给出的 `tx`。
 * 有意走 db(写主库)而非 dbRead:加锁写路径必须落在主库。
 * 锁内不调用 loadPermissionGrants(它会写回,与锁行冲突会自锁)。
 */
async function withGrantsLock<T>(
  userId: string,
  work: (tx: GrantsTx, current: ApprovalGrant[]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const lockRow = async (): Promise<string | null | undefined> =>
      (
        await tx
          .select({ value: userPreferences.value })
          .from(userPreferences)
          .where(
            and(
              eq(userPreferences.userId, userId),
              eq(userPreferences.group, USER_PREFERENCE_GROUPS.permission),
              eq(userPreferences.key, GRANTS_KEY),
            ),
          )
          .for('update')
      )[0]?.value

    let value = await lockRow()
    if (value === undefined) {
      // 首授时整行还不存在 ⇒ `FOR UPDATE` 锁不到任何行,两个并发首授会读到同一个空快照。
      // 先占位插入空授权行再锁读,让后续读写有真行可锁(幂等,已存在则什么都不做)。
      await tx
        .insert(userPreferences)
        .values({
          userId,
          group: USER_PREFERENCE_GROUPS.permission,
          key: GRANTS_KEY,
          value: '[]',
        })
        .onConflictDoNothing({
          target: [userPreferences.userId, userPreferences.group, userPreferences.key],
        })
      value = await lockRow()
    }
    return work(tx, parseGrants(value, Date.now()))
  })
}

/** 事务内写回整行授权。 */
async function writeGrants(tx: GrantsTx, userId: string, grants: ApprovalGrant[]): Promise<void> {
  const value = JSON.stringify(grants)
  await tx
    .insert(userPreferences)
    .values({
      userId,
      group: USER_PREFERENCE_GROUPS.permission,
      key: GRANTS_KEY,
      value,
    })
    .onConflictDoUpdate({
      target: [userPreferences.userId, userPreferences.group, userPreferences.key],
      set: { value, updatedAt: new Date() },
    })
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
  // 读-改-写在同一把行锁内完成(F-419):并发撤销在同一事务窗口被串行化,不会丢。
  await withGrantsLock(userId, (tx, existing) => {
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
    return writeGrants(tx, userId, [...deduped, grant])
  })
  return grant
}

/** 撤销接口的存储落地。返回是否确有该行被删除(不存在 → false,由路由给 404)。 */
export async function revokePermissionGrant(userId: string, grantId: string): Promise<boolean> {
  // 读-改-写在同一把行锁内完成(F-419):并发创建不再用旧快照覆盖已撤销的行。
  return withGrantsLock(userId, async (tx, existing) => {
    const next = existing.filter((g) => g.id !== grantId)
    if (next.length === existing.length) return false
    await writeGrants(tx, userId, next)
    return true
  })
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
