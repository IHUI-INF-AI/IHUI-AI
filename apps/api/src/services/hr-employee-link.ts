// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import { hrDepartment, hrEmployee, hrEmployeeLinkRequest, users } from '@ihui/database'
import { db } from '../db/index.js'
import { AppError } from '../errors/AppError.js'
// DB-35:phone/email 列存密文;按 account 匹配走 lookup 盲索引,投影读出后解密再打码
import { contactLookupForSearch, decryptPublicContact } from '../utils/user-contact.js'

/**
 * 员工-平台账号关联(2026-11-16 立)。
 *
 * 立因:用户要求「每个用户之间的数据必须隔离;除非设置为本公司员工、添加关联对应方账号且对方同意」。
 * 此前自助页用手机号做唯一兜底自动认领 —— 同号即能读到他人考勤/工资,等于未授权关联。
 * 现改为严格三段式:
 *   1) HR 为员工档案指定关联账号(手机号/邮箱/用户名或 userId) → 生成 pending 邀请;
 *   2) 被指定账号本人在自助页看到邀请,明确同意 → 事务内写入 hr_employee.user_id;
 *   3) 拒绝/撤销/未同意期间,任何账号都读不到该员工数据。
 * 绑定生效后,自助端点仍按登录 userId 收口,不接受客户端传 employeeId。
 */

export interface PendingLinkForUser {
  id: string
  employeeNo: string
  name: string
  departmentName: string | null
  position: string | null
  invitedAt: string
}

/** 自助面"我是谁"的档案投影(未绑定时调用方拿 null,不暴露任何线索)。 */
export interface SelfEmployeeForUser {
  id: string
  employeeNo: string
  name: string
  departmentId: string
  departmentName: string | null
  position: string | null
  hireDate: string | null
  status: string
}

/**
 * 按登录 userId 取已绑定员工档案(2026-11-17)。
 *
 * 只认 hr_employee.user_id 这一条绑定事实 —— 不接受客户端传 employeeId,
 * 也不拿手机号/邮箱做兜底自动认领(那正是 2026-11-16 取消的同号即读他人数据)。
 */
export async function getSelfEmployeeForUser(
  userId: string,
): Promise<SelfEmployeeForUser | null> {
  const [row] = await db
    .select({
      id: hrEmployee.id,
      employeeNo: hrEmployee.employeeNo,
      name: hrEmployee.name,
      departmentId: hrEmployee.departmentId,
      departmentName: hrDepartment.name,
      position: hrEmployee.position,
      hireDate: hrEmployee.hireDate,
      status: hrEmployee.status,
    })
    .from(hrEmployee)
    .leftJoin(hrDepartment, eq(hrDepartment.id, hrEmployee.departmentId))
    .where(and(eq(hrEmployee.userId, userId), isNull(hrEmployee.deletedAt)))
    .limit(1)
  if (!row) return null
  return { ...row, hireDate: row.hireDate ?? null }
}

/** 账号脱敏:手机号 138****0000;邮箱 a***@b.com;其它保留首字符。 */
export function maskAccount(account: string | null | undefined): string | null {
  if (!account) return null
  const value = account.trim()
  if (!value) return null
  if (value.includes('@')) {
    const [name, domain] = value.split('@')
    return `${(name ?? '').slice(0, 1)}***@${domain ?? ''}`
  }
  if (value.length >= 7) return `${value.slice(0, 3)}****${value.slice(-4)}`
  return `${value.slice(0, 1)}***`
}

/**
 * HR 发起关联邀请。account 与 userId 二选一。
 * 只创建 pending 记录,不写 hr_employee.user_id —— 必须由被邀请账号本人同意。
 */
