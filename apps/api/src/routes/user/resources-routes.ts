/**
 * Resource/Certificate 模块(3 个端点:/resources/:id/like + /certificates/issue + /certificates/:id/revoke)。
 * 注:/resources/:id/download 已在 resource.ts 真实化。
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { success, error } from '../../utils/response.js'
import { toggleLike } from '../../db/resource-likes-queries.js'
import { createCertificate, updateCertificateStatus } from '../../db/certificate-queries.js'
import { parseIdParam } from './_shared.js'

const resourcesRoutes: FastifyPluginAsync = async (server) => {
  server.post('/resources/:id/like', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const result = await toggleLike('resource', id, request.userId!)
    return reply.send(success({ success: true, liked: result.liked }))
  })

  server.post('/certificates/issue', async (request, reply) => {
    const body =
      (request.body as {
        userId?: string
        templateId?: string
        title?: string
        recipientName?: string
        source?: string
        sourceId?: string
      } | null) ?? {}
    if (!body.userId || !body.templateId || !body.title) {
      return reply.status(400).send(error(400, '缺少 userId/templateId/title'))
    }
    const cert = await createCertificate({
      userId: body.userId,
      templateId: body.templateId,
      certificateNo: 'CERT' + Date.now() + randomUUID().slice(0, 6).toUpperCase(),
      title: body.title,
      recipientName: body.recipientName,
      source: body.source,
      sourceId: body.sourceId,
    })
    return reply
      .status(201)
      .send(success({ success: true, certificateId: cert.id, certificate: cert }))
  })

  server.post('/certificates/:id/revoke', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const cert = await updateCertificateStatus(id, 0)
    if (!cert) return reply.status(404).send(error(404, '证书不存在'))
    return reply.send(success({ success: true, certificate: cert }))
  })
}

export default resourcesRoutes
