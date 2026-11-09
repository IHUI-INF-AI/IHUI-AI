// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/member/users 路由(从 admin-missing-routes.ts 拆分)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { users } from '@ihui/database'
import { eq, notInArray, ilike, desc, sql, and, or } from 'drizzle-orm'
import { paginationSchema, idParamSchema } from './_shared.js'
import { hashPassword } from '../../utils/password-crypto.js'
import { isSystemAdminUser, revokeAllUserRefreshTokens } from '../../db/queries.js'

import { requireAdmin } from '../../plugins/require-permission.js'
import { isUuidString } from '../../utils/uuid.js'

/**
 * 写操作响应的显式投影(与 GET 列表字段对齐)。
 *
 * F-131(2026-11-08):`.returning()` 不带投影会把 users 整行(含 passwordHash)回给前端。
 * 白名单只放行可公开列,**绝不含 passwordHash/密码类列**。
 */
const memberUserResponseColumns = {
  id: users.id,
  username: users.username,
  nickname: users.nickname,
  phone: users.phone,
  email: users.email,
  roleId: users.roleId,
  status: users.status,
  level: users.level,
  isVip: users.isVip,
  isSystemAdmin: users.isSystemAdmin,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
}

const memberUsersRoutes: FastifyPluginAsync = async (server) => {
  // admin 会员列表/详情含 phone/email,需跳过响应脱敏
  // 防止 response-sanitizer 把敏感字段误伤为 '***'
  //
  // F-131(2026-11-08):已复核本插件全部响应出口 —— 写面改用 memberUserResponseColumns(不含
  // passwordHash 等密码类列),GET 列表/详情本就显式投影、不选 password_hash。但 GET 面**有意**
  // 回传管理员所需的原样 phone/email;一旦移除本标志,response-sanitizer 会把 phone 打码成
  // 191****xxxx、email 打码成 x***@域名,与既有响应值不一致且管理页不可用。故保留豁免,
  // 仅以投影保证密码类列不出仓。
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  server.addHook('preHandler', requireAdmin)
  server.get('/member/users', async (request, reply) => {
    const q = paginationSchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, search } = q.data
    const status = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((request.query as { status?: string }).status)
    if (!status.success) return reply.status(400).send(error(400, 'status 参数错误'))
    const level = z.coerce
      .number()
      .int()
      .min(0)
      .max(3)
      .optional()
      .safeParse((request.query as { level?: string }).level)
    if (!level.success) return reply.status(400).send(error(400, 'level 参数需为 0-3 的整数'))
    const includeDeleted = (request.query as { includeDeleted?: string }).includeDeleted === 'true'
    const conds = []
    if (search)
      conds.push(
        or(
          ilike(users.username, `%${search}%`),
          ilike(users.nickname, `%${search}%`),
          ilike(users.phone, `%${search}%`),
          ilike(users.email, `%${search}%`),
        ),
      )
    if (status.success && status.data !== undefined) {
      conds.push(eq(users.status, status.data))
    } else if (!includeDeleted) {
      conds.push(notInArray(users.status, [3]))
    }
    if (level.success && level.data !== undefined) {
      conds.push(eq(users.level, level.data))
    }
    const where = conds.length > 0 ? and(...conds) : undefined
    const list = await db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        phone: users.phone,
        email: users.email,
        roleId: users.roleId,
        status: users.status,
        level: users.level,
        isVip: users.isVip,
        isSystemAdmin: users.isSystemAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(users)
          .where(where)
      )[0]?.c ?? 0
    return reply.send(success({ list, total, page, pageSize }))
  })
  // GET /member/users/:id — 单用户详情(脱敏,不含 password_hash)
  server.get('/member/users/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    if (!isUuidString(p.data.id)) return reply.status(404).send(error(404, '用户不存在'))
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        phone: users.phone,
        email: users.email,
        avatar: users.avatar,
        bio: users.bio,
        gender: users.gender,
        roleId: users.roleId,
        status: users.status,
        level: users.level,
        isVip: users.isVip,
        isSystemAdmin: users.isSystemAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, p.data.id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(success(row))
  })
  server.patch('/member/users/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    if (!isUuidString(p.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    if (await isSystemAdminUser(p.data.id)) {
      return reply.status(403).send(error(403, '系统内置管理员不可修改'))
    }
    const b = z
      .object({
        // F-131:status 收敛为 0=待审/1=正常/2=封禁/3=注销 的枚举(Zod 4 的 z.enum 只接受字符串,
        // 数字枚举用字面量联合,拒绝 4/负数/字符串)。
        status: z.literal([0, 1, 2, 3]).optional(),
        level: z.number().int().min(0).max(3).optional(),
      })
      .safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    if (b.data.status === undefined && b.data.level === undefined) {
      return reply.status(400).send(error(400, 'status 与 level 至少需提供一个'))
    }
    const sets: Record<string, unknown> = { updatedAt: new Date() }
    if (b.data.status !== undefined) sets.status = b.data.status
    if (b.data.level !== undefined) sets.level = b.data.level
    const [row] = await db
      .update(users)
      .set(sets)
      .where(eq(users.id, p.data.id))
      .returning(memberUserResponseColumns)
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    // F-127(2026-11-08):与单条 PUT /admin/users/:id 对齐 —— 改成非启用态必须吊销该用户
    // 全部 refresh token,否则已发出的 refresh 仍能换新 access token。status=1 不吊销。
    if (b.data.status !== undefined && b.data.status !== 1) {
      await revokeAllUserRefreshTokens(p.data.id)
    }
    return reply.send(success(row))
  })
  server.post('/member/users', async (request, reply) => {
    const b = z
      .object({
        nickname: z.string().min(1),
        phone: z.string().optional(),
        email: z.email().optional(),
        password: z.string().min(6, '密码至少 6 位'),
        roleId: z.number().int().optional(),
        status: z.literal([0, 1, 2, 3]).optional(),
        level: z.number().int().min(0).max(3).optional(),
      })
      .safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    if (!b.data.phone && !b.data.email)
      return reply.status(400).send(error(400, 'phone 与 email 至少需提供一个'))
    const [row] = await db
      .insert(users)
      .values({
        nickname: b.data.nickname,
        phone: b.data.phone,
        email: b.data.email,
        passwordHash: await hashPassword(b.data.password),
        roleId: b.data.roleId ?? 0,
        status: b.data.status ?? 1,
        level: b.data.level ?? 0,
      })
      .returning(memberUserResponseColumns)
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(row))
  })
  server.delete('/member/users/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(p.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    if (await isSystemAdminUser(p.data.id)) {
      return reply.status(403).send(error(403, '系统内置管理员不可删除'))
    }
    const [row] = await db
      .update(users)
      .set({ status: 3, updatedAt: new Date() })
      .where(eq(users.id, p.data.id))
      .returning(memberUserResponseColumns)
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    // F-127(2026-11-08):软删除即置注销(3),与封禁同属非启用态,必须同步吊销 refresh token。
    await revokeAllUserRefreshTokens(p.data.id)
    return reply.send(success({ user: row }))
  })
}

export default memberUsersRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
