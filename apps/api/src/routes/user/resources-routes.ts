// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Resource/Certificate 模块(3 个端点:/resources/:id/like + /certificates/issue + /certificates/:id/revoke)。
 * 注:/resources/:id/download 已在 resource.ts 真实化。
 */
import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { toggleLike } from '../../db/resource-likes-queries.js'
import { createCertificate, updateCertificateStatus } from '../../db/certificate-queries.js'
import { parseIdParam } from './_shared.js'

const resourcesRoutes: FastifyPluginAsync = async (server) => {
  server.post('/resources/:id/like', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    // 2026-10-27:userId 缺失时原写法 `request.userId!` 会把 undefined 送进 toggleLike
    // (barrel 钩子已保证登录,这里是纵深防御 + 干净 401,而不是 500)
    if (!request.userId) return reply.status(401).send(error(401, '未登录'))
    const result = await toggleLike('resource', id, request.userId)
    return reply.send(success({ success: true, liked: result.liked }))
  })

  // 2026-10-27 安全加固(P0):原实现「登录即可」签发/吊销证书,且 userId 取自 body ⇒
  // 任何注册用户可给任意 userId 签发证书(伪造资质凭证)、吊销任意人的证书。
  // 证书是平台对外可验证的凭证(有 /certificates/verify 公开校验),签发/吊销属管理职能。
  server.post('/certificates/issue', { preHandler: [requireAdmin] }, async (request, reply) => {
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

  server.post(
    '/certificates/:id/revoke',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const id = parseIdParam(request, reply)
      if (id === null) return
      const cert = await updateCertificateStatus(id, 0)
      if (!cert) return reply.status(404).send(error(404, '证书不存在'))
      return reply.send(success({ success: true, certificate: cert }))
    },
  )
}

export default resourcesRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
