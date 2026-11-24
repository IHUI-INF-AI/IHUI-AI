// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 报销审批人解析(2026-11-24 十一波)。
 *
 * 为什么单独一支:报销自助提单 POST /my/submit 要求 approverChain(用户 id 数组),
 * 但普通员工不可能知道同事的 UUID —— 上一波后端有端点、前端没入口,真提单仍卡在
 * "填一串 uuid"。本文件把"审批人是谁"从员工脑子里搬到系统里。
 *
 * 口径(与 /decide 的权限闸同源,不造点不动的按钮):
 *   审批动作挂在 finance:ledger:view|manage 上,故候选人**必须是**具备财务权限的人
 *   (含 roleId>=1 的系统管理员兜底),否则链上写着"该他批",他点进来 403。
 *   默认链只放 1 人 —— 审批链每多一级就多一个卡点;员工可在页面上自行追加。
 *
 * 反自批:候选人里排除提交人自己(服务层 submitClaim 还有一道同义硬校验)。
 * 一个都没有 ⇒ 不静默降级,抛 EXPENSE_NO_APPROVER 并在文案里给可执行的下一步。
 */
import { and, eq, gte, inArray, isNull } from 'drizzle-orm'

import { hrEmployee, permissions, rolePermissions, userRoles, users } from '@ihui/database'
import { AppError } from '../errors/AppError.js'
import { db } from '../db/index.js'

/** 能审报销的权限点(与 routes/hr-expense.ts 的 FIN_VIEW / FIN_MANAGE 同源) */
export const EXPENSE_APPROVER_PERMISSIONS = [
  'finance:ledger:view',
  'finance:ledger:manage',
] as const
/** 审批链上限(与提交路由 zod .max(8) 同源) */
export const EXPENSE_APPROVER_MAX = 8

export interface ExpenseApproverCandidate {
  userId: string
  /** 展示名:员工档案名 > 昵称 > 用户名 > id 前 8 位 */
  name: string
  /** finance = 财务权限持有者;admin = 系统管理员兜底 */
  source: 'finance' | 'admin'
}

export interface ExpenseApproverRoster {
  candidates: ExpenseApproverCandidate[]
  /** 默认链(已排除本人;可能为空) */
  defaultChain: string[]
  /** 机器码,前端负责本地化:self-excluded / no-approver */
  warnings: string[]
}

/**
 * 审批链纯核(不碰库):财务权限者优先,管理员兜底;排除本人;去重;按上限截断。
 * 返回空数组不是错误 —— 由调用方决定"没人是硬错还是给页面提示"。
 */
export function buildExpenseApproverChain(
  candidates: readonly ExpenseApproverCandidate[],
  selfUserId: string | null,
  max = EXPENSE_APPROVER_MAX,
): { userIds: string[]; warnings: string[] } {
  const warnings: string[] = []
  if (selfUserId && candidates.some((c) => c.userId === selfUserId)) warnings.push('self-excluded')
  const usable = candidates.filter((c) => c.userId !== selfUserId)
  if (usable.length === 0) {
    warnings.push('no-approver')
    return { userIds: [], warnings }
  }
  const ordered = [...usable].sort(
    (a, b) => (a.source === 'finance' ? 0 : 1) - (b.source === 'finance' ? 0 : 1),
  )
  const seen = new Set<string>()
  const userIds: string[] = []
  for (const c of ordered) {
    if (seen.has(c.userId)) continue
    seen.add(c.userId)
    userIds.push(c.userId)
    if (userIds.length >= Math.max(1, max)) break
  }
  return { userIds, warnings }
}

/** 查一批 userId 的展示名(员工档案名优先;查不到的 id 不回,调用方回退短 id) */
export async function expenseApproverNames(
  userIds: readonly string[],
): Promise<Record<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return {}
  const [userRows, empRows] = await Promise.all([
    db
      .select({ id: users.id, nickname: users.nickname, username: users.username })
      .from(users)
      .where(inArray(users.id, ids)),
    db
      .select({ userId: hrEmployee.userId, name: hrEmployee.name })
      .from(hrEmployee)
      .where(
        and(
          inArray(hrEmployee.userId, ids),
          eq(hrEmployee.status, 'active'),
          isNull(hrEmployee.deletedAt),
        ),
      ),
  ])
  const empName = new Map<string, string>()
  for (const r of empRows) if (r.userId) empName.set(r.userId, r.name)
  const out: Record<string, string> = {}
  for (const u of userRows) {
    out[u.id] = empName.get(u.id) ?? u.nickname ?? u.username ?? ''
  }
  return out
}

