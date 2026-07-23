import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { eq } from 'drizzle-orm'
import { users } from '@ihui/database'

// users 补充路由(prefix=/users) — 重置密码
// 注:/api/admin/users 主 CRUD 由 admin.ts 提供,此处仅补 resetPwd
export const userRoutes: FastifyPluginAsync = async (s) => {
  // PUT /users/resetPwd - 管理员重置用户密码
  s.put('/resetPwd', async (request, reply) => {
    const parsed = z
      .object({
        userId: z.string().uuid(),
        password: z.string().min(6, '密码至少 6 位'),
      })
      .safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 10)
    const updated = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, parsed.data.userId))
      .returning({ id: users.id })
    if (updated.length === 0) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    return reply.send(success({ success: true }))
  })
}
