import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'
import { createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs'
import { join, extname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import { authenticate } from '../plugins/auth.js'
import { findUserById, findUserByPhone, isSystemAdminUser, updateUser } from '../db/queries.js'
import { countFollowing, countFollowers, countFavorites } from '../db/social-queries.js'
import { updateUserPassword } from '../db/usercenter-queries.js'
import { success, error } from '../utils/response.js'
import { verifyCode } from '../utils/code-store.js'
import { db } from '../db/index.js'

const ADMIN_ROLE_ID = 1

const updateSchema = z.object({
  nickname: z.string().min(1).max(64).optional(),
  avatar: z.string().max(512).optional(),
  email: z.string().email('邮箱格式不正确').optional(),
  bio: z.string().max(500).optional(),
  gender: z.number().int().min(0).max(2).optional().describe('0=未知 1=男 2=女'),
})

function publicUser(user: {
  id: string
  phone: string | null
  email: string | null
  nickname: string | null
  avatar: string | null
  bio: string | null
  gender: number | null
  roleId: number | null
  status: number | null
  createdAt: Date | null
  updatedAt: Date | null
}) {
  return {
    id: user.id,
    phone: user.phone ?? '',
    email: user.email ?? '',
    nickname: user.nickname ?? '',
    avatar: user.avatar ?? '',
    bio: user.bio ?? '',
    gender: user.gender ?? 0,
    roleId: user.roleId ?? 0,
    status: user.status ?? 1,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

/**
 * 精简公开字段:供非本人用户查询时返回(不含 phone/email)。
 */
function limitedPublicUser(user: {
  id: string
  nickname: string | null
  avatar: string | null
  bio: string | null
  roleId: number | null
  status: number | null
  createdAt: Date | null
  updatedAt: Date | null
}) {
  return {
    id: user.id,
    nickname: user.nickname ?? '',
    avatar: user.avatar ?? '',
    bio: user.bio ?? '',
    roleId: user.roleId ?? 0,
    status: user.status ?? 1,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export const usersRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/users/me - 获取当前登录用户信息(必须在 /:id 之前注册以优先匹配)
  server.get('/me', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }

    const currentUserId = request.userId!
    const user = await findUserById(currentUserId)
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    return reply.send(success(publicUser(user)))
  })

  // GET /api/users/:id - 获取用户信息(需认证;本人/管理员返回完整字段,其他登录用户返回精简公开字段)
  server.get('/:id', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }

    const { id } = z.object({ id: z.string() }).parse(request.params)
    const currentUserId = request.userId!
    const roleId = request.jwtPayload?.roleId ?? 0
    const isSelfOrAdmin = id === currentUserId || roleId >= ADMIN_ROLE_ID

    const user = await findUserById(id)
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }

    const [followingCount, followersCount, favoritesCount] = await Promise.all([
      countFollowing(id),
      countFollowers(id),
      countFavorites(id),
    ])

    // 非本人且非管理员:返回精简公开字段(不含 phone/email)
    const userPayload = isSelfOrAdmin ? publicUser(user) : limitedPublicUser(user)

    return reply.send(
      success({
        user: userPayload,
        stats: { followingCount, followersCount, favoritesCount },
      }),
    )
  })

  // PATCH /api/users/:id - 更新用户信息（nickname、avatar、email、bio）
  server.patch('/:id', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }

    const { id } = z.object({ id: z.string() }).parse(request.params)
    const currentUserId = request.userId!
    const roleId = request.jwtPayload?.roleId ?? 0

    // 仅本人或管理员可更新
    if (id !== currentUserId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '无权修改该用户信息'))
    }

    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const existing = await findUserById(id)
    if (!existing) {
      return reply.status(404).send(error(404, '用户不存在'))
    }

    if (await isSystemAdminUser(id)) {
      return reply.status(403).send(error(403, '系统内置管理员资料不可修改'))
    }

    const updated = await updateUser(id, parsed.data)
    return reply.send(success({ user: publicUser(updated) }))
  })

  // POST /api/users/:id/password - 用户自助修改密码（仅本人,校验原密码）
  const passwordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6, '新密码至少6位').max(128),
  })
  server.post('/:id/password', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }

    const { id } = z.object({ id: z.string() }).parse(request.params)
    const currentUserId = request.userId!

    // 仅本人可修改自己的密码
    if (id !== currentUserId) {
      return reply.status(403).send(error(403, '无权修改他人密码'))
    }

    const parsed = passwordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const user = await findUserById(id)
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }

    if (await isSystemAdminUser(id)) {
      return reply.status(403).send(error(403, '系统内置管理员密码不可修改'))
    }

    const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash ?? '')
    if (!ok) {
      return reply.status(401).send(error(401, '原密码错误'))
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10)
    await updateUserPassword(id, passwordHash)
    return reply.send(success({ id: user.id }))
  })

  // POST /api/users/:id/avatar - 上传头像（multipart,仅本人,限图片 ≤2MB）
  const AVATAR_DIR = join(process.cwd(), 'uploads', 'avatars')
  const AVATAR_MAX_SIZE = 2 * 1024 * 1024
  const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const AVATAR_EXT_MAP: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  }

  server.post('/:id/avatar', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }

    const { id } = z.object({ id: z.string() }).parse(request.params)
    const currentUserId = request.userId!

    if (id !== currentUserId) {
      return reply.status(403).send(error(403, '无权修改他人头像'))
    }

    if (await isSystemAdminUser(id)) {
      return reply.status(403).send(error(403, '系统内置管理员头像不可修改'))
    }

    const data = await request.file()
    if (!data) {
      return reply.status(400).send(error(400, '未检测到上传文件'))
    }

    const mimeType = data.mimetype ?? ''
    if (!AVATAR_ALLOWED_TYPES.includes(mimeType)) {
      return reply.status(400).send(error(400, '仅支持 JPG/PNG/WebP/GIF 格式'))
    }

    if (!existsSync(AVATAR_DIR)) mkdirSync(AVATAR_DIR, { recursive: true })

    const fileId = randomUUID()
    const ext = AVATAR_EXT_MAP[mimeType] ?? extname(data.filename) ?? '.jpg'
    const tmpPath = join(AVATAR_DIR, `${fileId}.tmp`)
    const finalPath = join(AVATAR_DIR, `${fileId}${ext}`)

    let totalSize = 0
    try {
      data.file.on('data', (chunk: Buffer) => {
        totalSize += chunk.length
      })
      await pipeline(data.file, createWriteStream(tmpPath))
      if (totalSize > AVATAR_MAX_SIZE) {
        if (existsSync(tmpPath)) unlinkSync(tmpPath)
        return reply.status(400).send(error(400, '头像大小不能超过 2MB'))
      }
      renameSync(tmpPath, finalPath)
    } catch (err) {
      try {
        if (existsSync(tmpPath)) unlinkSync(tmpPath)
      } catch (e) {
        request.log.warn({ err: e }, '头像临时文件清理失败')
        // ignore
      }
      request.log.error({ err }, '头像上传失败')
      return reply.status(500).send(error(500, '头像上传失败'))
    }

    const avatarUrl = `/uploads/avatars/${fileId}${ext}`
    const updated = await updateUser(id, { avatar: avatarUrl })
    return reply.send(success({ user: publicUser(updated) }))
  })

  // POST /api/users/change-phone - 更换手机号(需验证码验证)
  const changePhoneSchema = z.object({
    newPhone: z
      .string()
      .length(11, '手机号必须为 11 位')
      .regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
    code: z.string().length(6, '验证码必须为 6 位'),
  })
  server.post('/change-phone', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }

    const userId = request.jwtPayload!.userId

    if (await isSystemAdminUser(userId)) {
      return reply.status(403).send(error(403, '系统内置管理员手机号不可修改'))
    }

    const parsed = changePhoneSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { newPhone, code } = parsed.data

    // 校验验证码
    if (!verifyCode(newPhone, code)) {
      return reply.status(400).send(error(400, '验证码无效或已过期'))
    }

    // 检查新手机号是否已被其他用户绑定
    const existing = await findUserByPhone(newPhone)
    if (existing && existing.id !== userId) {
      return reply.status(409).send(error(409, '该手机号已被其他账号绑定'))
    }

    // 更新手机号
    const updated = await updateUser(userId, { phone: newPhone })
    return reply.send(success({ user: publicUser(updated) }))
  })

  // GET /api/users/:id/devices — 登录设备列表（从 api_logs 聚合最近登录设备）
  server.get('/:id/devices', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }

    const { id } = z.object({ id: z.string() }).parse(request.params)
    const currentUserId = request.userId!
    const roleId = request.jwtPayload?.roleId ?? 0

    if (id !== currentUserId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '无权查看他人设备'))
    }

    try {
      const rows = await db.execute(
        sql`SELECT "ip", "user_agent", max("created_at") AS "last_login_at"
            FROM "api_logs"
            WHERE "user_id" = ${id} AND ("path" LIKE '%/auth/login%' OR "path" LIKE '%/auth/send-code%')
            GROUP BY "ip", "user_agent"
            ORDER BY max("created_at") DESC
            LIMIT 20`,
      )
      const devices = (rows as Record<string, unknown>[]).map((r) => ({
        id: `${r.ip ?? 'unknown'}-${r.user_agent ?? 'unknown'}`,
        ip: r.ip ?? '',
        userAgent: r.user_agent ?? '',
        lastLoginAt: r.last_login_at,
      }))
      return reply.send(success({ devices }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询登录设备失败'))
    }
  })
}
