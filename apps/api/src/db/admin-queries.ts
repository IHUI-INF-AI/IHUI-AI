import { eq, sql, and, or, ilike, isNull, gt, desc } from 'drizzle-orm';
import { db } from './index.js';
import { users, projects, refreshTokens } from '@ihui/database';

// 公开字段：精确选字段，排除 password_hash
const userPublicFields = {
  id: users.id,
  phone: users.phone,
  email: users.email,
  nickname: users.nickname,
  avatar: users.avatar,
  roleId: users.roleId,
  status: users.status,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export type AdminUser = {
  id: string;
  phone: string | null;
  email: string | null;
  nickname: string | null;
  avatar: string | null;
  roleId: number | null;
  status: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

/**
 * 统计用户总数。
 */
export async function countUsers(): Promise<number> {
  const rows = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
  return Number(rows[0]?.count ?? 0);
}

/**
 * 统计项目总数。
 */
export async function countProjects(): Promise<number> {
  const rows = await db.select({ count: sql<number>`COUNT(*)` }).from(projects);
  return Number(rows[0]?.count ?? 0);
}

/**
 * 统计有效会话数：未吊销且未过期的 refresh token。
 */
export async function countActiveSessions(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(refreshTokens)
    .where(and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())));
  return Number(rows[0]?.count ?? 0);
}

/**
 * 分页查询用户，支持 search（phone/email/nickname 模糊匹配）/role/status 筛选。
 */
export async function findUsers(
  page: number,
  pageSize: number,
  search?: string,
  role?: number,
  status?: number,
): Promise<{ list: AdminUser[]; total: number }> {
  const conds = [];
  if (search) {
    const like = `%${search}%`;
    conds.push(or(ilike(users.phone, like), ilike(users.email, like), ilike(users.nickname, like)));
  }
  if (role !== undefined) conds.push(eq(users.roleId, role));
  if (status !== undefined) conds.push(eq(users.status, status));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select(userPublicFields)
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(users).where(where),
  ]);

  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

/**
 * 按 ID 查询用户（不含 password_hash）。
 */
export async function findUserById(id: string): Promise<AdminUser | undefined> {
  const rows = await db.select(userPublicFields).from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

/**
 * 更新用户角色。
 */
export async function updateUserRole(id: string, role: number): Promise<AdminUser | undefined> {
  const rows = await db
    .update(users)
    .set({ roleId: role, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning(userPublicFields);
  return rows[0];
}

/**
 * 更新用户状态。
 */
export async function updateUserStatus(id: string, status: number): Promise<AdminUser | undefined> {
  const rows = await db
    .update(users)
    .set({ status, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning(userPublicFields);
  return rows[0];
}

/**
 * 分页查询所有项目（含 owner 信息），按最近更新倒序。
 */
export async function findProjectsWithOwner(
  page: number,
  pageSize: number,
): Promise<{ list: AdminProjectRow[]; total: number }> {
  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        userId: projects.userId,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        ownerNickname: users.nickname,
        ownerAvatar: users.avatar,
        ownerPhone: users.phone,
        ownerEmail: users.email,
      })
      .from(projects)
      .leftJoin(users, eq(projects.userId, users.id))
      .orderBy(desc(projects.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(projects),
  ]);

  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

export type AdminProjectRow = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: number;
  createdAt: Date;
  updatedAt: Date;
  ownerNickname: string | null;
  ownerAvatar: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
};

/** 按 id 查询项目(管理员视角,含 owner 信息)。 */
export async function findProjectByIdWithOwner(
  id: string,
): Promise<AdminProjectRow | undefined> {
  const rows = await db
    .select({
      id: projects.id,
      userId: projects.userId,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      ownerNickname: users.nickname,
      ownerAvatar: users.avatar,
      ownerPhone: users.phone,
      ownerEmail: users.email,
    })
    .from(projects)
    .leftJoin(users, eq(projects.userId, users.id))
    .where(eq(projects.id, id))
    .limit(1);
  return rows[0];
}

/** 管理员创建项目(需指定 userId)。 */
export async function createProjectAdmin(input: {
  userId: string;
  name: string;
  description?: string | null;
  status?: number;
}): Promise<AdminProjectRow> {
  const rows = await db
    .insert(projects)
    .values({
      userId: input.userId,
      name: input.name,
      description: input.description,
      status: input.status,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建项目失败');
  // 复用查询以附带 owner 信息
  const withOwner = await findProjectByIdWithOwner(row.id);
  return withOwner ?? { ...row, ownerNickname: null, ownerAvatar: null, ownerPhone: null, ownerEmail: null };
}

/** 管理员更新项目(可改 name/description/status)。 */
export async function updateProjectAdmin(
  id: string,
  patch: { name?: string; description?: string | null; status?: number },
): Promise<AdminProjectRow | undefined> {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.status !== undefined) set.status = patch.status;
  if (Object.keys(set).length === 0) {
    return findProjectByIdWithOwner(id);
  }
  set.updatedAt = new Date();
  await db.update(projects).set(set).where(eq(projects.id, id));
  return findProjectByIdWithOwner(id);
}

/** 管理员删除项目(级联删除项目下文件,由外键保证)。返回是否删除成功。 */
export async function deleteProjectAdmin(id: string): Promise<boolean> {
  const rows = await db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
  return rows.length > 0;
}
