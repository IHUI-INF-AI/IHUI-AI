// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 签到助手网关代理(2026-10-23 立)。
 *
 * `/api/checkin/*` 的真实实现在 ai-service(8803);Web 由 next rewrite 直连,
 * 但移动端(RN / 小程序)与桌面端只认主 API 基址 —— 此前这些端的签到请求会打到
 * 8802 得到 Fastify 404(见 packages/api-client client.ts 的 aiServiceBaseOverride 注释)。
 * 本代理把同一组路径透传到 AI_SERVICE_URL,让所有端共用一套账号数据(互通)。
 *
 * 只代理这一个前缀;Authorization 原样透传(ai-service 的 JWTAuthMiddleware 验签),
 * 不注入任何身份 —— 网关不成为鉴权旁路。
 */
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { config } from '../config/index.js'
import { error } from '../utils/response.js'

const PROXY_TIMEOUT_MS = 60_000
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

const checkinProxyRoutes: FastifyPluginAsync = async (server) => {
  server.route({
    method: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    url: '/api/checkin/*',
    handler: async (request, reply) => {
      const base = config.AI_SERVICE_URL.replace(/\/+$/, '')
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(request.headers)) {
        if (HOP_BY_HOP.has(k.toLowerCase())) continue
        if (typeof v === 'string') headers[k] = v
        else if (Array.isArray(v)) headers[k] = v.join(', ')
      }
      const hasBody = request.body !== undefined && request.body !== null
      headers['content-type'] = 'application/json'
      try {
        const resp = await fetch(`${base}${request.url}`, {
          method: request.method,
          headers,
          body: hasBody ? JSON.stringify(request.body) : undefined,
          signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
        })
        reply.status(resp.status)
        const contentType = resp.headers.get('content-type')
        if (contentType) reply.header('content-type', contentType)
        const buf = Buffer.from(await resp.arrayBuffer())
        return reply.send(buf)
      } catch (e) {
        request.log.error(e, '[checkin-proxy] 转发 ai-service 失败')
        return reply.status(502).send(error(502, '签到服务暂不可用'))
      }
    },
  })
}

export default fp(checkinProxyRoutes, { name: 'checkin-proxy' })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