export async function inviteEmployeeLink(params: {
  employeeId: string
  account?: string | undefined
  userId?: string | undefined
  invitedBy: string | null
}): Promise<{
  requestId: string
  employeeId: string
  accountMasked: string | null
  status: string
}> {
  const { employeeId, invitedBy } = params
  const account = params.account?.trim()
  if (!account && !params.userId)
    throw new AppError('请提供要关联的平台账号(手机号/邮箱/用户名)', 400, 'ACCOUNT_REQUIRED')

  const [employee] = await db
    .select({ id: hrEmployee.id, userId: hrEmployee.userId })
    .from(hrEmployee)
    .where(and(eq(hrEmployee.id, employeeId), isNull(hrEmployee.deletedAt)))
    .limit(1)
  if (!employee) throw new AppError('员工档案不存在', 404, 'EMPLOYEE_NOT_FOUND')
  if (employee.userId)
    throw new AppError(
      '该员工档案已关联平台账号,如需更换请先解除原关联',
      409,
      'EMPLOYEE_ALREADY_BOUND',
    )

  // DB-35:phone/email 列存密文,按 account 匹配走 lookup 盲索引;username 仍明文等值。
  // 密文列上 lower() 不可用,email 也改走 email_lookup。
  const phoneLookup = account ? contactLookupForSearch('phone', account) : null
  const emailLookup = account ? contactLookupForSearch('email', account) : null
  const accountSelect = {
    id: users.id,
    phone: users.phone,
    email: users.email,
    username: users.username,
    status: users.status,
  }
  const [accountUser] = params.userId
    ? await db
        .select(accountSelect)
        .from(users)
        .where(eq(users.id, params.userId))
        .limit(1)
    : await db
        .select(accountSelect)
        .from(users)
        .where(
          or(
            eq(users.username, account ?? ''),
            ...(phoneLookup ? [eq(users.phoneLookup, phoneLookup)] : []),
            ...(emailLookup ? [eq(users.emailLookup, emailLookup)] : []),
          ),
        )
        .limit(1)
  if (!accountUser) throw new AppError('未找到对应的平台账号', 404, 'ACCOUNT_NOT_FOUND')
  if (accountUser.status !== 1)
    throw new AppError('该平台账号已被禁用或注销,无法关联', 400, 'ACCOUNT_DISABLED')

  const [boundElsewhere] = await db
    .select({ id: hrEmployee.id })
    .from(hrEmployee)
    .where(
      and(
        eq(hrEmployee.userId, accountUser.id),
        isNull(hrEmployee.deletedAt),
        ne(hrEmployee.id, employeeId),
      ),
    )
    .limit(1)
  if (boundElsewhere)
    throw new AppError('该平台账号已关联其他员工档案', 409, 'ACCOUNT_ALREADY_BOUND')

  const row = await db.transaction(async (tx) => {
    // 一个员工同时只保留一条待确认邀请:旧邀请置为 revoked 后再建新邀请
    const revokedChanged = { status: 'revoked' }
    await tx
      .update(hrEmployeeLinkRequest)
      .set({ ...revokedChanged, updatedAt: new Date() })
      .where(
        and(
          eq(hrEmployeeLinkRequest.employeeId, employeeId),
          eq(hrEmployeeLinkRequest.status, 'pending'),
        ),
      )
    const [created] = await tx
      .insert(hrEmployeeLinkRequest)
      .values({
        employeeId,
        userId: accountUser.id,
        status: 'pending',
        invitedBy,
      })
      .returning()
    if (!created) throw new AppError('关联邀请创建失败', 500, 'INTERNAL')
    return created
  })

  // DB-35:phone/email 投影是密文,先解密再打码,否则 maskAccount 打的是密文字符串。
  const accountDecrypted = decryptPublicContact(accountUser)
  const masked = maskAccount(
    accountDecrypted.phone ?? accountDecrypted.email ?? accountUser.username,
  )
  return {
    requestId: row.id,
    employeeId,
    accountMasked: masked,
    status: row.status,
  }
}

/** HR 撤销该员工当前的待确认邀请(幂等:无待确认时返回 0)。 */
export async function revokeEmployeeLinkInvite(employeeId: string): Promise<number> {
  const changed = { status: 'revoked' }
  const rows = await db
    .update(hrEmployeeLinkRequest)
    .set({ ...changed, updatedAt: new Date() })
    .where(
      and(
        eq(hrEmployeeLinkRequest.employeeId, employeeId),
        eq(hrEmployeeLinkRequest.status, 'pending'),
      ),
    )
    .returning({ id: hrEmployeeLinkRequest.id })
  return rows.length
}

/** 某账号的全部待确认关联邀请(自助页展示「同意/拒绝」)。 */
export async function listPendingLinksForUser(userId: string): Promise<PendingLinkForUser[]> {
  const rows = await db
    .select({
      id: hrEmployeeLinkRequest.id,
      employeeNo: hrEmployee.employeeNo,
      name: hrEmployee.name,
      departmentName: hrDepartment.name,
      position: hrEmployee.position,
      invitedAt: hrEmployeeLinkRequest.createdAt,
    })
    .from(hrEmployeeLinkRequest)
    .innerJoin(hrEmployee, eq(hrEmployee.id, hrEmployeeLinkRequest.employeeId))
    .leftJoin(hrDepartment, eq(hrDepartment.id, hrEmployee.departmentId))
    .where(
      and(
        eq(hrEmployeeLinkRequest.userId, userId),
        eq(hrEmployeeLinkRequest.status, 'pending'),
        isNull(hrEmployee.deletedAt),
      ),
    )
    .orderBy(desc(hrEmployeeLinkRequest.createdAt))
  return rows.map((r) => ({
    id: r.id,
    employeeNo: r.employeeNo,
    name: r.name,
    departmentName: r.departmentName,
    position: r.position,
    invitedAt: r.invitedAt.toISOString(),
  }))
}

