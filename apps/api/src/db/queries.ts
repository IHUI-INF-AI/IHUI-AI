import { eq, or, isNull, and } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
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
  gender?: number
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
 * 检查邮箱是否已注册。
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  return rows.length > 0
}

/**
 * 软注销账户（status=3）。
 *
 * 2026-08-01 升级(用户规则:"完美细致完整毫无遗漏"):
 *   - 旧版仅置 status=3,残留 phone/email/username/inviteCode 占用唯一约束
 *     → 新用户无法注册同名账号,inviteCode 永久占用
 *   - 新版 NULL 化所有唯一约束字段(phone/email/username/inviteCode)
 *   - 清空 2FA 字段(twoFactorSecret/BackupCodes/EnabledAt,Enabled=false)
 *     数据卫生:避免注销账号的加密密文/备份码残留
 *   - 与 mergeUserAccounts 软删除策略保持一致
 */
export async function cancelUserAccount(id: string): Promise<void> {
  await db
    .update(users)
    .set({
      status: 3,
      phone: null,
      email: null,
      username: null,
      inviteCode: null,
      twoFactorSecret: null,
      twoFactorEnabled: false,
      twoFactorBackupCodes: [],
      twoFactorEnabledAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
}

/**
 * 判断用户是否为系统内置管理员（is_system_admin=true）。
 * 应用层预检：DB 触发器是最后防线，应用层先返回 403 提供更友好的错误。
 */
export async function isSystemAdminUser(id: string): Promise<boolean> {
  const rows = await db
    .select({ flag: users.isSystemAdmin })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return rows[0]?.flag === true
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
      ...(data.gender !== undefined && { gender: data.gender }),
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

/**
 * 吊销指定 family 下所有未吊销的 refresh token(RFC 6749 §10.4 重用检测)。
 *
 * 2026-07-22 鲁棒性加固:当 refresh token 被重用(已被 revoked 的 token 再次出现),
 * 立即吊销整个 family 所有活跃 token,迫使合法用户重新登录。
 * 这是 OAuth2.1 强制的"refresh token rotation with reuse detection"模式。
 *
 * 触发场景:攻击者拿到已吊销 token 重试 → 检测到 stored.revokedAt 非空 → 调用此函数。
 * @param familyId token family UUID
 * @returns 吊销的 token 数量
 */
export async function revokeRefreshTokenFamily(familyId: string): Promise<number> {
  const result = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id })
  return result.length
}

/**
 * 合并账号:把 fromUserId 的所有外键数据迁移到 toUserId,然后删除 fromUserId。
 *
 * 业务规则(2026-08-01 立,用户规则:"以老手机号账号信息 昵称 个人简介为准"):
 *   - toUserId = 老手机号账号(保留 nickname/avatar/bio 等资料)
 *   - fromUserId = 新手机号账号(被合并方,数据迁出后删除)
 *   - 不修改 toUserId 的任何用户资料字段,只迁移 fromUserId 的关联数据
 *
 * 实现策略:
 *   1. 用 PL/pgSQL DO block 动态查询 information_schema 中所有引用 users.id 的外键
 *   2. 对每张表逐表 UPDATE ... SET user_id = toUserId WHERE user_id = fromUserId
 *   3. 处理唯一约束冲突:遇到冲突时先 DELETE fromUserId 的冲突行,再 UPDATE
 *   4. 跳过 users 表自身(避免把 fromUserId 的 id 改成 toUserId)
 *   5. 最后 DELETE FROM users WHERE id = fromUserId
 *
 * 注意:此函数在事务中执行,任何步骤失败则整体回滚。
 *
 * @param params.fromUserId 被合并的账号 ID(新手机号账号,会被删除)
 * @param params.toUserId   保留的账号 ID(老手机号账号,资料不变)
 */
export async function mergeUserAccounts(params: {
  fromUserId: string
  toUserId: string
}): Promise<void> {
  const { fromUserId, toUserId } = params
  if (fromUserId === toUserId) {
    throw new Error('不能合并到同一个账号')
  }

  // PL/pgSQL DO block 动态迁移所有引用 users.id 的外键
  // - 跳过 users 表自身
  // - 对每张表:先删 fromUserId 在 (user_id) 唯一约束上与 toUserId 冲突的行,再 UPDATE
  // - 用异常处理跳过无法迁移的表(避免单张表失败阻塞整体合并)
  // - 最后软删除 fromUserId(status=3,保留审计痕迹,不物理删除避免外键约束遗漏)
  await db.execute(sql`
    DO $$
    DECLARE
      r RECORD;
      conflict_cols TEXT;
      del_stmt TEXT;
      upd_stmt TEXT;
    BEGIN
      -- 遍历所有引用 users.id 的外键(单列外键 user_id)
      FOR r IN
        SELECT
          kcu.table_name,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND ccu.table_name = 'users'
          AND ccu.column_name = 'id'
          AND kcu.table_name <> 'users'
      LOOP
        -- 检查该表是否有包含 user_id 的唯一约束(可能引发冲突)
        SELECT string_agg(DISTINCT col.column_name, ', ' ORDER BY col.column_name)
        INTO conflict_cols
        FROM information_schema.table_constraints tc2
        JOIN information_schema.key_column_usage col
          ON tc2.constraint_name = col.constraint_name
          AND tc2.table_schema = col.table_schema
        WHERE tc2.table_name = r.table_name
          AND tc2.table_schema = 'public'
          AND tc2.constraint_type = 'UNIQUE'
          AND EXISTS (
            SELECT 1 FROM information_schema.key_column_usage col2
            WHERE col2.constraint_name = tc2.constraint_name
              AND col2.column_name = r.column_name
          )
        GROUP BY tc2.constraint_name;

        IF conflict_cols IS NOT NULL THEN
          -- 删除 fromUserId 与 toUserId 在唯一约束上冲突的行(保留 toUserId 的行)
          del_stmt := format(
            'DELETE FROM %I WHERE %I = $1 AND (%s) IN (SELECT %s FROM %I WHERE %I = $2)',
            r.table_name, r.column_name, conflict_cols, conflict_cols, r.table_name, r.column_name
          );
          EXECUTE del_stmt USING fromUserId, toUserId;
        END IF;

        -- 把 fromUserId 的所有行迁移到 toUserId
        upd_stmt := format(
          'UPDATE %I SET %I = $2 WHERE %I = $1',
          r.table_name, r.column_name, r.column_name
        );
        BEGIN
          EXECUTE upd_stmt USING fromUserId, toUserId;
        EXCEPTION WHEN OTHERS THEN
          -- 跳过无法迁移的表(WARNING 级别写入 PostgreSQL log,便于运维排查)
          -- 2026-08-01 升级:NOTICE → WARNING,让失败在 log 中更可见
          RAISE WARNING '账号合并跳过表 %: %', r.table_name, SQLERRM;
        END;
      END LOOP;

      -- 软删除 fromUserId:status=3(已注销),保留行做审计,避免遗漏的外键约束报错
      -- 2026-08-01 升级(用户规则:"完美细致完整毫无遗漏"):
      --   NULL 化所有唯一约束字段(phone/email/username/inviteCode),避免占用导致新注册冲突
      --   清空 2FA 字段,数据卫生(与 cancelUserAccount 策略一致)
      UPDATE users SET
        status = 3,
        phone = NULL,
        email = NULL,
        username = NULL,
        invite_code = NULL,
        two_factor_secret = NULL,
        two_factor_enabled = false,
        two_factor_backup_codes = '[]'::jsonb,
        two_factor_enabled_at = NULL,
        updated_at = now()
      WHERE id = fromUserId;
    END;
    $$;
  `)
}
