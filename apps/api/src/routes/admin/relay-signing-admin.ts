// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 签名协议与 PAT 引导的 admin 面(2026-11-18 立)。
 *
 * 1. GET  /admin/relay/signature-protocols —— 支持的公开签名协议清单(只读)
 * 2. POST /admin/relay/pat-onboarding      —— 生成 PAT 引导计划;可选带入一次验证结果做判定
 *
 * 只做编排,判据一律走服务层(单一真相源),本文件不复制任何阈值。
 */
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import { describeSignatureProtocols } from '../../services/upstream-adapters/signature-protocols.js'
import { planPatOnboarding, judgePatProbeResult } from '../../services/relay-pat-onboarding.js'
import { describeUpstreamCapabilityMatrix } from '../../services/relay-upstream-capability-matrix.js'

const onboardingBody = z.object({
  issuanceUrl: z.string().max(512).optional(),
  pastedToken: z.string().max(1024).optional(),
  enabled: z.boolean().optional(),
  probe: z
    .object({
      httpStatus: z.number().int().nullable().optional(),
      bodyText: z.string().max(2000).optional(),
    })
    .optional(),
})

export const relaySigningAdminRoutes: FastifyPluginAsync = async (server) => {
  server.get('/admin/relay/signature-protocols', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send(success(describeSignatureProtocols()))
  })

  // 上游能力矩阵(三家一表):每条能力指到真实实现位置,状态只有 implemented/derived/unreproducible
  server.get('/admin/relay/upstream-capability-matrix', { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send(success(describeUpstreamCapabilityMatrix()))
  })

  server.post('/admin/relay/pat-onboarding', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = onboardingBody.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.code(400).send(error(400, parsed.error.issues[0]?.message ?? 'body 非法'))
    }
    const b = parsed.data
    const plan = planPatOnboarding({
      issuanceUrl: b.issuanceUrl,
      pastedToken: b.pastedToken,
      enabled: b.enabled,
    })
    const probe = b.probe ? judgePatProbeResult(b.probe) : null
    return reply.send(
      success({
        ...plan,
        probe,
        note: '票形通过不等于生效:只有 probe.state=valid 才把 enabled 置真,其它状态一律保持停用',
      }),
    )
  })
}

export default relaySigningAdminRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
