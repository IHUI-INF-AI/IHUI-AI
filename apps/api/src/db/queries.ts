import { eq, or, isNull, and } from 'drizzle-orm'
import { db } from './index.js'
import { users, refreshTokens, type User, type RefreshToken } from '@ihui/database'

export interface CreateUserInput {
  phone?: string
  email?: string
  passwordHash?: string
  nickname?: string
  avatar?: string
  familyId?: string
  roleId?: number
  status?: number
}

export interface UpdateUserInput {
  nickname?: string
  avatar?: string
  email?: string
  bio?: string
  phone?: string
  passwordHash?: string
}

/**
 * 按手机号查询用户。
 */
export async function findUserByPhone(phone: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.phone, phone)).limit(1)
  return rows[0]
}

/**
 * 按 ID 查询用户。
 */
export async function findUserById(id: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0]
}

/**
 * 按账号查询用户（username / phone / email 三选一）。
 */
export async function findUserByAccount(account: string): Promise<User | undefined> {
  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.username, account), eq(users.phone, account), eq(users.email, account)))
    .limit(1)
  return rows[0]
}

/**
 * 按邮箱查询用户。
 */
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return rows[0]
}

/**
 * 按用户名查询用户（用户名密码登录）。
 */
export async function findUserByUsername(username: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1)
  return rows[0]
}

/**
 * 检查手机号是否已注册。
 */
export async function checkPhoneExists(phone: string): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1)
  return rows.length > 0
}

/**
 * 软注销账户（status=3）。
 */
export async function cancelUserAccount(id: string): Promise<void> {
  await db.update(users).set({ status: 3, updatedAt: new Date() }).where(eq(users.id, id))
}

/**
 * 创建新用户。
 */
export async function createUser(data: CreateUserInput): Promise<User> {
  const rows = await db
    .insert(users)
    .values({
      phone: data.phone,
      email: data.email,
      passwordHash: data.passwordHash,
      nickname: data.nickname,
      avatar: data.avatar,
      familyId: data.familyId,
      roleId: data.roleId ?? 0,
      status: data.status ?? 1,
    })
    .returning()
  const row = rows[0]
  if (!row) {
    throw new Error('创建用户失败')
  }
  return row
}

/**
 * 更新用户信息。
 */
export async function updateUser(id: string, data: UpdateUserInput): Promise<User> {
  const rows = await db
    .update(users)
    .set({
      ...(data.nickname !== undefined && { nickname: data.nickname }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.passwordHash !== undefined && { passwordHash: data.passwordHash }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning()
  const row = rows[0]
  if (!row) {
    throw new Error('更新用户失败')
  }
  return row
}

/**
 * 保存 refresh token 记录。
 */
export async function saveRefreshToken(
  token: string,
  userId: string,
  familyId: string,
  expiresAt: Date,
): Promise<RefreshToken> {
  const rows = await db
    .insert(refreshTokens)
    .values({
      token,
      userId,
      familyId,
      expiresAt,
    })
    .returning()
  const row = rows[0]
  if (!row) {
    throw new Error('保存 refresh token 失败')
  }
  return row
}

/**
 * 按 token 字符串查询 refresh token 记录。
 */
export async function findRefreshToken(token: string): Promise<RefreshToken | undefined> {
  const rows = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token)).limit(1)
  return rows[0]
}

/**
 * 吊销 refresh token（设置 revokedAt）。
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.token, token))
}

/**
 * 吊销某用户所有未过期的 refresh token（用于 SSO 统一登出/踢下线）。
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
}
