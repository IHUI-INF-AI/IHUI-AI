// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端接入配置面(2026-11-18 立)。
 *
 * `GET  /api/admin/relay/client-config/presets` —— 支持的客户端清单(给下拉框)
 * `POST /api/admin/relay/client-config`          —— 拼装一份可粘贴配置
 *
 * 为什么放后端:web / CLI / 移动端 / 客服话术共用同一份输出(单一真相源),
 * 拼装逻辑只此一处;对照程序只在前端拼,换端就得重写一遍。
 *
 * 纪律:端点与域名绝不内置 —— baseUrl 由调用方传入,模块只按协议拼格式。
 * 响应体含调用方传入的 apiKey(这是要让人复制的),因此**不进日志**,且仅 admin 可取。
 */
import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import { buildClientConfig, listClientPresets } from '../../services/relay-client-config.js'

const bodySchema = z.object({
  client: z.string().min(1).max(64),
  baseUrl: z.string().min(1).max(512),
  apiKey: z.string().min(1).max(512),
  model: z.string().max(128).optional(),
  region: z.string().max(32).optional(),
})

export const relayClientConfigRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.get('/admin/relay/client-config/presets', async (_request, reply) => {
    return reply.send(success({ presets: listClientPresets() }))
  })

  server.post('/admin/relay/client-config', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .code(400)
        .send(error(400, 'client / baseUrl / apiKey 必填(≤512 字符),model / region 可选'))
    }

    const result = buildClientConfig(parsed.data)
    if (!result.ok) {
      return reply.code(400).send(error(400, result.reason, result.code))
    }

    return reply.send(
      success({
        client: result.client,
        client_label: result.clientLabel,
        format: result.format,
        body: result.body,
        warnings: result.warnings,
        note: '配置里的 baseUrl 来自本次请求;若与实际部署不符,客户端会 404,先核对地址再粘贴',
      }),
    )
  })
}

export default relayClientConfigRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
