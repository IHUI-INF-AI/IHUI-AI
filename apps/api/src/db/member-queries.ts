import { createHash } from 'node:crypto'
import { eq, and, desc, asc, sql, ilike, inArray, or, isNotNull } from 'drizzle-orm'
import { AppError } from '../errors/AppError.js'
import { db } from './index.js'
import {
  eduMembers,
  eduMemberLevels,
  eduCompanies,
  eduDepartments,
  users,
  userProfiles,
  type EduMember,
  type EduMemberLevel,
  type EduCompany,
  type EduDepartment,
  type User,
} from '@ihui/database'

/** SHA256 哈希密码（兼容旧 Java 项目数据，与 Python hashlib.sha256 一致）。 */
export function hashPassword(password: string): string {
  if (!password) return ''
  return createHash('sha256').update(password, 'utf8').digest('hex')
}

// =============================================================================
// 会员
// =============================================================================

export interface FindMembersOpts {
  page: number
  pageSize: number
  username?: string
  mobile?: string
  status?: number
  levelId?: string
}

/** Admin：分页查询会员，支持 username/mobile 模糊搜索与状态/等级筛选。 */
export async function findMembers(
  opts: FindMembersOpts,
): Promise<{ list: EduMember[]; total: number; page: number; pageSize: number }> {
  const conds = []
  if (opts.username) conds.push(ilike(eduMembers.username, `%${opts.username}%`))
  if (opts.mobile) conds.push(ilike(eduMembers.mobile, `%${opts.mobile}%`))
  if (opts.status !== undefined) conds.push(eq(eduMembers.status, opts.status))
  if (opts.levelId) conds.push(eq(eduMembers.levelId, opts.levelId))
  const where = and(...conds)

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduMembers)
      .where(where)
      .orderBy(desc(eduMembers.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduMembers)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

/** 待审核列表（status=0）。 */
export async function findUnauditedMembers(opts: {
  page: number
  pageSize: number
}): Promise<{ list: EduMember[]; total: number; page: number; pageSize: number }> {
  const where = eq(eduMembers.status, 0)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduMembers)
      .where(where)
      .orderBy(desc(eduMembers.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduMembers)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findMemberById(id: string): Promise<EduMember | undefined> {
  const rows = await db.select().from(eduMembers).where(eq(eduMembers.id, id)).limit(1)
  return rows[0]
}

/** 按 username 查询会员。 */
export async function findMemberByUsername(username: string): Promise<EduMember | undefined> {
  const rows = await db.select().from(eduMembers).where(eq(eduMembers.username, username)).limit(1)
  return rows[0]
}

/** 按 mobile 查询会员。 */
export async function findMemberByMobile(mobile: string): Promise<EduMember | undefined> {
  const rows = await db.select().from(eduMembers).where(eq(eduMembers.mobile, mobile)).limit(1)
  return rows[0]
}

/** 批量按 ID 查询会员。 */
export async function findMembersByIds(ids: string[]): Promise<EduMember[]> {
  if (ids.length === 0) return []
  return db.select().from(eduMembers).where(inArray(eduMembers.id, ids))
}

export interface FindAuthMembersOpts {
  page: number
  pageSize: number
  keyword?: string
}

/** 登录用户列表（status=1），支持 username/mobile/nickname 模糊搜索。 */
export async function findAuthMembers(
  opts: FindAuthMembersOpts,
): Promise<{ list: EduMember[]; total: number; page: number; pageSize: number }> {
  const conds = [eq(eduMembers.status, 1)]
  if (opts.keyword) {
    const kw = `%${opts.keyword}%`
    conds.push(
      or(
        ilike(eduMembers.username, kw),
        ilike(eduMembers.mobile, kw),
        ilike(eduMembers.nickname, kw),
      )!,
    )
  }
  const where = and(...conds)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduMembers)
      .where(where)
      .orderBy(desc(eduMembers.id))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduMembers)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export interface CreateMemberInput {
  username: string
  password: string
  mobile?: string | null
  email?: string | null
  nickname?: string | null
  avatar?: string | null
  gender?: number
  levelId?: string | null
  companyId?: string | null
  departmentId?: string | null
  status?: number
}

/** 创建会员（密码自动 sha256 哈希）。 */
export async function createMember(data: CreateMemberInput): Promise<EduMember> {
  const rows = await db
    .insert(eduMembers)
    .values({
      username: data.username,
      password: hashPassword(data.password),
      mobile: data.mobile,
      email: data.email,
      nickname: data.nickname,
      avatar: data.avatar,
      gender: data.gender,
      levelId: data.levelId,
      companyId: data.companyId,
      departmentId: data.departmentId,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建会员失败')
  return row
}

export interface UpdateMemberInput {
  mobile?: string | null
  email?: string | null
  nickname?: string | null
  avatar?: string | null
  gender?: number
  levelId?: string | null
  companyId?: string | null
  departmentId?: string | null
  growthValue?: number
}

export async function updateMember(
  id: string,
  data: UpdateMemberInput,
): Promise<EduMember | undefined> {
  const set: Record<string, unknown> = {}
  if (data.mobile !== undefined) set.mobile = data.mobile
  if (data.email !== undefined) set.email = data.email
  if (data.nickname !== undefined) set.nickname = data.nickname
  if (data.avatar !== undefined) set.avatar = data.avatar
  if (data.gender !== undefined) set.gender = data.gender
  if (data.levelId !== undefined) set.levelId = data.levelId
  if (data.companyId !== undefined) set.companyId = data.companyId
  if (data.departmentId !== undefined) set.departmentId = data.departmentId
  if (data.growthValue !== undefined) set.growthValue = data.growthValue
  const rows = await db.update(eduMembers).set(set).where(eq(eduMembers.id, id)).returning()
  return rows[0]
}

/** 更新会员状态（封禁/解封/审核通过/拒绝复用）。 */
export async function setMemberStatus(id: string, status: number): Promise<EduMember | undefined> {
  const rows = await db.update(eduMembers).set({ status }).where(eq(eduMembers.id, id)).returning()
  return rows[0]
}

/** 重置密码（sha256 哈希）。 */
export async function resetMemberPassword(
  id: string,
  password: string,
): Promise<EduMember | undefined> {
  const rows = await db
    .update(eduMembers)
    .set({ password: hashPassword(password) })
    .where(eq(eduMembers.id, id))
    .returning()
  return rows[0]
}

export async function deleteMember(id: string): Promise<void> {
  await db.delete(eduMembers).where(eq(eduMembers.id, id))
}

// =============================================================================
// 注册
// =============================================================================

export interface RegisterMemberInput {
  username: string
  password: string
  nickname?: string | null
  mobile?: string | null
  email?: string | null
}

/** 用户名注册（检查重名）。返回会员或抛出冲突错误。 */
export async function registerMember(data: RegisterMemberInput): Promise<EduMember> {
  const existing = await findMemberByUsername(data.username)
  if (existing) throw new MemberConflictError('用户名已存在')
  const rows = await db
    .insert(eduMembers)
    .values({
      username: data.username,
      password: hashPassword(data.password),
      nickname: data.nickname ?? data.username,
      mobile: data.mobile,
      email: data.email,
      status: 1,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('注册会员失败')
  return row
}

export interface RegisterMobileInput {
  mobile: string
  password: string
  nickname?: string | null
}

/** 手机号注册（检查重名）。返回会员或抛出冲突错误。 */
export async function registerMemberByMobile(data: RegisterMobileInput): Promise<EduMember> {
  const existing = await findMemberByMobile(data.mobile)
  if (existing) throw new MemberConflictError('手机号已注册')
  const rows = await db
    .insert(eduMembers)
    .values({
      mobile: data.mobile,
      username: data.mobile,
      password: hashPassword(data.password),
      nickname: data.nickname ?? data.mobile,
      status: 1,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('注册会员失败')
  return row
}

/** 注册冲突错误（带 statusCode=409）。 */
export class MemberConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'MEMBER_EXISTS')
    this.name = 'MemberConflictError'
  }
}

// =============================================================================
// 会员企业列表
// =============================================================================

export interface MemberCompanyItem {
  companyId: string | null
  memberCount: number
  members: { id: string; nickname: string | null; mobile: string | null; email: string | null }[]
}

/** 会员企业列表（company_id 非空，按 nickname 模糊搜索）。 */
export async function findMemberCompanies(opts: {
  page: number
  pageSize: number
  name?: string
}): Promise<{ list: MemberCompanyItem[]; total: number; page: number; pageSize: number }> {
  const conds = [isNotNull(eduMembers.companyId)]
  if (opts.name) conds.push(ilike(eduMembers.nickname, `%${opts.name}%`))
  const where = and(...conds)

  const members = await db
    .select({
      id: eduMembers.id,
      nickname: eduMembers.nickname,
      mobile: eduMembers.mobile,
      email: eduMembers.email,
      companyId: eduMembers.companyId,
    })
    .from(eduMembers)
    .where(where)
    .orderBy(desc(eduMembers.id))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)

  // 按 company_id 聚合
  const companies = new Map<string, MemberCompanyItem>()
  for (const m of members) {
    const cid = m.companyId ?? ''
    if (!companies.has(cid)) {
      companies.set(cid, { companyId: m.companyId, memberCount: 0, members: [] })
    }
    const c = companies.get(cid)!
    c.memberCount += 1
    c.members.push({
      id: m.id,
      nickname: m.nickname,
      mobile: m.mobile,
      email: m.email,
    })
  }
  return {
    list: [...companies.values()],
    total: companies.size,
    page: opts.page,
    pageSize: opts.pageSize,
  }
}

// =============================================================================
// 会员等级
// =============================================================================

export async function findMemberLevels(): Promise<EduMemberLevel[]> {
  return db
    .select()
    .from(eduMemberLevels)
    .orderBy(asc(eduMemberLevels.sort), asc(eduMemberLevels.id))
}

export async function findMemberLevelById(id: string): Promise<EduMemberLevel | undefined> {
  const rows = await db.select().from(eduMemberLevels).where(eq(eduMemberLevels.id, id)).limit(1)
  return rows[0]
}

export interface CreateMemberLevelInput {
  name: string
  growthValue?: number
  discount?: string
  sort?: number
}

export async function createMemberLevel(data: CreateMemberLevelInput): Promise<EduMemberLevel> {
  const rows = await db
    .insert(eduMemberLevels)
    .values({
      name: data.name,
      growthValue: data.growthValue,
      discount: data.discount,
      sort: data.sort,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建会员等级失败')
  return row
}

export interface UpdateMemberLevelInput {
  name?: string
  growthValue?: number
  discount?: string
  sort?: number
}

export async function updateMemberLevel(
  id: string,
  data: UpdateMemberLevelInput,
): Promise<EduMemberLevel | undefined> {
  const set: Record<string, unknown> = {}
  if (data.name !== undefined) set.name = data.name
  if (data.growthValue !== undefined) set.growthValue = data.growthValue
  if (data.discount !== undefined) set.discount = data.discount
  if (data.sort !== undefined) set.sort = data.sort
  const rows = await db
    .update(eduMemberLevels)
    .set(set)
    .where(eq(eduMemberLevels.id, id))
    .returning()
  return rows[0]
}

export async function deleteMemberLevel(id: string): Promise<void> {
  await db.delete(eduMemberLevels).where(eq(eduMemberLevels.id, id))
}

// =============================================================================
// 统计
// =============================================================================

export interface MemberStatistics {
  total: number
  active: number
  pending: number
  sealed: number
}

/** 会员统计：总数/正常/待审核/封禁。 */
export async function getMemberStatistics(): Promise<MemberStatistics> {
  const [totalRows, activeRows, pendingRows, sealedRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(eduMembers),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduMembers)
      .where(eq(eduMembers.status, 1)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduMembers)
      .where(eq(eduMembers.status, 0)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduMembers)
      .where(eq(eduMembers.status, 2)),
  ])
  return {
    total: totalRows[0]?.count ?? 0,
    active: activeRows[0]?.count ?? 0,
    pending: pendingRows[0]?.count ?? 0,
    sealed: sealedRows[0]?.count ?? 0,
  }
}

// =============================================================================
// 企业管理
// =============================================================================

export interface FindCompaniesOpts {
  page: number
  pageSize: number
  name?: string
  status?: number
}

export async function findCompanies(
  opts: FindCompaniesOpts,
): Promise<{ list: EduCompany[]; total: number; page: number; pageSize: number }> {
  const conds = []
  if (opts.name) conds.push(ilike(eduCompanies.name, `%${opts.name}%`))
  if (opts.status !== undefined) conds.push(eq(eduCompanies.status, opts.status))
  const where = conds.length ? and(...conds) : undefined
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduCompanies)
      .where(where)
      .orderBy(asc(eduCompanies.sort), desc(eduCompanies.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduCompanies)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findCompanyById(id: string): Promise<EduCompany | undefined> {
  const rows = await db.select().from(eduCompanies).where(eq(eduCompanies.id, id)).limit(1)
  return rows[0]
}

export interface CreateCompanyInput {
  name: string
  contactName?: string | null
  contactPhone?: string | null
  address?: string | null
  remark?: string | null
  sort?: number
  status?: number
}

export async function createCompany(data: CreateCompanyInput): Promise<EduCompany> {
  const rows = await db
    .insert(eduCompanies)
    .values({
      name: data.name,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      address: data.address,
      remark: data.remark,
      sort: data.sort,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建企业失败')
  return row
}

export interface UpdateCompanyInput {
  name?: string
  contactName?: string | null
  contactPhone?: string | null
  address?: string | null
  remark?: string | null
  sort?: number
  status?: number
}

export async function updateCompany(
  id: string,
  data: UpdateCompanyInput,
): Promise<EduCompany | undefined> {
  const set: Record<string, unknown> = {}
  if (data.name !== undefined) set.name = data.name
  if (data.contactName !== undefined) set.contactName = data.contactName
  if (data.contactPhone !== undefined) set.contactPhone = data.contactPhone
  if (data.address !== undefined) set.address = data.address
  if (data.remark !== undefined) set.remark = data.remark
  if (data.sort !== undefined) set.sort = data.sort
  if (data.status !== undefined) set.status = data.status
  set.updatedAt = new Date()
  const rows = await db.update(eduCompanies).set(set).where(eq(eduCompanies.id, id)).returning()
  return rows[0]
}

export async function deleteCompany(id: string): Promise<void> {
  await db.delete(eduCompanies).where(eq(eduCompanies.id, id))
}

// =============================================================================
// 部门管理
// =============================================================================

export interface FindDepartmentsOpts {
  page: number
  pageSize: number
  companyId?: string
  name?: string
  status?: number
}

export async function findDepartments(
  opts: FindDepartmentsOpts,
): Promise<{ list: EduDepartment[]; total: number; page: number; pageSize: number }> {
  const conds = []
  if (opts.companyId) conds.push(eq(eduDepartments.companyId, opts.companyId))
  if (opts.name) conds.push(ilike(eduDepartments.name, `%${opts.name}%`))
  if (opts.status !== undefined) conds.push(eq(eduDepartments.status, opts.status))
  const where = conds.length ? and(...conds) : undefined
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(eduDepartments)
      .where(where)
      .orderBy(asc(eduDepartments.sort), desc(eduDepartments.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eduDepartments)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findDepartmentById(id: string): Promise<EduDepartment | undefined> {
  const rows = await db.select().from(eduDepartments).where(eq(eduDepartments.id, id)).limit(1)
  return rows[0]
}

export interface CreateDepartmentInput {
  companyId: string
  name: string
  pid?: string | null
  sort?: number
  status?: number
}

export async function createDepartment(data: CreateDepartmentInput): Promise<EduDepartment> {
  const rows = await db
    .insert(eduDepartments)
    .values({
      companyId: data.companyId,
      name: data.name,
      pid: data.pid,
      sort: data.sort,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建部门失败')
  return row
}

export interface UpdateDepartmentInput {
  companyId?: string
  name?: string
  pid?: string | null
  sort?: number
  status?: number
}

export async function updateDepartment(
  id: string,
  data: UpdateDepartmentInput,
): Promise<EduDepartment | undefined> {
  const set: Record<string, unknown> = {}
  if (data.companyId !== undefined) set.companyId = data.companyId
  if (data.name !== undefined) set.name = data.name
  if (data.pid !== undefined) set.pid = data.pid
  if (data.sort !== undefined) set.sort = data.sort
  if (data.status !== undefined) set.status = data.status
  const rows = await db.update(eduDepartments).set(set).where(eq(eduDepartments.id, id)).returning()
  return rows[0]
}

export async function deleteDepartment(id: string): Promise<void> {
  await db.delete(eduDepartments).where(eq(eduDepartments.id, id))
}

// =============================================================================
// 系统用户管理（users 表）
// =============================================================================

/** 按部门查询用户列表（关联 userProfiles.departmentId）。 */
export async function findUsersByDepartment(
  departmentId: string,
  opts: { page: number; pageSize: number },
): Promise<{ list: User[]; total: number; page: number; pageSize: number }> {
  const where = eq(userProfiles.departmentId, departmentId)
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: users.id,
        phone: users.phone,
        email: users.email,
        username: users.username,
        passwordHash: users.passwordHash,
        nickname: users.nickname,
        avatar: users.avatar,
        bio: users.bio,
        gender: users.gender,
        birthday: users.birthday,
        familyId: users.familyId,
        roleId: users.roleId,
        deptId: users.deptId,
        status: users.status,
        isVip: users.isVip,
        level: users.level,
        isSystemAdmin: users.isSystemAdmin,
        inviteCode: users.inviteCode,
        parentId: users.parentId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(where),
  ])
  return { list: rows, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

/** 按 ID 查询系统用户。 */
export async function findSystemUserById(id: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0]
}

export interface CreateSystemUserInput {
  phone?: string
  email?: string
  username?: string
  passwordHash?: string
  nickname?: string
  avatar?: string
  gender?: number
  roleId?: number
  status?: number
  isVip?: number
}

/** 创建系统用户。 */
export async function createSystemUser(data: CreateSystemUserInput): Promise<User> {
  const rows = await db
    .insert(users)
    .values({
      phone: data.phone,
      email: data.email,
      username: data.username,
      passwordHash: data.passwordHash,
      nickname: data.nickname,
      avatar: data.avatar,
      gender: data.gender,
      roleId: data.roleId ?? 0,
      status: data.status ?? 1,
      isVip: data.isVip ?? 0,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建用户失败')
  return row
}

export interface UpdateSystemUserInput {
  phone?: string | null
  email?: string | null
  username?: string | null
  nickname?: string | null
  avatar?: string | null
  bio?: string | null
  gender?: number
  roleId?: number
  status?: number
  isVip?: number
}

/** 更新系统用户。 */
export async function updateSystemUser(
  id: string,
  data: UpdateSystemUserInput,
): Promise<User | undefined> {
  const set: Record<string, unknown> = {}
  if (data.phone !== undefined) set.phone = data.phone
  if (data.email !== undefined) set.email = data.email
  if (data.username !== undefined) set.username = data.username
  if (data.nickname !== undefined) set.nickname = data.nickname
  if (data.avatar !== undefined) set.avatar = data.avatar
  if (data.bio !== undefined) set.bio = data.bio
  if (data.gender !== undefined) set.gender = data.gender
  if (data.roleId !== undefined) set.roleId = data.roleId
  if (data.status !== undefined) set.status = data.status
  if (data.isVip !== undefined) set.isVip = data.isVip
  set.updatedAt = new Date()
  const rows = await db.update(users).set(set).where(eq(users.id, id)).returning()
  return rows[0]
}

/** 重置系统用户密码。 */
export async function resetSystemUserPassword(
  id: string,
  passwordHash: string,
): Promise<User | undefined> {
  const rows = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning()
  return rows[0]
}

/** 删除系统用户（硬删除）。 */
export async function deleteSystemUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id))
}
