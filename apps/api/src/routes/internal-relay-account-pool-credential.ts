// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * O64 号池凭证回写内网端点(2026-10-23 立,设计 docs/engineering/account-pool-checkin-sync-design.md)。
 *
 * POST /api/internal/relay/account-pool/credential —— ai-service(签到引擎 Qoder
 * 自刷新后)→ apps/api 的凭证回流入口。鉴权与 knowledge-card 内网点同款:
 * X-Internal-Secret 匹配 config.AI_CALLBACK_SECRET(未配置 503 不裸奔,不匹配 401)。
 *
 * 响应语义(200 体内的 status,非 HTTP 错误):
 * - applied : CAS 命中,新凭证已落号池并 cred_version +1
 * - conflict: 号池侧在签到刷新后又有更新 → 以号池为准丢弃本次回写(响应带 currentVersion,
 *   签到侧据此校正 device_map.pool_cred_version 基准,下次凭证变化才再回写)
 * - not_found: 号池行已删(404,签到侧账号应已被 pool_deleted 停用;对账收敛器兜底)
 */
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { z } from 'zod'
import { config } from '../config/index.js'
import { error, success } from '../utils/response.js'
import { applyPoolCredentialWriteback } from '../services/relay-account-pool-credential.js'

const credentialBodySchema = z.object({
  poolAccountId: z.string().min(1).max(64),
  baseVersion: z.number().int().min(0),
  refreshToken: z.string().max(8192).nullable().optional(),
  expiresAt: z.string().max(64).nullable().optional(),
  source: z.string().max(64).optional(),
})

const internalRelayAccountPoolCredentialRoutes: FastifyPluginAsync = async (server) => {
  server.post('/api/internal/relay/account-pool/credential', async (request, reply) => {
    const secret = config.AI_CALLBACK_SECRET
    if (!secret) {
      return reply.status(503).send(error(503, '内部密钥未配置(AI_CALLBACK_SECRET)'))
    }
    const provided = request.headers['x-internal-secret']
    if (typeof provided !== 'string' || provided !== secret) {
      return reply.status(401).send(error(401, '内部密钥不匹配'))
    }
    const parsed = credentialBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '凭证回写参数错误'))
    }
    try {
      const result = await applyPoolCredentialWriteback(parsed.data)
      if (result.status === 'not_found') {
        return reply.status(404).send(error(404, '号池账号不存在(可能已删除)'))
      }
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e, '[relay-account-pool] 凭证回写失败')
      return reply.status(500).send(error(500, '凭证回写失败'))
    }
  })
}

export default fp(internalRelayAccountPoolCredentialRoutes, {
  name: 'internal-relay-account-pool-credential',
})