/** 管理面批量查询员工的待确认关联状态(供员工列表展示)。 */
export async function listPendingLinkStates(
  employeeIds: string[],
): Promise<Map<string, { requestId: string; accountMasked: string | null }>> {
  const map = new Map<string, { requestId: string; accountMasked: string | null }>()
  if (employeeIds.length === 0) return map
  const rows = await db
    .select({
      requestId: hrEmployeeLinkRequest.id,
      employeeId: hrEmployeeLinkRequest.employeeId,
      phone: users.phone,
      email: users.email,
      username: users.username,
    })
    .from(hrEmployeeLinkRequest)
    .innerJoin(users, eq(users.id, hrEmployeeLinkRequest.userId))
    .where(
      and(
        inArray(hrEmployeeLinkRequest.employeeId, employeeIds),
        eq(hrEmployeeLinkRequest.status, 'pending'),
      ),
    )
  for (const r of rows) {
    map.set(r.employeeId, {
      requestId: r.requestId,
      accountMasked: maskAccount(r.phone ?? r.email ?? r.username),
    })
  }
  return map
}

/**
 * 被邀请账号本人同意关联:事务内写 hr_employee.user_id 并把邀请置 approved。
 * 若员工已绑定同一账号则幂等成功;已绑定其他账号或该账号已绑定其他员工 → 409。
 */
export async function acceptEmployeeLink(params: {
  requestId: string
  userId: string
}): Promise<{ employeeId: string }> {
  const { requestId, userId } = params
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(hrEmployeeLinkRequest)
      .where(
        and(
          eq(hrEmployeeLinkRequest.id, requestId),
          eq(hrEmployeeLinkRequest.userId, userId),
          eq(hrEmployeeLinkRequest.status, 'pending'),
        ),
      )
      .limit(1)
    if (!request) throw new AppError('关联邀请不存在或已被处理', 404, 'LINK_REQUEST_NOT_FOUND')

    const [employee] = await tx
      .select({ id: hrEmployee.id, userId: hrEmployee.userId })
      .from(hrEmployee)
      .where(and(eq(hrEmployee.id, request.employeeId), isNull(hrEmployee.deletedAt)))
      .limit(1)
    if (!employee) throw new AppError('员工档案不存在或已删除', 404, 'EMPLOYEE_NOT_FOUND')
    if (employee.userId && employee.userId !== userId)
      throw new AppError('该员工档案已关联其他账号', 409, 'EMPLOYEE_ALREADY_BOUND')

    const [boundElsewhere] = await tx
      .select({ id: hrEmployee.id })
      .from(hrEmployee)
      .where(
        and(
          eq(hrEmployee.userId, userId),
          isNull(hrEmployee.deletedAt),
          ne(hrEmployee.id, employee.id),
        ),
      )
      .limit(1)
    if (boundElsewhere)
      throw new AppError('当前账号已关联其他员工档案', 409, 'ACCOUNT_ALREADY_BOUND')

    if (!employee.userId) {
      const changed = { userId }
      await tx
        .update(hrEmployee)
        .set({ ...changed, updatedAt: new Date() })
        .where(eq(hrEmployee.id, employee.id))
    }
    const approvedChanged = { status: 'approved', decidedAt: new Date() }
    await tx
      .update(hrEmployeeLinkRequest)
      .set({ ...approvedChanged, updatedAt: new Date() })
      .where(eq(hrEmployeeLinkRequest.id, request.id))
    // 同一员工的其它待确认邀请一并失效,避免多账号同时被同意
    const changed = { status: 'revoked' }
    await tx
      .update(hrEmployeeLinkRequest)
      .set({ ...changed, updatedAt: new Date() })
      .where(
        and(
          eq(hrEmployeeLinkRequest.employeeId, employee.id),
          eq(hrEmployeeLinkRequest.status, 'pending'),
          ne(hrEmployeeLinkRequest.id, request.id),
        ),
      )
    return { employeeId: employee.id }
  })
}

/** 被邀请账号本人拒绝关联:仅置 rejected,不写任何绑定。 */
export async function rejectEmployeeLink(params: {
  requestId: string
  userId: string
}): Promise<void> {
  const changed = { status: 'rejected', decidedAt: new Date() }
  const rows = await db
    .update(hrEmployeeLinkRequest)
    .set({ ...changed, updatedAt: new Date() })
    .where(
      and(
        eq(hrEmployeeLinkRequest.id, params.requestId),
        eq(hrEmployeeLinkRequest.userId, params.userId),
        eq(hrEmployeeLinkRequest.status, 'pending'),
      ),
    )
    .returning({ id: hrEmployeeLinkRequest.id })
  if (rows.length === 0)
    throw new AppError('关联邀请不存在或已被处理', 404, 'LINK_REQUEST_NOT_FOUND')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
