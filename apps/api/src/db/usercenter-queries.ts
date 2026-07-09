import { eq, and, desc, asc, sql, ilike, isNull } from 'drizzle-orm';
import { db } from './index.js';
import {
  users,
  departments,
  userProfiles,
  userCertificates,
  type User,
  type Department,
  type UserCertificate,
} from '@ihui/database';

// =============================================================================
// 用户列表与状态(操作 users 表)
// =============================================================================

export interface FindUsersOpts {
  page: number;
  pageSize: number;
  nickname?: string;
  phone?: string;
  status?: number;
}

export interface UserListItem extends User {
  departmentName: string | null;
}

/**
 * 用户列表(分页)，支持按 nickname/phone/status 筛选。
 */
export async function findUsers(
  opts: FindUsersOpts,
): Promise<{ list: UserListItem[]; total: number; page: number; pageSize: number }> {
  const conds = [];
  if (opts.nickname) conds.push(ilike(users.nickname, `%${opts.nickname}%`));
  if (opts.phone) conds.push(ilike(users.phone, `%${opts.phone}%`));
  if (opts.status !== undefined) conds.push(eq(users.status, opts.status));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      user: users,
      departmentName: departments.name,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(departments, eq(userProfiles.departmentId, departments.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);

  const list: UserListItem[] = rows.map((r) => ({
    ...r.user,
    departmentName: r.departmentName,
  }));

  const countRows = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(where);
  const total = countRows[0]?.count ?? 0;
  return { list, total, page: opts.page, pageSize: opts.pageSize };
}

/**
 * 删除用户。
 */
export async function deleteUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

/**
 * 更新用户密码 hash。
 */
export async function updateUserPassword(id: string, passwordHash: string): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, id));
}

/**
 * 更新用户状态。
 */
export async function updateUserStatus(id: string, status: number): Promise<void> {
  await db
    .update(users)
    .set({ status, updatedAt: new Date() })
    .where(eq(users.id, id));
}

// =============================================================================
// 部门 CRUD
// =============================================================================

export interface FindDepartmentsOpts {
  pid?: string | null;
  companyId?: number;
}

/**
 * 部门列表，按 sort 升序、createdAt 升序。
 */
export async function findDepartments(opts: FindDepartmentsOpts = {}): Promise<Department[]> {
  const conds = [];
  if (opts.pid !== undefined) {
    if (opts.pid === null) {
      conds.push(isNull(departments.pid));
    } else {
      conds.push(eq(departments.pid, opts.pid));
    }
  }
  if (opts.companyId !== undefined) conds.push(eq(departments.companyId, opts.companyId));
  const where = conds.length ? and(...conds) : undefined;
  return db
    .select()
    .from(departments)
    .where(where)
    .orderBy(asc(departments.sort), asc(departments.createdAt));
}

export async function findDepartmentById(id: string): Promise<Department | undefined> {
  const rows = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
  return rows[0];
}

export interface CreateDepartmentInput {
  name: string;
  pid?: string | null;
  companyId?: number;
  sort?: number;
}

export async function createDepartment(data: CreateDepartmentInput): Promise<Department> {
  const rows = await db
    .insert(departments)
    .values({
      name: data.name,
      pid: data.pid,
      companyId: data.companyId,
      sort: data.sort,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建部门失败');
  return row;
}

export interface UpdateDepartmentInput {
  name?: string;
  pid?: string | null;
  companyId?: number;
  sort?: number;
}

export async function updateDepartment(
  id: string,
  data: UpdateDepartmentInput,
): Promise<Department | undefined> {
  const rows = await db
    .update(departments)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.pid !== undefined ? { pid: data.pid } : {}),
      ...(data.companyId !== undefined ? { companyId: data.companyId } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
    })
    .where(eq(departments.id, id))
    .returning();
  return rows[0];
}

export async function deleteDepartment(id: string): Promise<void> {
  await db.delete(departments).where(eq(departments.id, id));
}

// =============================================================================
// 用户证书
// =============================================================================

export async function findUserCertificates(userId: string): Promise<UserCertificate[]> {
  return db
    .select()
    .from(userCertificates)
    .where(eq(userCertificates.userId, userId))
    .orderBy(desc(userCertificates.createdAt));
}

export interface CreateUserCertificateInput {
  userId: string;
  title: string;
  certificateNo?: string;
  issuedAt?: Date;
  expireAt?: Date;
  status?: number;
}

export async function createUserCertificate(
  data: CreateUserCertificateInput,
): Promise<UserCertificate> {
  const rows = await db
    .insert(userCertificates)
    .values({
      userId: data.userId,
      title: data.title,
      certificateNo: data.certificateNo,
      issuedAt: data.issuedAt,
      expireAt: data.expireAt,
      status: data.status,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建证书失败');
  return row;
}

export async function deleteUserCertificate(id: string): Promise<void> {
  await db.delete(userCertificates).where(eq(userCertificates.id, id));
}

// =============================================================================
// 用户统计
// =============================================================================

export interface UserStatistics {
  total: number;
  active: number;
  disabled: number;
  deptTotal: number;
}

/**
 * 用户统计：总数/启用/禁用/部门数。
 */
export async function getUserStatistics(): Promise<UserStatistics> {
  const [totalRows, activeRows, deptRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.status, 1)),
    db.select({ count: sql<number>`count(*)::int` }).from(departments),
  ]);
  const total = totalRows[0]?.count ?? 0;
  const active = activeRows[0]?.count ?? 0;
  return { total, active, disabled: total - active, deptTotal: deptRows[0]?.count ?? 0 };
}
