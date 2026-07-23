/**
 * 开发者扩展 /developer/*(4 个端点)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import {
  findDeveloperInfo,
  findDeveloperPricing,
  createDeveloperApplication,
  updateDeveloperApplicationStatus,
} from '../../db/developer-queries.js'
import { parseIdParam } from './_shared.js'

const developerRoutes: FastifyPluginAsync = async (server) => {
  server.get('/developer/info', async (request, reply) => {
    const developer = await findDeveloperInfo(request.userId!)
    return reply.send(success({ developer }))
  })

  server.get('/developer/price', async (_request, reply) => {
    const list = await findDeveloperPricing()
    return reply.send(success({ list }))
  })

  server.post('/developer/apply', async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1).max(100),
        description: z.string().max(2000).optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const application = await createDeveloperApplication({
      userId: request.userId!,
      name: body.data.name,
      description: body.data.description,
    })
    return reply.status(201).send(success({ success: true, application }))
  })

  server.post('/developer/:id/audit', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < 1) return reply.status(403).send(error(403, '需要管理员权限'))
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        status: z.enum(['approved', 'rejected']),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const statusNum = body.data.status === 'approved' ? 1 : 2
    const application = await updateDeveloperApplicationStatus(id, statusNum)
    if (!application) return reply.status(404).send(error(404, '申请不存在'))
    return reply.send(success({ success: true, application }))
  })
}

export default developerRoutes