/**
 * 读审批人候选池(现读库,不缓存:权限/账号变动要立刻生效)。
 * 三步:权限持有者 ∪ 管理员 → 过滤 active 账号 → 名字用员工档案优先。
 */
export async function loadExpenseApproverRoster(
  selfUserId: string | null,
): Promise<ExpenseApproverRoster> {
  const permRows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(inArray(permissions.name, [...EXPENSE_APPROVER_PERMISSIONS]))
  const permIds = new Set(permRows.map((r) => r.userId))

  const adminRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(gte(users.roleId, 1), eq(users.status, 1)))
  const allIds = Array.from(new Set([...permIds, ...adminRows.map((r) => r.id)]))
  if (allIds.length === 0) {
    return { candidates: [], defaultChain: [], warnings: ['no-approver'] }
  }

  const activeAll = await db
    .select({ id: users.id, nickname: users.nickname, username: users.username })
    .from(users)
    .where(and(inArray(users.id, allIds), eq(users.status, 1)))
  /**
   * 2026-11-24 真库验证修正:此前只在默认链里排除本人,candidates 仍把自己回给页面
   * ⇒ 页面上"自己"是一枚可点的审批人,点下去提交后才被 EXPENSE_SELF_APPROVAL 挡回。
   * 反自批要前移到候选池:本人不进 candidates,只留一条 self-excluded 说明。
   */
  const selfInPool = selfUserId ? activeAll.some((r) => r.id === selfUserId) : false
  const baseWarnings = selfInPool ? ['self-excluded'] : []
  const activeRows = selfUserId ? activeAll.filter((r) => r.id !== selfUserId) : activeAll
  if (activeRows.length === 0) {
    return { candidates: [], defaultChain: [], warnings: [...baseWarnings, 'no-approver'] }
  }

  const names = await expenseApproverNames(activeRows.map((r) => r.id))
  const candidates: ExpenseApproverCandidate[] = activeRows.map((u) => ({
    userId: u.id,
    name: names[u.id] ?? u.nickname ?? u.username ?? u.id.slice(0, 8),
    source: permIds.has(u.id) ? 'finance' : 'admin',
  }))
  /**
   * 2026-11-24 真库验证修正:展示顺序要与默认链同序。
   * 原来 candidates 按库返回顺序(管理员在前),而 defaultChain 按 finance 优先 ——
   * 于是页面上默认选中的人排在候选末尾,员工看不出"为什么是他"。
   */
  const ordered = [...candidates].sort(
    (a, b) => (a.source === 'finance' ? 0 : 1) - (b.source === 'finance' ? 0 : 1),
  )
  // 本人已在上面剔出,纯核这里不再传 selfUserId(否则会重复记一条 self-excluded)
  const chain = buildExpenseApproverChain(ordered, null, 1)
  const warnings = [...new Set([...baseWarnings, ...chain.warnings])]
  return { candidates: ordered, defaultChain: chain.userIds, warnings }
}

/**
 * 服务层口径:自助提单未给链时自动解析;一个可用审批人都没有 ⇒ 硬错。
 * 文案给可执行下一步(§0 以人为本:报错要告诉人"那我该找谁")。
 */
export async function resolveExpenseApproverChain(
  selfUserId: string | null,
): Promise<{ userIds: string[]; warnings: string[] }> {
  const roster = await loadExpenseApproverRoster(selfUserId)
  if (roster.defaultChain.length === 0) {
    throw new AppError(
      '系统还没有可用的报销审批人:请管理员给财务同事授予「财务账簿查看」权限,或在员工自助页手动指定审批人后再提交',
      409,
      'EXPENSE_NO_APPROVER',
    )
  }
  return { userIds: roster.defaultChain, warnings: roster.warnings }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
