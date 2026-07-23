/**
 * 学生档案(从 frontend-stub-other-routes.ts 拆分)。
 * GET / PUT /students/:id/profile
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { userProfiles } from '@ihui/database'
import { parseIdParam } from './_shared.js'

const studentProfileBodySchema = z.object({
  departmentId: z.string().uuid().optional(),
  companyId: z.number().int().optional(),
  employeeNo: z.string().max(64).optional(),
  position: z.string().max(100).optional(),
})

export const studentProfileRoutes: FastifyPluginAsync = async (server) => {
  // GET /students/:id/profile — 学生档案
  server.get('/students/:id/profile', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    // 仅允许查询自己的档案,或管理员查询任意
    if (id !== request.userId) {
      const roleId = request.jwtPayload?.roleId ?? 0
      if (roleId < 1) return reply.status(403).send(error(403, '无权查看他人档案'))
    }
    const [profile] = await dbRead
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, id))
      .limit(1)
    return reply.send(success({ profile: profile ?? null }))
  })

  // PUT /students/:id/profile — 更新学生档案
  server.put('/students/:id/profile', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    if (id !== request.userId) return reply.status(403).send(error(403, '无权修改他人档案'))
    const body = studentProfileBodySchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, id))
      .limit(1)
    let profile
    if (existing) {
      const [updated] = await db
        .update(userProfiles)
        .set({ ...body.data, updatedAt: new Date() })
        .where(eq(userProfiles.userId, id))
        .returning()
      profile = updated
    } else {
      const [created] = await db
        .insert(userProfiles)
        .values({ userId: id, ...body.data })
        .returning()
      profile = created
    }
    return reply.send(success({ profile }))
  })
}
